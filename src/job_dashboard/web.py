from __future__ import annotations

import csv
import io
import json
import mimetypes
import os
import re
import threading
import time
import textwrap
import urllib.error
import urllib.request
from xml.sax.saxutils import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from .documents import generate_documents
from .compare import COMPARE_MODELS, CompareRunner
from .email_connector import GmailApiScanner, GmailScanner
from .models import Job
from .normalize import normalize_job
from .service import JobDashboard
from .sources import SearchQuery, ScrapePipeline, clean_description, is_recent, posted_age
from .repository import JobRepository
from .scrape_config import DEFAULT_QUERIES

TRACKER_CSV_URL = "https://docs.google.com/spreadsheets/d/1IciRjQBBQoykm0K6NljjDNEWDTzdjsSaEPef8-hw8Lk/export?format=csv&gid=0"


class DashboardApp:
    def __init__(self, profile, sources, data_dir: str | Path, document_generator=None, search_queries=None):
        self.dashboard = JobDashboard(profile)
        self.sources = sources
        self.document_generator = document_generator
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.jobs_path = self.data_dir / "jobs.json"
        self.search_queries_path = self.data_dir / "search_queries.json"
        self.search_queries = self._load_search_queries(search_queries)
        self.jobs: list[dict] = self._load_jobs()
        self.repository = JobRepository(self.data_dir / "jobs.sqlite3")
        self.generated_documents: dict[str, dict[str, str]] = self._load_generated_documents()
        self.generation_progress: dict[str, dict[str, object]] = {}
        self.compare_results: dict[str, dict[str, object]] = self._load_compare_results()
        self.compare_progress: dict[str, dict[str, object]] = {}
        self.tracker_state: dict[str, object] = {"status": "idle", "last_sync": None, "rows": 0, "matched": 0, "error": None}
        self.tracker_rows: list[dict[str, str]] = []
        generator_factory = None
        if document_generator is not None:
            generator_factory = lambda model: type(document_generator)(document_generator.source_dir, document_generator.guidelines_dir, model=model, api_key=document_generator.api_key)
        self.compare_runner = CompareRunner(self.data_dir, generator_factory=generator_factory)
        if self.jobs:
            self.jobs = self.materialize_jobs(self.jobs)
            for job in self.jobs:
                job_id = normalize_job(job).id
                generated = job.get("generated") or self.generated_documents.get(job_id)
                if generated and self._documents_exist(generated):
                    self.generated_documents[job_id] = generated
                    job["generated"] = generated
            self.repository.replace_jobs(self.jobs)
        self.lock = threading.Lock()

    def save_search_queries(self):
        payload = [{"term": query.term, "location": query.location, "stream": query.stream} for query in self.search_queries]
        temporary = self.search_queries_path.with_suffix(".tmp")
        with temporary.open("w", encoding="utf-8") as file:
            json.dump(payload, file, indent=2)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        temporary.replace(self.search_queries_path)

    def _load_search_queries(self, defaults=None):
        if not self.search_queries_path.exists():
            return list(defaults or [])
        try:
            records = json.loads(self.search_queries_path.read_text(encoding="utf-8"))
            loaded = [SearchQuery(str(item["term"]).strip(), str(item.get("location", "Melbourne, VIC")).strip(), str(item.get("stream", "core-it")).strip(), str(item.get("group", "")).strip(), float(item.get("weight", 1.0)), tuple(str(term).strip() for term in item.get("exclude_terms", []) if str(term).strip()), bool(item.get("enabled", True))) for item in records if str(item.get("term", "")).strip()]
            return loaded or list(defaults or DEFAULT_QUERIES)
        except (OSError, TypeError, ValueError, json.JSONDecodeError):
            return list(defaults or [])

    def update_search_queries(self, items):
        self.search_queries = [
            SearchQuery(
                str(item.get("term", "")).strip(),
                str(item.get("location", "Melbourne, VIC")).strip() or "Melbourne, VIC",
                str(item.get("stream", "core-it")).strip().lower() or "core-it",
                str(item.get("group", "")).strip(),
                float(item.get("weight", 1.0)),
                tuple(str(term).strip() for term in item.get("exclude_terms", []) if str(term).strip()),
                bool(item.get("enabled", True)),
            )
            for item in items
            if str(item.get("term", "")).strip()
        ]
        self.save_search_queries()
        result = []
        for query in self.search_queries:
            item = {"term": query.term, "location": query.location, "stream": query.stream}
            if query.group or query.weight != 1.0 or query.exclude_terms or not query.enabled:
                item.update({"group": query.group, "weight": query.weight, "exclude_terms": list(query.exclude_terms), "enabled": query.enabled})
            result.append(item)
        return result

    def update_status(self, job_id: str, status: str):
        result = self.repository.update_status(job_id, status)
        for job in self.jobs:
            if job.get("id") == job_id:
                job["status"] = status
                break
        return result

    def suggested_search_queries(self):
        """Return search terms grounded in the candidate's experience and skills."""
        profile = self.dashboard.profile
        terms = []
        seen = set()

        def add(term, stream="core-it"):
            term = str(term).strip()
            if term and term.lower() not in seen:
                seen.add(term.lower())
                terms.append(SearchQuery(term, "Melbourne, VIC", stream))

        for experience in profile.get("experience", []):
            add(experience.get("title", ""))
        for term in ("Microsoft 365 Administrator", "SharePoint Administrator", "SharePoint Developer", "Azure Administrator", "Entra ID Administrator", "Intune Administrator", "Endpoint Engineer", "PowerShell Automation Engineer", "ServiceNow Administrator", "Technical Support Engineer", "Infrastructure Consultant"):
            add(term)
        add("warehouse", "bridge")
        add("casual work", "bridge")
        add("data centre technician", "traineeship")
        add("cabling technician", "traineeship")
        return [{"term": query.term, "location": query.location, "stream": query.stream} for query in terms]

    def _load_generated_documents(self):
        path = self.data_dir / "generated_documents.json"
        if not path.exists():
            return {}
        try:
            records = json.loads(path.read_text(encoding="utf-8"))
            return {job_id: metadata for job_id, metadata in records.items() if self._documents_exist(metadata)}
        except json.JSONDecodeError:
            return {}

    @staticmethod
    def _documents_exist(metadata):
        return all(Path(metadata.get(name, "")).is_file() for name in ("resume_pdf", "cover_letter_pdf"))

    def _recover_generated_documents(self, job_id):
        """Recover a completed pair if the worker was interrupted after writing files."""
        if job_id in self.generated_documents and self._documents_exist(self.generated_documents[job_id]):
            return self.generated_documents[job_id]
        raw = next((job for job in self.jobs if normalize_job(job).id == job_id), None)
        if raw is None:
            return None
        application_id = re.sub(r"[^a-z0-9]+", "_", f"{raw.get('company', '')}_{raw.get('title', '')}".lower()).strip("_")[:160]
        output_dir = self.data_dir / "applications"
        metadata = {
            "application_id": application_id,
            "status": "draft_ready",
            "audit": {"verified": True, "issue_count": 0, "issues": []},
            "resume": str(output_dir / f"{application_id}_resume.md"),
            "cover_letter": str(output_dir / f"{application_id}_cover_letter.md"),
            "resume_pdf": str(output_dir / f"{application_id}_resume.pdf"),
            "cover_letter_pdf": str(output_dir / f"{application_id}_cover_letter.pdf"),
        }
        if self._documents_exist(metadata):
            self.generated_documents[job_id] = metadata
            self.save_generated_documents()
            self.generation_progress[job_id] = {"phase": "Completed", "estimate_seconds": 0, "progress": 100, "done": True, **metadata}
            return metadata
        return None

    def save_generated_documents(self):
        payload = {str(job_id): meta for job_id, meta in self.generated_documents.items()}
        (self.data_dir / "generated_documents.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def _load_compare_results(self):
        path = self.data_dir / "compare_results.json"
        if not path.exists():
            return {}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, TypeError, ValueError, json.JSONDecodeError):
            return {}

    def _save_compare_results(self):
        (self.data_dir / "compare_results.json").write_text(json.dumps(self.compare_results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def _compare_update(self, comparison_id, model_id, cache_key, result):
        comparison = self.compare_results.setdefault(comparison_id, {"comparison_id": comparison_id, "job_id": comparison_id.removeprefix("cmp_").rsplit("_", 1)[0], "models": {}, "selected_model": None})
        comparison["models"][model_id] = {**result, "cache_key": cache_key}
        self.compare_progress[comparison_id] = {"done": all(item.get("status") in {"completed", "failed", "timeout"} for item in comparison["models"].values()) and len(comparison["models"]) == len(COMPARE_MODELS), "models": comparison["models"]}
        self._save_compare_results()

    def start_compare(self, job_id: str):
        raw = next((job for job in self.jobs if normalize_job(job).id == job_id), None)
        if raw is None:
            raise KeyError(job_id)
        analysis = self.dashboard.analyse(raw)
        comparison_id = f"cmp_{job_id}_{int(time.time())}"
        comparison = {"comparison_id": comparison_id, "job_id": job_id, "started_at": time.time(), "models": {}, "selected_model": None, "warning": "Low match quality; review carefully before using generated documents." if analysis.score.score < 70 or not analysis.score.matched_skills else ""}
        self.compare_results[comparison_id] = comparison
        self.compare_progress[comparison_id] = {"done": False, "models": {model_id: {"model_id": model_id, "display_name": display_name, "status": "queued"} for model_id, display_name in COMPARE_MODELS}, "warning": comparison["warning"]}
        self._save_compare_results()
        cached = {result.get("cache_key"): result for past in self.compare_results.values() for result in past.get("models", {}).values() if result.get("cache_key")}
        self.compare_runner.submit(comparison_id, analysis.job, self.dashboard.profile, cached, lambda model, key, result: self._compare_update(comparison_id, model, key, result))
        return {"comparison_id": comparison_id, **self.compare_progress[comparison_id]}

    def select_compare_output(self, comparison_id: str, model_id: str):
        comparison = self.compare_results.get(comparison_id)
        if not comparison or model_id not in comparison.get("models", {}):
            raise KeyError(model_id)
        selected = comparison["models"][model_id]
        if selected.get("status") != "completed":
            raise ValueError("That model has no completed output")
        job_id = comparison["job_id"]
        output_dir = self.data_dir / "applications"
        output_dir.mkdir(parents=True, exist_ok=True)
        application_id = re.sub(r"[^a-z0-9]+", "_", f"{job_id}_{model_id}".lower()).strip("_")[:160]
        resume_path = output_dir / f"{application_id}_resume.md"
        cover_path = output_dir / f"{application_id}_cover_letter.md"
        resume_path.write_text(selected["resume_text"], encoding="utf-8")
        cover_path.write_text(selected["cover_letter_text"], encoding="utf-8")
        self._write_pdf(output_dir / f"{application_id}_resume.pdf", selected["resume_text"])
        self._write_pdf(output_dir / f"{application_id}_cover_letter.pdf", selected["cover_letter_text"])
        metadata = {"application_id": application_id, "model_id": model_id, "status": "needs_review" if not selected.get("audit", {}).get("verified", True) else "draft_ready", "audit": selected.get("audit", {}), "resume": str(resume_path), "cover_letter": str(cover_path), "resume_pdf": str(output_dir / f"{application_id}_resume.pdf"), "cover_letter_pdf": str(output_dir / f"{application_id}_cover_letter.pdf")}
        self.generated_documents[job_id] = metadata
        comparison["selected_model"] = model_id
        self.save_generated_documents()
        self._save_compare_results()
        return metadata

    def retry_compare_model(self, comparison_id: str, model_id: str):
        comparison = self.compare_results.get(comparison_id)
        if not comparison:
            raise KeyError(comparison_id)
        raw = next((job for job in self.jobs if normalize_job(job).id == comparison["job_id"]), None)
        if raw is None:
            raise KeyError(comparison["job_id"])
        self.compare_runner.submit(comparison_id, self.dashboard.analyse(raw).job, self.dashboard.profile, {}, lambda model, key, result: self._compare_update(comparison_id, model, key, result), model_ids=[model_id])
        comparison["models"][model_id] = {"model_id": model_id, "status": "loading"}
        self._save_compare_results()
        return comparison["models"][model_id]

    def _write_pdf(self, output_path: Path, text: str):
        styles = getSampleStyleSheet()
        body = ParagraphStyle("DocumentBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.5, leading=13, textColor=colors.HexColor("#26383a"), spaceAfter=5)
        name = ParagraphStyle("DocumentName", parent=body, fontName="Helvetica-Bold", fontSize=21, leading=24, textColor=colors.HexColor("#123c42"), spaceAfter=2)
        subtitle = ParagraphStyle("DocumentSubtitle", parent=body, fontSize=10.5, leading=14, textColor=colors.HexColor("#397078"), spaceAfter=3)
        heading = ParagraphStyle("DocumentHeading", parent=body, fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=colors.HexColor("#123c42"), spaceBefore=10, spaceAfter=5, keepWithNext=True)
        role = ParagraphStyle("DocumentRole", parent=body, fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=colors.HexColor("#26383a"), spaceBefore=6, spaceAfter=1, keepWithNext=True)
        date = ParagraphStyle("DocumentDate", parent=body, fontSize=8.5, leading=11, textColor=colors.HexColor("#607477"), spaceAfter=3, keepWithNext=True)
        bullet = ParagraphStyle("DocumentBullet", parent=body, leftIndent=10, firstLineIndent=-7, bulletIndent=0, spaceAfter=3)

        story = []
        lines = [line.strip() for line in text.replace("**", "").splitlines()]
        for line in lines:
            if not line:
                story.append(Spacer(1, 3))
                continue
            if line.startswith("# "):
                story.append(Paragraph(escape(line[2:].strip()), name))
            elif line.startswith("## "):
                story.append(Paragraph(escape(line[3:].strip()).upper(), heading))
            elif line.startswith("### "):
                story.append(Paragraph(escape(line[4:].strip()), role))
            elif line.startswith("- ") or line.startswith("• "):
                story.append(Paragraph(f"&bull; {escape(line[2:].strip())}", bullet))
            elif re.fullmatch(r"(?:[A-Z][a-z]+ \d{4}|Present|\d{4})\s*[–-]\s*(?:[A-Z][a-z]+ \d{4}|Present|\d{4})", line):
                story.append(Paragraph(escape(line), date))
            else:
                story.append(Paragraph(escape(line), body))

        def footer(canvas, document):
            canvas.saveState()
            canvas.setStrokeColor(colors.HexColor("#d4e2e2"))
            canvas.line(20 * mm, 14 * mm, 190 * mm, 14 * mm)
            canvas.setFont("Helvetica", 7.5)
            canvas.setFillColor(colors.HexColor("#789093"))
            canvas.drawRightString(190 * mm, 9 * mm, f"{document.page}")
            canvas.restoreState()

        document = SimpleDocTemplate(str(output_path), pagesize=letter, rightMargin=20 * mm, leftMargin=20 * mm, topMargin=16 * mm, bottomMargin=20 * mm, title=output_path.stem, author="Local Job Desk")
        document.build(story, onFirstPage=footer, onLaterPages=footer)

    def _document_metadata(self, job_id, documents, output_dir):
        metadata = {
            "application_id": documents["application_id"],
            "status": documents.get("status", "draft_ready"),
            "audit": documents.get("audit", {"verified": True, "issue_count": 0, "issues": []}),
            "resume": str(output_dir / f"{documents['application_id']}_resume.md"),
            "cover_letter": str(output_dir / f"{documents['application_id']}_cover_letter.md"),
            "resume_pdf": str(output_dir / f"{documents['application_id']}_resume.pdf"),
            "cover_letter_pdf": str(output_dir / f"{documents['application_id']}_cover_letter.pdf"),
        }
        self.generated_documents[job_id] = metadata
        return metadata

    def _generation_status(self, job_id: str, started_at: float):
        elapsed = max(0.0, time.time() - started_at)
        estimate = 0
        if elapsed < 3:
            pct, phase = 10, "Now generating"
        elif elapsed < 8:
            pct, phase = 25, "Now generating"
        elif elapsed < 45:
            pct, phase = min(90, 25 + int((elapsed - 8) / 37 * 65)), "Now generating"
        else:
            pct, phase = 95, "Now generating"
        return {"phase": phase, "estimate_seconds": round(estimate), "progress": pct, "started_at": started_at}

    def _load_jobs(self):
        if not self.jobs_path.exists():
            return []
        return json.loads(self.jobs_path.read_text(encoding="utf-8")).get("jobs", [])

    def save_jobs(self):
        self.jobs_path.write_text(json.dumps({"jobs": self.jobs}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        self.repository.replace_jobs(self.jobs)

    def materialize_jobs(self, jobs):
        materialized = []
        for raw in jobs:
            job = normalize_job(raw)
            analysis = self.dashboard.analyse(raw)
            item = dict(raw)
            item.update({"id": job.id, "score": analysis.score.score, "stream": analysis.stream, "fit_category": analysis.fit_category, "dimensions": analysis.score.dimensions, "matched_skills": analysis.score.matched_skills, "missing_skills": analysis.score.missing_skills, "description": clean_description(job.description)})
            materialized.append(item)
        return materialized

    def analyses(self):
        return [self.dashboard.analyse(job) for job in self.jobs]

    def rejected_applications(self):
        """Return Gmail rejection records for a separate archive view."""
        archived = []
        seen = set()
        for raw in self.jobs:
            events = [event for event in raw.get("email_events", []) if event.get("category") == "rejected"]
            if not events:
                continue
            job = normalize_job(raw)
            latest = events[-1]
            email_id = latest.get("email_id", "")
            if email_id in seen:
                continue
            seen.add(email_id)
            archived.append({"id": job.id, "title": job.title, "company": job.company or "Company not identified", "received_at": latest.get("received_at", ""), "confidence": latest.get("confidence", 0), "email_url": f"https://mail.google.com/mail/u/0/#all/{email_id}" if email_id else "", "description": job.description})
        return archived

    def application_archive(self):
        archive = []
        for raw in self.jobs:
            for event in raw.get("email_events", []):
                archive.append({"title": raw.get("title", "Gmail application"), "company": raw.get("company", "Company not identified"), "category": event.get("category", "tracked"), "received_at": event.get("received_at", "")})
        return archive

    def public_jobs(self, filters=None):
        filters = filters or {}
        stored = self.repository.list_jobs(**filters)
        stored_by_id = {job.get("id"): job for job in stored}
        result = []
        for analysis in self.analyses():
            if analysis.job.id not in stored_by_id:
                continue
            stored_job = stored_by_id[analysis.job.id]
            posted = next((job.get("posted", "") for job in self.jobs if job.get("id") == analysis.job.id or job.get("url") == analysis.job.url), "")
            raw = next((job for job in self.jobs if job.get("id") == analysis.job.id or job.get("url") == analysis.job.url), {})
            if str(analysis.job.source).lower() == "gmail":
                continue
            if not filters.get("status") and stored_job.get("status", "sourced") != "sourced":
                continue
            if stored_job.get("status") == "rejected" or not self._has_recent_activity(raw):
                continue
            generated = raw.get("generated") or self.generated_documents.get(analysis.job.id)
            email_events = raw.get("email_events", [])
            email_id = email_events[-1].get("email_id") if email_events else ""
            result.append({"id": analysis.job.id, "title": analysis.job.title, "company": analysis.job.company, "location": analysis.job.location, "description": analysis.job.description, "source": analysis.job.source, "url": analysis.job.url, "email_url": f"https://mail.google.com/mail/u/0/#all/{email_id}" if email_id else "", "salary": raw.get("salary", ""), "posted": posted, "posted_age": posted_age(posted), "remote": analysis.job.remote, "stream": analysis.stream, "fit_category": analysis.fit_category, "score": analysis.score.score, "fit": analysis.score.fit, "matched_skills": analysis.score.matched_skills, "missing_skills": analysis.score.missing_skills, "dimensions": analysis.score.dimensions, "generated": generated})
            result[-1]["status"] = stored_job.get("status", "sourced")
        return result

    @staticmethod
    def _has_recent_activity(job, days: int = 7):
        dates = [job.get("posted", "")]
        dates.extend(event.get("received_at", "") for event in job.get("email_events", []))
        return any(value and is_recent({"posted": value}, days=days) for value in dates)

    def refresh(self, queries):
        with self.lock:
            pipeline = ScrapePipeline(self.sources, days=14)
            fresh = pipeline.run(queries)
            self.jobs = self.materialize_jobs(fresh)
            self.save_jobs()
            return self.public_jobs(), pipeline.errors

    @staticmethod
    def _gmail_job_details(message):
        subject = re.sub(r"^\s*(re|fw|fwd)\s*:\s*", "", message.subject, flags=re.I).strip()
        match = re.search(r"(?:application|applying|applied|interest|submission).*?(?:for|to|:)[\s\-]*(.+?)\s+(?:at|with)\s+(.+)$", subject, re.I)
        if match:
            title, company = match.groups()
        else:
            title = subject or "Gmail application"
            company = ""
            domain = re.search(r"@([\w.-]+)", message.from_address)
            if domain:
                company = domain.group(1).split(".")[0].replace("-", " ").title()
        title = re.sub(r"\s+(?:application|received|confirmation|confirmed)$", "", title, flags=re.I).strip(" .:-")
        return title[:160] or "Gmail application", company[:120]

    @staticmethod
    def _gmail_status(category):
        return {
            "application_confirmed": "applied",
            "recruiter_reply": "applied",
            "interview_requested": "interviewing",
            "offer_extended": "offer",
            "rejected": "rejected",
        }[category]

    @staticmethod
    def _same_job(left, title, company):
        def tokens(value):
            return {token for token in re.findall(r"[a-z0-9]+", value.lower()) if len(token) > 2}
        title_overlap = tokens(left.get("title", "")) & tokens(title)
        company_overlap = tokens(left.get("company", "")) & tokens(company)
        return len(title_overlap) >= 2 and (not company or not left.get("company") or company_overlap)

    def scan_gmail(self, username: str | None = None, app_password: str | None = None, days: int = 7):
        days = max(1, min(7, int(days)))
        credential_candidates = []
        for candidate in Path(__file__).resolve().parents[2].glob("client_secret_*.json"):
            try:
                config = json.loads(candidate.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if "installed" in config:
                credential_candidates.insert(0, candidate)
            else:
                credential_candidates.append(candidate)
        if credential_candidates:
            scanner = GmailApiScanner(str(credential_candidates[0]), str(self.data_dir / "gmail_token.json"), days=days)
        elif username and app_password:
            scanner = GmailScanner(username, app_password, days=days)
        else:
            raise RuntimeError("Gmail OAuth client file or IMAP credentials are required")
        matched = created = updated = 0
        messages = scanner.application_messages()
        for message, category, confidence in messages:
            title, company = self._gmail_job_details(message)
            existing = next((job for job in self.jobs if self._same_job(job, title, company)), None)
            status = self._gmail_status(category)
            if existing:
                job_id = normalize_job(existing).id
                existing.setdefault("email_events", []).append({"email_id": message.email_id, "category": category, "received_at": message.received_at, "confidence": confidence})
                self.repository.update_status(job_id, status)
                updated += 1
                matched += 1
                continue
            new_job = {
                "id": f"gmail-{message.email_id}",
                "title": title,
                "company": company,
                "location": "",
                "description": message.body_preview or message.snippet,
                "source": "Gmail",
                "url": "",
                "posted": message.received_at[:10],
                "remote": False,
                "tags": ["gmail", "application", category],
                "email_events": [{"email_id": message.email_id, "category": category, "received_at": message.received_at, "confidence": confidence}],
            }
            self.jobs.extend(self.materialize_jobs([new_job]))
            self.save_jobs()
            self.repository.update_status(new_job["id"], status)
            created += 1
        if updated:
            self.save_jobs()
        return {"scanned": len(messages), "matched": matched, "updated": updated, "created": created, "jobs": self.public_jobs()}

    def start_gmail_scan(self):
        thread = threading.Thread(target=self.scan_gmail, kwargs={"days": 7}, daemon=True)
        thread.start()
        return thread

    def sync_tracker(self):
        """Pull the shared application tracker sheet and reconcile it against current jobs."""
        self.tracker_state = {**self.tracker_state, "status": "syncing"}
        try:
            request = urllib.request.Request(TRACKER_CSV_URL, headers={"User-Agent": "job-dashboard/1.0"})
            with urllib.request.urlopen(request, timeout=20) as response:
                text = response.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError) as error:
            self.tracker_state = {**self.tracker_state, "status": "failed", "error": str(error)}
            return self.tracker_state
        rows = [row for row in csv.DictReader(io.StringIO(text)) if any(value.strip() for value in row.values())]
        self.tracker_rows = rows
        matched = 0
        for row in rows:
            title = str(row.get("Job Title") or row.get("Title") or row.get("Role") or row.get("Position") or "").strip()
            company = str(row.get("Company") or row.get("Employer") or "").strip()
            status = str(row.get("Status") or row.get("Stage") or "").strip().lower()
            if not title:
                continue
            existing = next((job for job in self.jobs if self._same_job(job, title, company)), None)
            if not existing:
                continue
            matched += 1
            mapped_status = self._map_tracker_status(status)
            if mapped_status:
                try:
                    self.update_status(normalize_job(existing).id, mapped_status)
                except (KeyError, ValueError):
                    pass
        self.tracker_state = {"status": "completed", "last_sync": time.time(), "rows": len(rows), "matched": matched, "error": None}
        return self.tracker_state

    def start_tracker_sync(self):
        thread = threading.Thread(target=self.sync_tracker, daemon=True)
        thread.start()
        return thread

    @staticmethod
    def _map_tracker_status(status_text: str) -> str | None:
        """Classify a free-text tracker status cell into a dashboard stage."""
        text = status_text.lower()
        if any(term in text for term in ("unsuccessful", "reject", "declined", "closed", "expired")):
            return "rejected"
        if "offer" in text:
            return "offer"
        if "interview" in text:
            return "interviewing"
        if any(term in text for term in ("shortlist",)):
            return "shortlisted"
        if any(term in text for term in ("applied", "submitted", "confirmation", "confirmed", "under review", "action required", "viewed", "response received")):
            return "applied"
        return None

    def tracker_suggestions(self):
        """Tracker rows not yet represented among the dashboard's jobs."""
        suggestions = []
        for row in self.tracker_rows:
            title = str(row.get("Job Title") or row.get("Title") or row.get("Role") or row.get("Position") or "").strip()
            company = str(row.get("Company") or row.get("Employer") or "").strip()
            if not title or any(self._same_job(job, title, company) for job in self.jobs):
                continue
            suggestions.append({
                "title": title,
                "company": company or "Company not listed",
                "status": str(row.get("Status") or row.get("Stage") or "").strip(),
                "date": str(row.get("Date") or row.get("Applied") or "").strip(),
                "notes": str(row.get("Notes") or "").strip(),
                "email_link": str(row.get("Email Link") or row.get("Email link") or row.get("Email") or "").strip(),
            })
        return suggestions

    def generate(self, job_id):
        raw = next((job for job in self.jobs if normalize_job(job).id == job_id), None)
        if raw is None:
            raise KeyError(job_id)
        generator = self.document_generator or generate_documents
        output_dir = self.data_dir / "applications"
        output_dir.mkdir(exist_ok=True)
        started_at = time.time()
        self.generation_progress[job_id] = self._generation_status(job_id, started_at)
        if self.document_generator:
            if hasattr(generator, "generate"):
                documents = generator.generate(normalize_job(raw), self.dashboard.profile)
            else:
                documents = generator(normalize_job(raw), self.dashboard.profile)
        else:
            documents = generator(normalize_job(raw), self.dashboard.profile)
        for kind in ("resume", "cover_letter"):
            markdown_path = output_dir / f"{documents['application_id']}_{kind}.md"
            markdown_path.write_text(documents[kind], encoding="utf-8")
            pdf_path = output_dir / f"{documents['application_id']}_{kind}.pdf"
            self._write_pdf(pdf_path, documents[kind])
        self._document_metadata(job_id, documents, output_dir)
        self.save_generated_documents()
        for job in self.jobs:
            if normalize_job(job).id == job_id:
                job["generated"] = self.generated_documents[job_id]
                break
        self.save_jobs()
        self.generation_progress[job_id] = {"phase": "Completed", "estimate_seconds": 0, "progress": 100, "started_at": started_at, "done": True, **self.generated_documents[job_id]}
        return {**documents, **self.generated_documents[job_id]}

    def start_generation(self, job_id):
        existing = self._recover_generated_documents(job_id)
        if existing and self._documents_exist(existing):
            return {"phase": "Completed", "estimate_seconds": 0, "progress": 100, "done": True, **existing}
        if self.generation_progress.get(job_id, {}).get("done"):
            return self.generation_progress[job_id]
        started_at = time.time()
        self.generation_progress[job_id] = self._generation_status(job_id, started_at)

        def runner():
            try:
                generated = self.generate(job_id)
                status = {"phase": "Completed", "estimate_seconds": 0, "progress": 100, "started_at": started_at, "done": True, **generated}
            except Exception as error:
                status = {"phase": "Failed", "error": str(error), "estimate_seconds": 0, "progress": 100, "started_at": started_at, "done": True, "failed": True}
            self.generation_progress[job_id] = status

        thread = threading.Thread(target=runner, daemon=True)
        thread.start()
        return self.generation_progress[job_id]


def make_handler(app: DashboardApp):
    class Handler(BaseHTTPRequestHandler):
        def send_json(self, status, payload):
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            parsed = urlparse(self.path)
            path = parsed.path
            if path == "/api/jobs":
                query = parse_qs(parsed.query)
                filters = {key: query[key][0] for key in ("location", "role", "source", "stream", "status") if key in query}
                filters["match_score_min"] = int(query.get("match_score_min", [0])[0])
                self.send_json(200, {"jobs": app.public_jobs(filters)})
                return
            if path == "/api/metrics/summary":
                metrics = app.repository.metrics()
                metrics["tracker_state"] = app.tracker_state
                self.send_json(200, metrics)
                return
            if path == "/api/rejections":
                self.send_json(200, {"rejections": app.rejected_applications()})
                return
            if path == "/api/tracker/suggestions":
                self.send_json(200, {"suggestions": app.tracker_suggestions(), "tracker_state": app.tracker_state})
                return
            if path.startswith("/api/compare/"):
                comparison_id = path.removeprefix("/api/compare/")
                comparison = app.compare_results.get(comparison_id)
                if not comparison:
                    self.send_json(404, {"error": "Comparison not found"})
                    return
                self.send_json(200, app.compare_progress.get(comparison_id, comparison))
                return
            if path == "/api/applications/archive":
                self.send_json(200, {"applications": app.application_archive()})
                return
            if path == "/api/search-criteria":
                self.send_json(200, {"queries": [{"term": query.term, "location": query.location, "stream": query.stream, "group": query.group, "weight": query.weight, "exclude_terms": list(query.exclude_terms), "enabled": query.enabled} for query in app.search_queries]})
                return
            if path == "/api/search-criteria/defaults":
                self.send_json(200, {"queries": [{"term": query.term, "location": query.location, "stream": query.stream} for query in DEFAULT_QUERIES]})
                return
            if path == "/api/search-criteria/suggestions":
                self.send_json(200, {"queries": app.suggested_search_queries()})
                return
            if path.startswith("/api/jobs/") and path.endswith("/generate-status"):
                job_id = path.removeprefix("/api/jobs/").removesuffix("/generate-status")
                app._recover_generated_documents(job_id)
                status = app.generation_progress.get(job_id, {"phase": "Queued", "estimate_seconds": 15, "progress": 0})
                if not status.get("done") and status.get("started_at"):
                    status = {**status, **app._generation_status(job_id, status["started_at"])}
                if status.get("done"):
                    status = {**status, "status": "done"}
                self.send_json(200, status)
                return
            if path.startswith("/applications/"):
                target = (app.data_dir / path.removeprefix("/applications/")).resolve()
                if target.parent == (app.data_dir / "applications").resolve() and target.is_file():
                    data = target.read_bytes()
                    self.send_response(200)
                    content_type = "application/pdf" if target.suffix.lower() == ".pdf" else "text/markdown; charset=utf-8"
                    self.send_header("Content-Type", content_type)
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    return
            asset = Path(__file__).parent / "static" / ("index.html" if path == "/" else path.removeprefix("/"))
            if asset.is_file():
                data = asset.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", mimetypes.guess_type(asset.name)[0] or "text/plain")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            self.send_json(404, {"error": "not found"})

        def do_POST(self):
            path = urlparse(self.path).path
            try:
                if path.startswith("/api/jobs/") and path.endswith("/compare"):
                    job_id = path.removeprefix("/api/jobs/").removesuffix("/compare")
                    self.send_json(202, {"status": "queued", **app.start_compare(job_id)})
                    return
                if path.startswith("/api/compare/") and path.endswith("/retry"):
                    comparison_id = path.removeprefix("/api/compare/").removesuffix("/retry")
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    self.send_json(202, {"status": "queued", **app.retry_compare_model(comparison_id, payload["model_id"])})
                    return
                if path.startswith("/api/compare/") and path.endswith("/select"):
                    comparison_id = path.removeprefix("/api/compare/").removesuffix("/select")
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    self.send_json(200, app.select_compare_output(comparison_id, payload["model_id"]))
                    return
                if path == "/api/refresh":
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    queries = [SearchQuery(item["term"], item.get("location", "Melbourne, VIC"), item.get("stream", "core-it"), item.get("group", ""), float(item.get("weight", 1.0)), tuple(item.get("exclude_terms", [])), bool(item.get("enabled", True))) for item in payload.get("queries", [])]
                    jobs, errors = app.refresh(queries)
                    self.send_json(200, {"jobs": jobs, "errors": errors})
                    return
                if path == "/api/search-criteria":
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    self.send_json(200, {"queries": app.update_search_queries(payload.get("queries", []))})
                    return
                if path == "/api/gmail/scan":
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    username = payload.get("username") or os.getenv("GMAIL_USERNAME")
                    app_password = os.getenv("GMAIL_APP_PASSWORD")
                    days = max(1, min(7, int(payload.get("days", 7))))
                    self.send_json(200, app.scan_gmail(username, app_password, days))
                    return
                if path == "/api/tracker/sync":
                    self.send_json(200, app.sync_tracker())
                    return
                if path.startswith("/api/jobs/") and path.endswith("/generate"):
                    job_id = path.removeprefix("/api/jobs/").removesuffix("/generate")
                    status = app.start_generation(job_id)
                    self.send_json(200, {"status": "queued", **status})
                    return
                if path.startswith("/api/jobs/") and path.endswith("/generate-status"):
                    job_id = path.removeprefix("/api/jobs/").removesuffix("/generate-status")
                    status = app.generation_progress.get(job_id, {"phase": "Queued", "estimate_seconds": 15, "progress": 0})
                    if status.get("done"):
                        status = {**status, "status": "done"}
                    self.send_json(200, status)
                    return
                if path.startswith("/api/jobs/") and path.endswith("/generate-final"):
                    job_id = path.removeprefix("/api/jobs/").removesuffix("/generate-final")
                    app._recover_generated_documents(job_id)
                    status = app.generation_progress.get(job_id, {})
                    if not status.get("done"):
                        self.send_json(409, {"error": "Documents are still being generated"})
                        return
                    self.send_json(200, app.generated_documents[job_id])
                    return
                if path.startswith("/api/jobs/") and path.endswith("/status"):
                    job_id = path.removeprefix("/api/jobs/").removesuffix("/status")
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    self.send_json(200, app.update_status(job_id, payload["status"]))
                    return
                self.send_json(404, {"error": "not found"})
            except Exception as error:
                self.send_json(500, {"error": str(error)})

        def log_message(self, *_args):
            return

    return Handler


def serve(app: DashboardApp, host: str = "127.0.0.1", port: int = 8787):
    server = ThreadingHTTPServer((host, port), make_handler(app))
    print(f"Job dashboard running at http://{host}:{port}")
    server.serve_forever()
