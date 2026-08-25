from __future__ import annotations

import json
import mimetypes
import os
import re
import threading
import time
import textwrap
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from .documents import generate_documents
from .email_connector import GmailApiScanner, GmailScanner
from .models import Job
from .normalize import normalize_job
from .service import JobDashboard
from .sources import SearchQuery, ScrapePipeline, clean_description, is_recent, posted_age
from .repository import JobRepository


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
            return [SearchQuery(str(item["term"]).strip(), str(item.get("location", "Melbourne, VIC")).strip(), str(item.get("stream", "core-it")).strip()) for item in records if str(item.get("term", "")).strip()]
        except (OSError, TypeError, ValueError, json.JSONDecodeError):
            return list(defaults or [])

    def update_search_queries(self, items):
        self.search_queries = [
            SearchQuery(
                str(item.get("term", "")).strip(),
                str(item.get("location", "Melbourne, VIC")).strip() or "Melbourne, VIC",
                str(item.get("stream", "core-it")).strip().lower() or "core-it",
            )
            for item in items
            if str(item.get("term", "")).strip()
        ]
        self.save_search_queries()
        return [{"term": query.term, "location": query.location, "stream": query.stream} for query in self.search_queries]

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

    def _write_pdf(self, output_path: Path, text: str):
        pdf = canvas.Canvas(str(output_path), pagesize=letter)
        pdf.setTitle(output_path.stem)
        pdf.setAuthor("Local Job Desk")
        pdf.setFont("Helvetica", 10)
        lines = text.splitlines()
        y = 760
        for source_line in lines:
            line = source_line.replace("**", "")
            wrapped = textwrap.wrap(line, width=100) or [""]
            for line in wrapped:
                if y < 40:
                    pdf.showPage()
                    y = 760
                pdf.drawString(50, y, line)
                y -= 14
        pdf.save()

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
            item.update({"id": job.id, "score": analysis.score.score, "stream": analysis.stream, "description": clean_description(job.description)})
            materialized.append(item)
        return materialized

    def analyses(self):
        return [self.dashboard.analyse(job) for job in self.jobs]

    def rejected_applications(self):
        """Return Gmail rejection records for a separate archive view."""
        archived = []
        for raw in self.jobs:
            events = [event for event in raw.get("email_events", []) if event.get("category") == "rejected"]
            if not events:
                continue
            job = normalize_job(raw)
            latest = events[-1]
            email_id = latest.get("email_id", "")
            archived.append({"id": job.id, "title": job.title, "company": job.company or "Company not identified", "received_at": latest.get("received_at", ""), "confidence": latest.get("confidence", 0), "email_url": f"https://mail.google.com/mail/u/0/#all/{email_id}" if email_id else "", "description": job.description})
        return archived

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
            if stored_job.get("status") == "rejected" or not self._has_recent_activity(raw):
                continue
            generated = raw.get("generated") or self.generated_documents.get(analysis.job.id)
            email_events = raw.get("email_events", [])
            email_id = email_events[-1].get("email_id") if email_events else ""
            result.append({"id": analysis.job.id, "title": analysis.job.title, "company": analysis.job.company, "location": analysis.job.location, "description": analysis.job.description, "source": analysis.job.source, "url": analysis.job.url, "email_url": f"https://mail.google.com/mail/u/0/#all/{email_id}" if email_id else "", "salary": raw.get("salary", ""), "posted": posted, "posted_age": posted_age(posted), "remote": analysis.job.remote, "stream": analysis.stream, "score": analysis.score.score, "fit": analysis.score.fit, "matched_skills": analysis.score.matched_skills, "missing_skills": analysis.score.missing_skills, "dimensions": analysis.score.dimensions, "generated": generated})
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
                self.send_json(200, app.repository.metrics())
                return
            if path == "/api/rejections":
                self.send_json(200, {"rejections": app.rejected_applications()})
                return
            if path == "/api/search-criteria":
                self.send_json(200, {"queries": [{"term": query.term, "location": query.location, "stream": query.stream} for query in app.search_queries]})
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
                if path == "/api/refresh":
                    payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                    queries = [SearchQuery(item["term"], item.get("location", "Melbourne, VIC"), item.get("stream", "core-it")) for item in payload.get("queries", [])]
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
                    self.send_json(200, app.repository.update_status(job_id, payload["status"]))
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
