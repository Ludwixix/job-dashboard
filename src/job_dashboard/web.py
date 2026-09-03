from __future__ import annotations

import csv
import io
import json
import mimetypes
import os

import time
login_attempts = {}


import re
import threading
import sqlite3
import time
import urllib.error
import urllib.request
import bcrypt
import jwt
import uuid
import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from .ai_resume_analyzer import get_resume_analyzer
from .auto_apply import auto_apply_manager
from .career_recommender import get_career_recommender
from .interview_simulator import get_interview_simulator
from .compare import COMPARE_MODELS, CompareRunner
from .documents import generate_documents
from .email_connector import GmailApiScanner, GmailScanner
from .gcs_backup import backup_to_gcs
from .health import get_health_check
from .logging import get_logger
from .normalize import normalize_job
from .predictive_analytics import get_predictive_analytics
from .repository import JobRepository
from .models import Job
from .score import explain_score, score_job
from .scrape_config import DEFAULT_QUERIES
from .service import JobDashboard
from .smart_applications import get_smart_application_tracker
from .sources import SearchQuery, ScrapePipeline, clean_description, deduplicate_jobs, ensure_descriptions, is_recent, posted_age
from datetime import timedelta
from urllib.error import URLError


logger = get_logger("job_dashboard.web")
TRACKER_CSV_URL = os.environ.get("JOB_DASHBOARD_TRACKER_CSV_URL", "")




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
        self.health_check = get_health_check(self.data_dir)
        self.db = self.repository
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
        # Phase 6: Smart Application Tracker
        self.application_tracker = get_smart_application_tracker(self.data_dir)
        self.lock = threading.Lock()
        self.db_ready_event = threading.Event()
        if self.jobs:
            if self.repository.count_jobs() == 0:
                logger.info(f"Seeding database with {len(self.jobs)} scraped jobs...")
                def _seed():
                    try:
                        self.repository.upsert_scraped_jobs(self.jobs)
                    finally:
                        self.db_ready_event.set()
                threading.Thread(target=_seed, daemon=True).start()
            else:
                self.db_ready_event.set()
        else:
            self.db_ready_event.set()

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
        candidate_paths = [
            self.jobs_path,
            Path(__file__).parent / "static" / "jobs_combined.json",
            Path(__file__).parent / "static" / "demo_jobs.json",
            self.data_dir / "jobs_combined.json",
            Path("/app/src/job_dashboard/static/jobs_combined.json"),
            Path("/app/data/jobs.json"),
            Path(__file__).resolve().parents[3] / "job-dashboard-react" / "public" / "jobs_combined.json",
            Path(__file__).resolve().parents[3] / "job-dashboard-site" / "scrapers" / "jobs_combined.json",
        ]
        for p in candidate_paths:
            if p and p.exists():
                try:
                    raw_data = json.loads(p.read_text(encoding="utf-8"))
                    jobs = raw_data if isinstance(raw_data, list) else (raw_data.get("jobs", []) if isinstance(raw_data, dict) else [])
                    if jobs:
                        logger.info(f"Loaded {len(jobs)} jobs from {p}")
                        return jobs
                except Exception as e:
                    logger.error(f"Error loading jobs from {p}: {e}")
        return []

    def save_jobs(self):
        self.jobs_path.write_text(json.dumps({"jobs": self.jobs}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        self.repository.replace_jobs(self.jobs)

    def materialize_jobs(self, jobs):
        materialized = []
        skipped = []
        for raw in jobs:
            # Confidential/blank-company ads are still valid postings — coerce
            # rather than reject, since a single unnormalizable job previously
            # raised and aborted materialization for the entire batch.
            candidate = dict(raw)
            if not str(candidate.get("company") or "").strip():
                candidate["company"] = "Confidential"
            try:
                job = normalize_job(candidate)
                analysis = self.dashboard.analyse(candidate)
            except Exception as error:
                logger.warning(f"Skipping unnormalizable job during materialization: {error}")
                skipped.append({"job": candidate, "error": str(error)})
                continue
            item = dict(candidate)
            item.update({"id": job.id, "score": analysis.score.score, "stream": analysis.stream, "fit_category": analysis.fit_category, "dimensions": analysis.score.dimensions, "matched_skills": analysis.score.matched_skills, "missing_skills": analysis.score.missing_skills, "description": clean_description(job.description)})
            materialized.append(item)
        self.last_skipped_jobs = skipped
        return materialized

    def analyses(self):
        return [self.dashboard.analyse(job) for job in self.jobs]

    def rejected_applications(self):
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
    
    # Phase 6: Smart Application Methods
    def add_smart_application(self, job_id: str, job_title: str, company: str, 
                             application_type: str = "direct", match_score: float = 0.0,
                             application_url: str = None) -> dict:
        """Add a new smart application to track."""
        from .smart_applications import ApplicationType
        
        app_type = ApplicationType(application_type.lower())
        application = self.application_tracker.add_application(
            job_id=job_id,
            job_title=job_title,
            company=company,
            application_type=app_type,
            match_score=match_score,
            application_url=application_url
        )
        return application.to_dict()
    
    def update_application_status(self, application_id: str, status: str, notes: str = None) -> dict:
        """Update application status."""
        from .smart_applications import ApplicationStatus
        
        app_status = ApplicationStatus(status.lower())
        application = self.application_tracker.update_status(application_id, app_status, notes)
        if application:
            return application.to_dict()
        return {"error": "Application not found"}
    
    def get_smart_applications(self, status: str = None) -> list:
        """Get smart applications filtered by status."""
        from .smart_applications import ApplicationStatus
        
        if status:
            app_status = ApplicationStatus(status.lower())
            applications = self.application_tracker.get_applications_by_status(app_status)
        else:
            applications = self.application_tracker.get_applications_by_status()
        
        return [app.to_dict() for app in applications]
    
    def get_application_statistics(self) -> dict:
        """Get application statistics."""
        return self.application_tracker.get_statistics()
    
    def get_upcoming_follow_ups(self, days: int = 7) -> list:
        """Get applications with upcoming follow-ups."""
        applications = self.application_tracker.get_upcoming_follow_ups(days)
        return [app.to_dict() for app in applications]
    
    def get_overdue_follow_ups(self) -> list:
        """Get applications with overdue follow-ups."""
        applications = self.application_tracker.get_overdue_follow_ups()
        return [app.to_dict() for app in applications]
    
    def set_application_follow_up(self, application_id: str, days_from_now: int = 7) -> dict:
        """Schedule a follow-up for an application."""
        application = self.application_tracker.set_follow_up(application_id, days_from_now)
        if application:
            return application.to_dict()
        return {"error": "Application not found"}
    
    def add_application_note(self, application_id: str, note: str) -> dict:
        """Add a note to an application."""
        application = self.application_tracker.add_note(application_id, note)
        if application:
            return application.to_dict()
        return {"error": "Application not found"}
    
    def search_smart_applications(self, query: str) -> list:
        """Search applications by company, job title, or notes."""
        applications = self.application_tracker.search_applications(query)
        return [app.to_dict() for app in applications]
    
    def delete_smart_application(self, application_id: str) -> dict:
        """Delete an application."""
        success = self.application_tracker.delete_application(application_id)
        return {"success": success}

    def public_jobs(self, filters=None):
        filters = filters or {}
        # SQLite repository is the single source of truth
        stored = self.repository.list_jobs(**filters)
        result = []
        for stored_job in stored:
            if str(stored_job.get("source", "")).lower() == "gmail":
                continue
            if not filters.get("status") and stored_job.get("status", "sourced") != "sourced":
                continue
            if not filters.get("status") and (stored_job.get("status") == "rejected" or not self._has_recent_activity(stored_job)):
                continue

            job_id = stored_job.get("id")
            raw_memory = next((j for j in self.jobs if j.get("id") == job_id or j.get("url") == stored_job.get("url")), {})
            posted = stored_job.get("posted") or raw_memory.get("posted", "")
            generated = raw_memory.get("generated") or self.generated_documents.get(job_id)
            email_events = stored_job.get("email_events") or raw_memory.get("email_events", [])
            email_id = email_events[-1].get("email_id") if email_events else ""

            # Extract analysis or compute from stored job data
            analysis = self.dashboard.analyse(stored_job)

            result.append({
                "id": job_id,
                "title": stored_job.get("title", ""),
                "company": stored_job.get("company", ""),
                "location": stored_job.get("location", ""),
                "description": clean_description(stored_job.get("description", "")),
                "source": stored_job.get("source", ""),
                "url": stored_job.get("url", ""),
                "email_url": f"https://mail.google.com/mail/u/0/#all/{email_id}" if email_id else "",
                "salary": stored_job.get("salary") or raw_memory.get("salary", ""),
                "posted": posted,
                "posted_age": posted_age(posted),
                "remote": bool(stored_job.get("remote", False)),
                "stream": stored_job.get("stream") or analysis.stream,
                "fit_category": stored_job.get("fit_category") or analysis.fit_category,
                "score": stored_job.get("score") if stored_job.get("score") is not None else analysis.score.score,
                "fit": analysis.score.fit,
                "matched_skills": analysis.score.matched_skills,
                "missing_skills": analysis.score.missing_skills,
                "dimensions": analysis.score.dimensions,
                "generated": generated,
                "status": stored_job.get("status", "sourced"),
            })
        return result

    @staticmethod
    def _has_recent_activity(job, days: int = 30):
        dates = [job.get("posted", "")]
        dates.extend(event.get("received_at", "") for event in job.get("email_events", []))
        return any(value and is_recent({"posted": value}, days=days) for value in dates)

    def refresh(self, queries, force: bool = False, ttl_hours: float = 12.0, on_progress=None):
        with self.lock:
            queries_to_scrape = []
            cached_query_terms = []

            for q in queries:
                term = q.term if hasattr(q, "term") else str(q.get("term", ""))
                loc = q.location if hasattr(q, "location") else str(q.get("location", ""))

                if not force and self.repository.is_query_cached(term, loc, ttl_hours=ttl_hours):
                    cached_query_terms.append(term)
                else:
                    queries_to_scrape.append(q)

            pipeline_errors = []
            if queries_to_scrape:
                if on_progress:
                    on_progress(f"Scanning {len(queries_to_scrape)} live employment gateway queries...", 10)
                pipeline = ScrapePipeline(self.sources, days=14, health_check=self.health_check)
                fresh = pipeline.run(queries_to_scrape, on_progress=on_progress)
                pipeline_errors = pipeline.errors

                if fresh:
                    if on_progress:
                        on_progress("Saving & indexing positions...", 90)
                    # Materialize fresh jobs
                    fresh_materialized = self.materialize_jobs(fresh)
                    # Rebuild merged_jobs from current self.jobs at merge point under lock
                    existing_ids = {job.get("id") for job in self.jobs if job.get("id")}
                    merged_jobs = list(self.jobs)

                    for job in fresh_materialized:
                        job_id = job.get("id")
                        if job_id and job_id not in existing_ids:
                            merged_jobs.append(job)
                            existing_ids.add(job_id)

                    self.jobs = merged_jobs
                    self.save_jobs()
                    from .config import settings
                    if settings.gcs_data_bucket:
                        backup_to_gcs(settings.gcs_data_bucket, self.data_dir)

                # Record cache hit timestamps for freshly scraped queries
                for q in queries_to_scrape:
                    term = q.term if hasattr(q, "term") else str(q.get("term", ""))
                    loc = q.location if hasattr(q, "location") else str(q.get("location", ""))
                    self.repository.record_query_scrape(term, loc, len(fresh or []))
            elif on_progress:
                on_progress(f"All {len(cached_query_terms)} queries already fresh (cached), skipping re-scan...", 60)

            # Recalibrate/score all database jobs against current profile
            self.jobs = self.materialize_jobs(self.jobs)

            stats = {
                "total_jobs": len(self.jobs),
                "queries_scraped": len(queries_to_scrape),
                "queries_cached": len(cached_query_terms),
                "cache_hit": len(queries_to_scrape) == 0,
                "cached_terms": cached_query_terms,
                "skipped_jobs_count": len(getattr(self, "last_skipped_jobs", [])),
                "skipped_jobs": getattr(self, "last_skipped_jobs", []),
            }
            return self.public_jobs(), pipeline_errors, stats


    @staticmethod
    def _gmail_job_details(message):
        subject = re.sub(r"^\s*(re|fw|fwd)\s*:\s*", "", message.subject, flags=re.IGNORECASE).strip()
        match = re.search(r"(?:application|applying|applied|interest|submission).*?(?:for|to|:)[\s\-]*(.+?)\s+(?:at|with)\s+(.+)$", subject, re.IGNORECASE)
        if match:
            title, company = match.groups()
        else:
            title = subject or "Gmail application"
            company = ""
            domain = re.search(r"@([\w.-]+)", message.from_address)
            if domain:
                company = domain.group(1).split(".")[0].replace("-", " ").title()
        title = re.sub(r"\s+(?:application|received|confirmation|confirmed)$", "", title, flags=re.IGNORECASE).strip(" .:-")
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
        with self.lock:
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
        if not TRACKER_CSV_URL:
            self.tracker_state = {**self.tracker_state, "status": "idle", "rows": 0, "matched": 0}
            return self.tracker_state
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

# Phase 4B: Advanced AI Features
    def analyze_resume_ai(self, resume_text: str) -> dict:
        """AI-powered resume analysis."""
        analyzer = get_resume_analyzer()
        return analyzer.analyze(resume_text)
    
    def simulate_interview(self, job_description: str, role: str, question_count: int = 5) -> dict:
        """Simulate an interview for a job."""
        simulator = get_interview_simulator()
        return simulator.create_session(job_description, role, question_count)
    
    def submit_interview_answer(self, session_id: str, question_id: str, answer: str) -> dict:
        """Submit answer to interview question."""
        simulator = get_interview_simulator()
        return simulator.submit_answer(session_id, question_id, answer)
    
    def get_interview_feedback(self, session_id: str) -> dict:
        """Get feedback for completed interview session."""
        simulator = get_interview_simulator()
        return simulator.get_feedback(session_id)
    
    def analyze_interview_performance(self, session_id: str) -> dict:
        """Analyze overall interview performance."""
        simulator = get_interview_simulator()
        return simulator.analyze_performance(session_id)
    
    def get_predictive_analytics(self, forecast_days: int = 30) -> dict:
        """Get predictive analytics for current job market."""
        analyzer = get_predictive_analytics()
        return analyzer.predict_market_trends(self.jobs, forecast_days)
    
    def get_application_timing_recommendations(self) -> dict:
        """Get recommendations for optimal application timing."""
        analyzer = get_predictive_analytics()
        return analyzer.recommend_timing(self.jobs)
    
    def analyze_skill_gap(self, user_skills: list, target_role: str) -> dict:
        """Analyze skill gap for a target role."""
        recommender = get_career_recommender()
        return recommender.analyze_skill_gap(user_skills, target_role, self.jobs)
    
    def recommend_career_paths(self, user_skills: list, user_interests: list) -> list:
        """Recommend career paths based on skills and interests."""
        recommender = get_career_recommender()
        return recommender.recommend_paths(user_skills, user_interests, self.jobs)
    
    def get_interview_statistics(self) -> dict:
        """Get interview simulation statistics."""
        simulator = get_interview_simulator()
        return simulator.get_statistics()
    
    def reset_interview_simulator(self) -> dict:
        """Reset interview simulator data."""
        simulator = get_interview_simulator()
        return simulator.reset_data()
    
    # End Phase 4B Features
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


def resolve_user_id(handler, query_params=None) -> str | None:
    """
    Resolve the authenticated user ID from Authorization Bearer token,
    explicit X-User-Id header, or query parameters.
    Returns None if no user identity is provided.
    """
    auth_header = handler.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            sub = payload.get("sub")
            if sub:
                return str(sub)
        except Exception:
            pass
    uid = handler.headers.get("X-User-Id")
    if uid and str(uid).strip():
        return str(uid).strip()
    if query_params and "user_id" in query_params:
        param_val = str(query_params["user_id"][0]).strip()
        if param_val:
            return param_val
    # Explicit demo/guest parameter support if requested
    if query_params and query_params.get("demo", [""])[0].lower() in ("true", "1"):
        return "demo_user"
    return None


# Allowed origins — GitHub Pages deployment + localhost dev + Cloud Run
_ALLOWED_ORIGINS = {
    "https://ludwixix.github.io",
    "https://job-dashboard-6xrdvjlrcq-ts.a.run.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8787",
    "http://localhost:8080",
}

def make_handler(app: DashboardApp):
    class Handler(BaseHTTPRequestHandler):
        def _cors_origin(self):
            origin = self.headers.get("Origin", "")
            if origin in _ALLOWED_ORIGINS:
                return origin
            return ""

        def _send_cors_headers(self):
            origin = self._cors_origin()
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-User-Id")
            self.send_header("Access-Control-Max-Age", "86400")

        def do_OPTIONS(self):
            """Handle CORS preflight requests."""
            self.send_response(204)
            self._send_cors_headers()
            self.end_headers()

        def send_json(self, status, payload):
            # Provider metadata occasionally contains a date/decimal object;
            # one such value must not turn an otherwise successful refresh
            # into an opaque HTTP 500 while serializing a large response.
            data = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            parsed = urlparse(self.path)
            path = parsed.path
            query_params = parse_qs(parsed.query)

            if path == "/api/session":
                auth_header = self.headers.get("Authorization")
                if not auth_header or not auth_header.startswith("Bearer "):
                    self.send_json(401, {"error": "Missing or invalid token"})
                    return
                
                token = auth_header.split(" ")[1]
                try:
                    payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
                    self.send_json(200, {
                        "success": True,
                        "user": {
                            "id": payload.get("sub"),
                            "email": payload.get("email"),
                            "name": payload.get("name")
                        }
                    })
                except Exception as e:
                    self.send_json(401, {"error": str(e)})
                return

            if path == "/api/jobs":
                app.db_ready_event.wait(timeout=10.0)
                page = int(query_params.get("page", ["1"])[0])
                page_size = int(query_params.get("pageSize", ["50"])[0])
                search = query_params.get("search", [""])[0]
                industry = query_params.get("industry", [""])[0]
                remote_param = query_params.get("remote", [None])[0]
                remote = None if remote_param is None else (remote_param.lower() in ("true", "1"))
                sort_by = query_params.get("sortBy", ["newest"])[0]
                
                if app.repository.count_jobs() == 0:
                    if not app.jobs:
                        app.jobs = app._load_jobs()
                    if app.jobs:
                        logger.info(f"Seeding database with {len(app.jobs)} jobs on demand...")
                        app.repository.upsert_scraped_jobs(app.jobs)

                result = app.repository.query_jobs_paginated(
                    page=page,
                    page_size=page_size,
                    search=search,
                    industry=industry,
                    remote=remote,
                    sort_by=sort_by
                )
                self.send_json(200, result)
                return

            if path == "/api/profile":
                user_id = resolve_user_id(self, query_params)
                if not user_id:
                    self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                    return
                prof = app.repository.get_user_profile(user_id)
                self.send_json(200, {"success": True, "profile": prof})
                return

            if path == "/api/preferences":
                user_id = resolve_user_id(self, query_params)
                if not user_id:
                    self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                    return
                prefs = app.repository.get_user_preferences(user_id)
                self.send_json(200, {"success": True, "preferences": prefs})
                return

            if path == "/api/saved-searches":
                user_id = resolve_user_id(self, query_params)
                if not user_id:
                    self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                    return
                self.send_json(200, {"success": True, "saved_searches": app.repository.list_saved_searches(user_id)})
                return

            if path == "/api/reminders":
                user_id = resolve_user_id(self, query_params)
                if not user_id:
                    self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                    return
                include_future = query_params.get("include_future", ["false"])[0].lower() in ("1", "true")
                self.send_json(200, {"success": True, "reminders": app.repository.list_due_reminders(user_id, include_future)})
                return

            if path == "/api/source-health":
                hours = max(1, min(168, int(query_params.get("hours", ["24"])[0])))
                self.send_json(200, {"success": True, "checks": app.health_check.get_recent_checks(hours=hours)})
                return

            if path == "/api/job-explanation":
                user_id = resolve_user_id(self, query_params)
                if not user_id:
                    self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                    return
                job_id = query_params.get("job_id", [""])[0]
                job_data = app.repository.get_job(job_id)
                if not job_data:
                    self.send_json(404, {"error": "Job not found"})
                    return
                profile = app.repository.get_user_profile(user_id) or app.dashboard.profile
                fields = {key: job_data.get(key, "") for key in Job.__dataclass_fields__}
                fields["tags"] = tuple(job_data.get("tags") or ())
                self.send_json(200, {"success": True, "explanation": explain_score(score_job(Job(**fields), profile))})
                return

            if path == "/api/documents":
                user_id = resolve_user_id(self, query_params)
                if not user_id:
                    self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                    return
                job_id = query_params.get("job_id", [""])[0]
                doc_type = query_params.get("doc_type", ["resume"])[0]
                doc = app.repository.get_generated_document(user_id, job_id, doc_type)
                self.send_json(200, {"success": True, "document": doc})
                return

            if path == "/api/psychology":
                job_id = query_params.get("job_id", [""])[0]
                psy = app.repository.get_job_psychology(job_id)
                self.send_json(200, {"success": True, "psychology": psy})
                return

            if path == "/api/interview-sessions":
                user_id = resolve_user_id(self, query_params)
                if not user_id:
                    self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                    return
                job_id = query_params.get("job_id", [""])[0] or None
                sessions = app.repository.get_interview_sessions(user_id, job_id)
                self.send_json(200, {"success": True, "sessions": sessions})
                return

            if path == "/api/applications":
                user_id = resolve_user_id(self, query_params)
                if not user_id:
                    self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                    return
                apps = app.repository.get_user_applications(user_id)
                self.send_json(200, {"success": True, "applications": apps})
                return


            if path == "/api/verify-job-url":
                query_params = parse_qs(parsed.query)
                target_url = query_params.get("url", [""])[0]
                force = query_params.get("force", ["false"])[0].lower() in ("true", "1")
                if not target_url:
                    self.send_json(400, {"error": "Missing url parameter"})
                    return
                from .verifier import verify_job_url
                res = verify_job_url(target_url, force=force)
                self.send_json(200, res)
                return

            if path == "/health":
                import time

                self.send_json(200, {
                    "status": "healthy",
                    "timestamp": time.time(),
                    "version": "1.0.0",
                    "services": {
                        "database": True,
                        "cache": True,
                        "jobs_count": len(app.jobs)
                    }
                })
                return

            
            # Prometheus metrics endpoint
            if path == "/metrics":
                try:
                    from .metrics import get_metrics
                    metrics = get_metrics()
                    self.send_response(200)
                    self.send_header("Content-Type", "text/plain; version=0.0.4")
                    self.end_headers()
                    self.wfile.write(metrics.get_metrics().encode())
                    return
                except ImportError:
                    self.send_json(200, {"metrics": "not_available"})
                    return
            if path in ("/api/jobs", "/api/scraped-jobs"):
                query = parse_qs(parsed.query)
                filters = {key: query[key][0] for key in ("location", "role", "source", "stream", "status") if key in query}
                filters["match_score_min"] = int(query.get("match_score_min", [0])[0])
                jobs = app.public_jobs(filters)
                self.send_json(200, {"success": True, "jobs": jobs})
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
            
            # Phase 4B: Advanced AI Features endpoints
            if path == "/api/ai/resume-analyze":
                # Parse query parameters for resume text
                query = parse_qs(parsed.query)
                resume_text = query.get("text", [""])[0]
                if not resume_text:
                    self.send_json(400, {"error": "Resume text required"})
                    return
                result = app.analyze_resume_ai(resume_text)
                self.send_json(200, result)
                return
            
            if path == "/api/ai/interview-statistics":
                result = app.get_interview_statistics()
                self.send_json(200, result)
                return
            
            if path == "/api/ai/predictive-analytics":
                query = parse_qs(parsed.query)
                days = int(query.get("days", [30])[0])
                result = app.get_predictive_analytics(days)
                self.send_json(200, result)
                return
            
            if path == "/api/ai/timing-recommendations":
                result = app.get_application_timing_recommendations()
                self.send_json(200, result)
                return
            
            # Interview session endpoints
            if path.startswith("/api/ai/interview/") and path.endswith("/feedback"):
                session_id = path.removeprefix("/api/ai/interview/").removesuffix("/feedback")
                result = app.get_interview_feedback(session_id)
                self.send_json(200, result)
                return
            
            if path.startswith("/api/ai/interview/") and path.endswith("/performance"):
                session_id = path.removeprefix("/api/ai/interview/").removesuffix("/performance")
                result = app.analyze_interview_performance(session_id)
                self.send_json(200, result)
                return
            
            if path == "/api/scrape/stream":
                self.send_response(200)
                self.send_header('Content-Type', 'text/event-stream')
                self.send_header('Cache-Control', 'no-cache')
                self.send_header('Connection', 'keep-alive')
                self._send_cors_headers()
                self.end_headers()
                
                def on_progress(stage, pct):
                    try:
                        msg = json.dumps({"stage": stage, "percent": pct})
                        self.wfile.write(f"data: {msg}\n\n".encode('utf-8'))
                        self.wfile.flush()
                    except Exception:
                        pass

                queries = app.search_queries
                on_progress("Connecting to job gateways...", 5)
                try:
                    app.refresh(queries, force=False, ttl_hours=12.0, on_progress=on_progress)
                    on_progress("Discovery Complete", 100)
                except Exception as scrape_err:
                    logger.warning(f"Live scrape stream warning: {scrape_err}")
                    on_progress("Discovery complete (cached fallback)", 100)
                
                try:
                    self.wfile.write(b"data: [DONE]\n\n")
                    self.wfile.flush()
                except Exception:
                    pass
                return

            if path.startswith("/api/auto-apply/") and path.endswith("/status"):
                task_id = path.removeprefix("/api/auto-apply/").removesuffix("/status")
                task = auto_apply_manager.get_task(task_id)
                if not task:
                    self.send_json(404, {"error": "Auto-apply task not found"})
                    return
                self.send_json(200, task.to_dict())
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
            static_dir = Path(__file__).parent / "static"
            target_asset = (static_dir / path.removeprefix("/")).resolve()
            if target_asset.is_file() and str(target_asset).startswith(str(static_dir.resolve())):
                data = target_asset.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", mimetypes.guess_type(target_asset.name)[0] or "text/plain")
                self.send_header("Content-Length", str(len(data)))
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(data)
                return

            if path == "/" or (not path.startswith("/api/") and not path.startswith("/health") and not path.startswith("/metrics")):
                index_html = static_dir / "index.html"
                if index_html.is_file():
                    data = index_html.read_bytes()
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header("Content-Length", str(len(data)))
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(data)
                    return

            self.send_json(404, {"error": "not found"})

        def do_POST(self):
            parsed = urlparse(self.path)
            path = parsed.path
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
                
                if path == "/api/profile":
                    user_id = resolve_user_id(self)
                    if not user_id:
                        self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                        return
                    content_len = int(self.headers.get("Content-Length", "0"))
                    body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    res = app.repository.upsert_user_profile(user_id, body)
                    self.send_json(200, {"success": True, "profile": res})
                    return

                if path == "/api/preferences":
                    user_id = resolve_user_id(self)
                    if not user_id:
                        self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                        return
                    content_len = int(self.headers.get("Content-Length", "0"))
                    body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    res = app.repository.upsert_user_preferences(user_id, body)
                    self.send_json(200, {"success": True, "preferences": res})
                    return

                if path == "/api/saved-searches":
                    user_id = resolve_user_id(self)
                    if not user_id:
                        self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                        return
                    content_len = int(self.headers.get("Content-Length", "0"))
                    body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    saved = app.repository.upsert_saved_search(user_id, str(body.get("name") or ""), body.get("query") or {}, str(body.get("id") or ""))
                    self.send_json(200, {"success": True, "saved_search": saved})
                    return

                if path == "/api/reminders":
                    user_id = resolve_user_id(self)
                    if not user_id:
                        self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                        return
                    content_len = int(self.headers.get("Content-Length", "0"))
                    body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    reminder = app.repository.create_reminder(user_id, str(body.get("job_id") or ""), str(body.get("reminder_type") or ""), str(body.get("remind_at") or ""), body.get("details"))
                    self.send_json(201, {"success": True, "reminder": reminder})
                    return

                if path == "/api/reminders/dismiss":
                    user_id = resolve_user_id(self)
                    if not user_id:
                        self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                        return
                    self.send_json(200, {"success": dismissed})
                    return

                if path == "/api/documents":
                    user_id = resolve_user_id(self)
                    if not user_id:
                        self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                        return
                    content_len = int(self.headers.get("Content-Length", "0"))
                    body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    job_id = str(body.get("job_id") or "")
                    doc_type = str(body.get("doc_type") or "resume")
                    content_text = str(body.get("content_text") or body.get("text") or "")
                    model_name = str(body.get("model_name") or "")
                    metadata = body.get("metadata") or {}
                    doc = app.repository.upsert_generated_document(user_id, job_id, doc_type, content_text, model_name, metadata)
                    self.send_json(200, {"success": True, "document": doc})
                    return

                if path == "/api/psychology":
                    content_len = int(self.headers.get("Content-Length", "0"))
                    body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    job_id = str(body.get("job_id") or "")
                    company = str(body.get("company") or "")
                    title = str(body.get("title") or "")
                    insights = body.get("insights") or {}
                    model_name = str(body.get("model_name") or "")
                    psy = app.repository.upsert_job_psychology(job_id, company, title, insights, model_name)
                    self.send_json(200, {"success": True, "psychology": psy})
                    return

                if path == "/api/interview-sessions":
                    user_id = resolve_user_id(self)
                    if not user_id:
                        self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                        return
                    content_len = int(self.headers.get("Content-Length", "0"))
                    body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    job_id = str(body.get("job_id") or "")
                    company = str(body.get("company") or "")
                    title = str(body.get("title") or "")
                    session_data = body.get("session_data") or body
                    score = float(body.get("score") or 0.0)
                    sess = app.repository.save_interview_session(user_id, job_id, company, title, session_data, score)
                    self.send_json(200, {"success": True, "session": sess})
                    return

                if path == "/api/applications":
                    user_id = resolve_user_id(self)
                    if not user_id:
                        self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                        return
                    content_len = int(self.headers.get("Content-Length", "0"))
                    body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    job_id = str(body.get("job_id") or body.get("id") or "").strip()
                    if not job_id:
                        self.send_json(400, {"error": "Missing job_id"})
                        return
                        
                    app_rec = app.repository.upsert_user_application(user_id, job_id, body)
                    self.send_json(200, {"success": True, "application": app_rec})
                    return

                if path == "/api/applications/sync":
                    user_id = resolve_user_id(self)
                    if not user_id:
                        self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                        return
                    content_len = int(self.headers.get("Content-Length", "0"))
                    body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    apps_list = body.get("applications") or []
                    synced = []
                    for item in apps_list:
                        jid = str(item.get("job_id") or item.get("id") or "").strip()
                        if jid:
                            synced.append(app.repository.upsert_user_application(user_id, jid, item))
                    self.send_json(200, {"success": True, "synced_count": len(synced), "applications": app.repository.get_user_applications(user_id)})
                    return

                if path == "/api/applications/scan-updates":
                    user_id = resolve_user_id(self)
                    if not user_id:
                        self.send_json(401, {"success": False, "error": "Authentication required. Provide Authorization token or X-User-Id header."})
                        return
                    content_len = int(self.headers.get("Content-Length", "0"))
                    body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    username = body.get("username")
                    app_password = body.get("app_password")
                    target_job_id = body.get("job_id")
                    days = int(body.get("days") or 14)

                    if not username or not app_password:
                        self.send_json(400, {"error": "Missing Gmail username or app_password"})
                        return

                    from .email_connector import GmailScanner
                    scanner = GmailScanner(username=username, app_password=app_password, days=days)

                    apps = app.repository.get_user_applications(user_id)
                    if target_job_id:
                        apps = [a for a in apps if a.get("job_id") == target_job_id or a.get("id") == target_job_id]

                    scan_results = scanner.scan_updates_for_all_applications(apps, days=days)
                    updates_applied = []

                    for res in scan_results:
                        if res.get("updated"):
                            jid = res.get("job_id")
                            new_st = res.get("new_status")
                            subj = res.get("email_subject", "")
                            snip = res.get("email_snippet", "")
                            edate = res.get("email_date", "")
                            th_id = res.get("email_thread_id", "")
                            app.repository.update_application_status_from_email(
                                user_id=user_id,
                                job_id=jid,
                                new_status=new_st,
                                email_subject=subj,
                                email_snippet=snip,
                                email_date=edate,
                                email_thread_id=th_id
                            )
                            updates_applied.append(res)

                    self.send_json(200, {
                        "success": True,
                        "scanned_count": len(apps),
                        "updates_count": len(updates_applied),
                        "updates": updates_applied,
                        "applications": app.repository.get_user_applications(user_id)
                    })
                    return

                if path == "/api/passkey-login":
                    content_len = int(self.headers.get("Content-Length", "0"))
                    payload = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    
                    email = payload.get("email") or "passkey.user@example.com"
                    name = payload.get("name") or "Verified Passkey User"
                    user_id = payload.get("credential_id") or f"passkey_{uuid.uuid4()}"
                    
                    # Generate authentic JWT token
                    now = datetime.datetime.utcnow()
                    token = jwt.encode({
                        "sub": user_id,
                        "email": email,
                        "name": name,
                        "exp": now + datetime.timedelta(days=7)
                    }, JWT_SECRET, algorithm="HS256")
                    
                    self.send_json(200, {
                        "success": True,
                        "token": token,
                        "user": {
                            "id": user_id,
                            "email": email,
                            "name": name
                        }
                    })
                    return

                if path == "/api/google-login":
                    content_len = int(self.headers.get("Content-Length", "0"))
                    payload = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    email = (payload.get("email") or "").strip().lower()
                    name = (payload.get("name") or "").strip() or (email.split("@")[0] if email else "Google User")
                    google_id = payload.get("google_id") or payload.get("id") or str(uuid.uuid4())
                    user_id = f"google_{google_id}"
                    
                    if not email:
                        self.send_json(400, {"error": "Missing Google email address"})
                        return
                        
                    now = datetime.datetime.utcnow().isoformat()
                    try:
                        with app.db.get_connection() as conn:
                            cur = conn.cursor()
                            cur.execute("SELECT id, name FROM users WHERE email = ?", (email,))
                            existing = cur.fetchone()
                            if existing:
                                user_id = existing[0]
                                cur.execute("UPDATE users SET name = ? WHERE id = ?", (name, user_id))
                            else:
                                dummy_hash = bcrypt.hashpw(str(uuid.uuid4()).encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                                cur.execute(
                                    "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                                    (user_id, email, name, dummy_hash, now)
                                )
                            conn.commit()
                    except Exception as e:
                        logger.error(f"Error persisting Google user: {e}")
                        
                    token = jwt.encode({
                        "sub": user_id,
                        "email": email,
                        "name": name,
                        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)
                    }, JWT_SECRET, algorithm="HS256")
                    
                    self.send_json(200, {
                        "success": True,
                        "token": token,
                        "user": {
                            "id": user_id,
                            "email": email,
                            "name": name
                        }
                    })
                    return

                if path == "/api/register":
                    content_len = int(self.headers.get("Content-Length", "0"))
                    payload = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    email = payload.get("email")
                    password = payload.get("password")
                    name = payload.get("name", "")
                    
                    
                    client_ip = self.client_address[0]
                    current_time = time.time()
                    
                    # Clean up old attempts
                    for ip in list(login_attempts.keys()):
                        if current_time - login_attempts[ip]['time'] > 60:
                            del login_attempts[ip]
                            
                    if client_ip in login_attempts:
                        if login_attempts[client_ip]['count'] >= 5:
                            if current_time - login_attempts[client_ip]['time'] < 60:
                                self.send_json(429, {"error": "Too many login attempts. Please try again later."})
                                return
                            else:
                                login_attempts[client_ip] = {'count': 1, 'time': current_time}
                        else:
                            login_attempts[client_ip]['count'] += 1
                    else:
                        login_attempts[client_ip] = {'count': 1, 'time': current_time}

                    if not email or not password:
                        self.send_json(400, {"error": "Missing email or password"})
                        return
                        
                    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                    user_id = str(uuid.uuid4())
                    now = datetime.datetime.utcnow().isoformat()
                    
                    try:
                        with app.db.get_connection() as conn:
                            cur = conn.cursor()
                            cur.execute(
                                "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                                (user_id, email, name, password_hash, now)
                            )
                            conn.commit()
                    except sqlite3.IntegrityError:
                        self.send_json(400, {"error": "Email already exists"})
                        return
                    
                    # Create token
                    payload_data = {
                        "sub": user_id,
                        "email": email,
                        "name": name,
                        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRY_HOURS)
                    }
                    token = jwt.encode(payload_data, JWT_SECRET, algorithm="HS256")
                    
                    self.send_json(200, {
                        "success": True,
                        "token": token,
                        "user": {"id": user_id, "email": email, "name": name}
                    })
                    return

                elif path == "/api/login":
                    content_len = int(self.headers.get("Content-Length", "0"))
                    payload = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    email = payload.get("email")
                    password = payload.get("password")
                    
                    
                    client_ip = self.client_address[0]
                    current_time = time.time()
                    
                    # Clean up old attempts
                    for ip in list(login_attempts.keys()):
                        if current_time - login_attempts[ip]['time'] > 60:
                            del login_attempts[ip]
                            
                    if client_ip in login_attempts:
                        if login_attempts[client_ip]['count'] >= 5:
                            if current_time - login_attempts[client_ip]['time'] < 60:
                                self.send_json(429, {"error": "Too many login attempts. Please try again later."})
                                return
                            else:
                                login_attempts[client_ip] = {'count': 1, 'time': current_time}
                        else:
                            login_attempts[client_ip]['count'] += 1
                    else:
                        login_attempts[client_ip] = {'count': 1, 'time': current_time}

                    if not email or not password:
                        self.send_json(400, {"error": "Missing email or password"})
                        return
                        
                    with app.db.get_connection() as conn:
                        cur = conn.cursor()
                        cur.execute("SELECT id, name, password_hash FROM users WHERE email = ?", (email,))
                        row = cur.fetchone()
                        
                    if not row:
                        self.send_json(401, {"error": "Invalid credentials"})
                        return
                        
                    user_id, name, password_hash = row
                    
                    if not bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8')):
                        self.send_json(401, {"error": "Invalid credentials"})
                        return
                        
                    payload_data = {
                        "sub": user_id,
                        "email": email,
                        "name": name,
                        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRY_HOURS)
                    }
                    token = jwt.encode(payload_data, JWT_SECRET, algorithm="HS256")
                    
                    self.send_json(200, {
                        "success": True,
                        "token": token,
                        "user": {"id": user_id, "email": email, "name": name}
                    })
                    return

                elif path == "/api/refresh":
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    raw_queries = payload.get("queries", [])
                    if not isinstance(raw_queries, list):
                        raise ValueError("queries must be a list")
                    queries = []
                    for item in raw_queries:
                        if isinstance(item, str):
                            term = item.strip()
                            location, stream, group, weight, exclude_terms, enabled = "Melbourne, VIC", "core-it", "", 1.0, (), True
                        elif isinstance(item, dict):
                            term = str(item.get("term") or "").strip()
                            location = str(item.get("location") or "Melbourne, VIC")
                            stream = str(item.get("stream") or "core-it")
                            group = str(item.get("group") or "")
                            weight = float(item.get("weight", 1.0))
                            exclude_terms = tuple(str(value) for value in (item.get("exclude_terms") or ()))
                            enabled = bool(item.get("enabled", True))
                        else:
                            continue
                        if term:
                            queries.append(SearchQuery(term, location, stream, group, weight, exclude_terms, enabled))
                    force = bool(payload.get("force", False))
                    ttl_hours = float(payload.get("ttl_hours", 12.0))
                    try:
                        jobs, errors, cache_stats = app.refresh(queries, force=force, ttl_hours=ttl_hours)
                    except Exception as refresh_err:
                        logger.warning(f"/api/refresh scrape failed, returning cached DB jobs: {refresh_err}")
                        # Fall back to returning cached jobs from the SQLite database
                        try:
                            cached_result = app.repository.query_jobs_paginated(page=1, page_size=5000)
                            jobs = cached_result.get("jobs", [])
                        except Exception:
                            jobs = []
                        errors = [str(refresh_err)]
                        cache_stats = {"fallback": True, "total": len(jobs)}
                    self.send_json(200, {
                        "jobs": jobs,
                        "errors": errors,
                        "cache_stats": cache_stats,
                        "success": True
                    })
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
                if path == "/api/verify-jobs":
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    urls = payload.get("urls", [])
                    force = bool(payload.get("force", False))
                    from .verifier import verify_job_urls
                    results = verify_job_urls(urls, force=force)
                    self.send_json(200, {"success": True, "results": results})
                    return

                if path == "/api/tracker/sync":
                    self.send_json(200, app.sync_tracker())
                    return
                if path.startswith("/api/jobs/") and path.endswith("/generate-status"):
                    job_id = path.removeprefix("/api/jobs/").removesuffix("/generate-status")
                    status = app.generation_progress.get(job_id, {"phase": "Queued", "estimate_seconds": 15, "progress": 0})
                    if status.get("done"):
                        status = {**status, "status": "done"}
                    self.send_json(200, status)
                    return
                if path.startswith("/api/jobs/") and path.endswith("/status"):
                    job_id = path.removeprefix("/api/jobs/").removesuffix("/status")
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    self.send_json(200, app.update_status(job_id, payload["status"]))
                    return
# Phase 4B: POST endpoints for AI features
                if path == "/api/ai/interview/simulate":
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    job_desc = payload.get("job_description", "")
                    role = payload.get("role", "")
                    count = int(payload.get("question_count", 5))
                    result = app.simulate_interview(job_desc, role, count)
                    self.send_json(200, result)
                    return
                
                if path.startswith("/api/ai/interview/") and path.endswith("/answer"):
                    session_id = path.removeprefix("/api/ai/interview/").removesuffix("/answer")
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    question_id = payload.get("question_id", "")
                    answer = payload.get("answer", "")
                    result = app.submit_interview_answer(session_id, question_id, answer)
                    self.send_json(200, result)
                    return
                
                if path == "/api/ai/skill-gap":
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    skills = payload.get("skills", [])
                    target_role = payload.get("target_role", "")
                    result = app.analyze_skill_gap(skills, target_role)
                    self.send_json(200, result)
                    return
                
                if path == "/api/ai/career-paths":
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    skills = payload.get("skills", [])
                    interests = payload.get("interests", [])
                    result = app.recommend_career_paths(skills, interests)
                    self.send_json(200, result)
                    return
                
                
                if path.startswith("/api/ai/interview/") and path.endswith("/feedback"):
                    session_id = path.removeprefix("/api/ai/interview/").removesuffix("/feedback")
                    result = get_interview_simulator().get_feedback(session_id)
                    self.send_json(200, result)
                    return

                if path == "/api/ai/interview/reset":
                    result = app.reset_interview_simulator()
                    self.send_json(200, result)
                    return
                
                # Phase 6: Smart Application Endpoints
                if path == "/api/smart-applications/add":
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    result = app.add_smart_application(
                        job_id=payload.get("job_id"),
                        job_title=payload.get("job_title"),
                        company=payload.get("company"),
                        application_type=payload.get("application_type", "direct"),
                        match_score=payload.get("match_score", 0.0),
                        application_url=payload.get("application_url")
                    )
                    self.send_json(200, result)
                    return
                
                if path == "/api/smart-applications/update-status":
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    result = app.update_application_status(
                        application_id=payload.get("application_id"),
                        status=payload.get("status"),
                        notes=payload.get("notes")
                    )
                    self.send_json(200, result)
                    return
                
                if path == "/api/smart-applications":
                    query = parse_qs(parsed.query)
                    status = query.get("status", [None])[0]
                    result = app.get_smart_applications(status)
                    self.send_json(200, {"applications": result})
                    return
                
                if path == "/api/smart-applications/statistics":
                    result = app.get_application_statistics()
                    self.send_json(200, result)
                    return
                
                if path == "/api/smart-applications/follow-ups/upcoming":
                    query = parse_qs(parsed.query)
                    days = int(query.get("days", [7])[0])
                    result = app.get_upcoming_follow_ups(days)
                    self.send_json(200, {"applications": result})
                    return
                
                if path == "/api/smart-applications/follow-ups/overdue":
                    result = app.get_overdue_follow_ups()
                    self.send_json(200, {"applications": result})
                    return
                
                if path == "/api/smart-applications/set-follow-up":
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    result = app.set_application_follow_up(
                        application_id=payload.get("application_id"),
                        days_from_now=payload.get("days_from_now", 7)
                    )
                    self.send_json(200, result)
                    return
                
                if path == "/api/smart-applications/add-note":
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    result = app.add_application_note(
                        application_id=payload.get("application_id"),
                        note=payload.get("note")
                    )
                    self.send_json(200, result)
                    return
                
                if path == "/api/smart-applications/search":
                    query = parse_qs(parsed.query)
                    search_query = query.get("q", [""])[0]
                    result = app.search_smart_applications(search_query)
                    self.send_json(200, {"applications": result})
                    return
                
                if path == "/api/scrape/stream":
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/event-stream')
                    self.send_header('Cache-Control', 'no-cache')
                    self.send_header('Connection', 'keep-alive')
                    self.end_headers()
                    
                    def on_progress(stage, pct):
                        try:
                            msg = '{"stage": "' + stage + '", "percent": ' + str(pct) + '}'
                            self.wfile.write(f"data: {msg}\n\n".encode('utf-8'))
                            self.wfile.flush()
                        except:
                            pass

                    queries = app.search_queries
                    on_progress("Starting pipeline...", 0)
                    try:
                        app.refresh(queries, force=False, ttl_hours=12.0, on_progress=on_progress)
                        on_progress("Done", 100)
                    except Exception as scrape_err:
                        logger.warning(f"Live scrape stream warning: {scrape_err}")
                        on_progress("Discovery complete (cached fallback)", 100)
                    try:
                        self.wfile.write(b"data: [DONE]\n\n")
                        self.wfile.flush()
                    except:
                        pass
                    return

                if path in ("/api/refresh", "/api/scrape"):
                    content_len = int(self.headers.get("Content-Length", "0"))
                    payload = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    raw_queries = payload.get("queries", [])
                    queries = []
                    for item in raw_queries:
                        if isinstance(item, str):
                            queries.append(SearchQuery(term=item, location="Melbourne, VIC", stream="core-it"))
                        elif isinstance(item, dict):
                            queries.append(SearchQuery(
                                item.get("term", ""),
                                item.get("location", "Melbourne, VIC"),
                                item.get("stream", "core-it"),
                                item.get("group", ""),
                                float(item.get("weight", 1.0)),
                                tuple(item.get("exclude_terms", [])),
                                bool(item.get("enabled", True))
                            ))
                    force = bool(payload.get("force", False))
                    ttl_hours = float(payload.get("ttl_hours", 12.0))
                    try:
                        jobs, errors, cache_stats = app.refresh(queries, force=force, ttl_hours=ttl_hours)
                    except Exception as refresh_err:
                        logger.warning(f"{path} scrape failed, returning cached DB jobs: {refresh_err}")
                        try:
                            cached_result = app.repository.query_jobs_paginated(page=1, page_size=5000)
                            jobs = cached_result.get("jobs", [])
                        except Exception:
                            jobs = []
                        errors = [str(refresh_err)]
                        cache_stats = {"fallback": True, "total": len(jobs)}
                    self.send_json(200, {
                        "jobs": jobs,
                        "errors": errors,
                        "cache_stats": cache_stats,
                        "success": True
                    })
                    return

                if path == "/api/auto-apply/start":
                    content_len = int(self.headers.get("Content-Length", "0"))
                    payload = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
                    job = payload.get("job", {})
                    profile = payload.get("profile", {})
                    task = auto_apply_manager.create_task(job, profile)
                    self.send_json(200, {"success": True, "task": task.to_dict()})
                    return

                # Handle POST generation endpoints
                if path.startswith("/api/jobs/") and path.endswith("/generate"):
                    job_id = path.removeprefix("/api/jobs/").removesuffix("/generate")
                    status = app.start_generation(job_id)
                    self.send_json(200, {"status": "queued", **status})
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

                self.send_json(404, {"error": f"Endpoint not found: {path}"})
            except Exception as error:
                logger.error(f"POST {path} failed: {error}", exc_info=True)
                self.send_json(500, {"error": str(error)})

        
        def log_message(self, *_args):
            return

    return Handler

JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-fallback")
JWT_EXPIRY_HOURS = 24

def serve(app: DashboardApp, host: str = "127.0.0.1", port: int = 8787):
    server = ThreadingHTTPServer((host, port), make_handler(app))
    print(f"Job dashboard running at http://{host}:{port}")
    server.serve_forever()
