from __future__ import annotations

import csv
import io
import json
import mimetypes
import os
import random

import time

login_attempts = {}
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-fallback")
JWT_EXPIRY_HOURS = 24


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

from .router import app_router
from . import routes


from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from .ai_resume_analyzer import get_resume_analyzer
from .ats_optimizer import generate_ats_optimized_resume, generate_ats_docx_bytes
from .ats_simulator import generate_ats_diagnostic_report
from .inbound_sourcing import (
    evaluate_boolean_query,
    generate_recruiter_boolean_queries,
    audit_linkedin_indexability,
    generate_boolean_optimized_headlines,
    generate_keyword_about_index,
)
from .cover_letter_polarizer import (
    audit_cover_letter,
    generate_polarized_variants,
)
from .screening_solver import (
    generate_screening_report,
)
from .ksc_generator import (
    generate_ksc_report,
)
from .seek_pass_auditor import (
    generate_seek_pass_report,
)
from .auto_apply import auto_apply_manager
from .career_recommender import get_career_recommender
from .interview_simulator import get_interview_simulator
from .compare import COMPARE_MODELS, CompareRunner
from .documents import generate_documents
from .email_connector import EmailClassifier, GmailApiScanner, GmailScanner
from .gcs_backup import backup_to_gcs
from .health import get_health_check
from .logging import get_logger
from .profile_builder import build_candidate_profile
from .normalize import normalize_job
from .predictive_analytics import get_predictive_analytics
from .repository import JobRepository
from .models import Job
from .score import explain_score, score_job
from .scrape_config import DEFAULT_QUERIES
from .service import JobDashboard
from .sources import (
    SearchQuery,
    detect_query_stream,
    ScrapePipeline,
    clean_description,
    is_recent,
    posted_age,
    extract_seek_job_id,
    fetch_seek_job_description,
    fetch_portal_description,
)
from .semantic_tailoring import (
    analyze_semantic_gap,
    generate_tailored_cover_letter,
    generate_linkedin_optimization,
)
from .offer_analytics import (
    calculate_compensation_benchmark,
    scan_employment_contract_risks,
)
from .executive_dossier import generate_executive_dossier, export_dossier_markdown
from .smart_applications import get_smart_application_tracker
from .network_crm import NetworkCRMManager
from .funnel_analytics import compute_funnel_analytics
from .career_matrix import generate_career_roadmap
from .interview_influence import (
    InterviewDebrief,
    evaluate_influence_health,
    generate_objection_resolution_memo,
    generate_referee_alignment_pack,
)


logger = get_logger("job_dashboard.web")
TRACKER_CSV_URL = os.environ.get("JOB_DASHBOARD_TRACKER_CSV_URL", "")


def _persist_profile_to_all_sinks(
    app: Any, user_id: str, profile_data: dict[str, Any]
) -> dict[str, Any]:
    """Persist candidate profile across SQLite, in-memory dashboard, local JSON files, WAL checkpoint, and GCS."""
    from datetime import datetime, timezone

    profile_data["id"] = user_id
    if "updatedAt" not in profile_data and "updated_at" not in profile_data:
        profile_data["updatedAt"] = datetime.now(timezone.utc).isoformat()

    # Cross-populate naming convention aliases
    if "targetRoles" in profile_data and "targetTitles" not in profile_data:
        profile_data["targetTitles"] = list(profile_data["targetRoles"])
    elif "targetTitles" in profile_data and "targetRoles" not in profile_data:
        profile_data["targetRoles"] = list(profile_data["targetTitles"])

    if "seniority" in profile_data and "seniorityLevel" not in profile_data:
        profile_data["seniorityLevel"] = profile_data["seniority"]
    elif "seniorityLevel" in profile_data and "seniority" not in profile_data:
        profile_data["seniority"] = profile_data["seniorityLevel"]

    if "locationPreference" in profile_data and "location" not in profile_data:
        profile_data["location"] = profile_data["locationPreference"]
    elif "location" in profile_data and "locationPreference" not in profile_data:
        profile_data["locationPreference"] = profile_data["location"]

    res = app.repository.upsert_user_profile(user_id, profile_data)
    email = str(profile_data.get("email") or "").strip().lower()
    if email and email != user_id:
        try:
            app.repository.upsert_user_profile(email, profile_data)
        except Exception:
            pass
    for prefix in ("user_", "prof_"):
        if user_id.startswith(prefix):
            clean_id = user_id[len(prefix) :]
            try:
                app.repository.upsert_user_profile(clean_id, profile_data)
            except Exception:
                pass

    # 1. Update in-memory dashboard profile so subsequent scoring and tools use the live profile
    if hasattr(app, "dashboard") and app.dashboard:
        app.dashboard.profile = res

    # 1b. Auto-synchronize search discovery queries from the new profile
    if hasattr(app, "suggested_search_queries") and hasattr(app, "update_search_queries"):
        try:
            suggested = app.suggested_search_queries()
            if suggested:
                app.update_search_queries(suggested)
        except Exception as sq_err:
            logger.debug(f"Could not auto-update search queries on profile persist: {sq_err}")

    # 2. Write to data_dir / job_profile.json for persistent state
    if hasattr(app, "data_dir") and app.data_dir:
        data_profile_path = Path(app.data_dir) / "job_profile.json"
        try:
            data_profile_path.parent.mkdir(parents=True, exist_ok=True)
            with open(data_profile_path, "w", encoding="utf-8") as f:
                json.dump(res, f, indent=2, ensure_ascii=False)
        except Exception as file_err:
            logger.debug(f"Could not write profile to {data_profile_path}: {file_err}")

    # 3. Checkpoint SQLite WAL so changes are fully committed to main database file
    try:
        from .db_pool import get_db_connection

        with get_db_connection(app.repository.path) as conn:
            conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    except Exception as cp_err:
        logger.debug(f"WAL checkpoint warning on profile save: {cp_err}")

    # 4. Immediate backup of job_profile.json to GCS (guarantees completion before Cloud Run throttles CPU)
    from .config import settings

    if settings.gcs_data_bucket and hasattr(app, "data_dir") and app.data_dir:
        try:
            backup_to_gcs(
                settings.gcs_data_bucket,
                Path(app.data_dir),
                filenames=("job_profile.json",),
            )
        except Exception as b_err:
            logger.warning(f"Immediate GCS profile backup warning: {b_err}")

        # Also trigger background backup for the larger sqlite database
        def _bg_backup():
            try:
                backup_to_gcs(
                    settings.gcs_data_bucket,
                    Path(app.data_dir),
                    filenames=("jobs.sqlite3", "jobs.sqlite3-wal"),
                )
            except Exception as b_err:
                logger.warning(
                    f"GCS database backup failed on profile persist: {b_err}"
                )

        threading.Thread(target=_bg_backup, daemon=True).start()

    return res


class DashboardApp:
    def __init__(
        self,
        profile=None,
        sources=None,
        data_dir: str | Path = "data",
        document_generator=None,
        search_queries=None,
        repository=None,
    ):
        if isinstance(profile, (str, Path)):
            p = Path(profile)
            if p.exists() and p.is_file():
                try:
                    profile = json.loads(p.read_text(encoding="utf-8"))
                except Exception:
                    profile = {}
            else:
                profile = {}
        self.dashboard = JobDashboard(profile or {})
        self.sources = sources or []
        self.document_generator = document_generator
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.jobs_path = self.data_dir / "jobs.json"
        self.search_queries_path = self.data_dir / "search_queries.json"
        self.profile_path = self.data_dir / "job_profile.json"
        if (not profile or not self.dashboard.profile) and self.profile_path.exists():
            try:
                self.dashboard.profile = json.loads(
                    self.profile_path.read_text(encoding="utf-8")
                )
            except Exception:
                pass
        self.search_queries = self._load_search_queries(search_queries)
        self.jobs: list[dict] = self._load_jobs()
        self.repository = repository or JobRepository(self.data_dir / "jobs.sqlite3")
        self.health_check = get_health_check(self.data_dir)
        self.db = self.repository
        self.generated_documents: dict[str, dict[str, str]] = (
            self._load_generated_documents()
        )
        self.generation_progress: dict[str, dict[str, object]] = {}
        self.compare_results: dict[str, dict[str, object]] = (
            self._load_compare_results()
        )
        self.compare_progress: dict[str, dict[str, object]] = {}
        self.tracker_state: dict[str, object] = {
            "status": "idle",
            "last_sync": None,
            "rows": 0,
            "matched": 0,
            "error": None,
        }
        self.tracker_rows: list[dict[str, str]] = []
        generator_factory = None
        if document_generator is not None:
            generator_factory = lambda model: type(document_generator)(
                document_generator.source_dir,
                document_generator.guidelines_dir,
                model=model,
                api_key=document_generator.api_key,
            )
        self.compare_runner = CompareRunner(
            self.data_dir, generator_factory=generator_factory
        )
        # Phase 6: Smart Application Tracker
        self.application_tracker = get_smart_application_tracker(self.data_dir)
        # Phase 16: Recruiter & Talent Network CRM
        self.network_crm = NetworkCRMManager(self.data_dir / "jobs.sqlite3")
        from .scrape_coordinator import ScrapeCoordinator

        self.scrape_coordinator = ScrapeCoordinator(repo=self.repository)
        self.lock = threading.Lock()
        self.db_ready_event = threading.Event()
        if self.jobs:
            if self.repository.count_jobs() == 0:
                logger.info(f"Seeding database with {len(self.jobs)} scraped jobs...")
                if len(self.jobs) <= 50:
                    try:
                        self.repository.upsert_scraped_jobs(self.jobs)
                    except Exception as err:
                        logger.warning(
                            f"Initial database seeding exception (non-fatal): {err}"
                        )
                    self.db_ready_event.set()
                else:

                    def _seed():
                        try:
                            self.repository.upsert_scraped_jobs(self.jobs)
                        except Exception as err:
                            logger.warning(
                                f"Initial database seeding exception (non-fatal): {err}"
                            )
                        finally:
                            self.db_ready_event.set()

                    threading.Thread(target=_seed, daemon=True).start()
            else:
                self.db_ready_event.set()
        else:
            self.db_ready_event.set()

    def save_search_queries(self):
        try:
            payload = [
                {"term": query.term, "location": query.location, "stream": query.stream}
                for query in self.search_queries
            ]
            self.search_queries_path.parent.mkdir(parents=True, exist_ok=True)
            temporary = self.search_queries_path.with_suffix(".tmp")
            with temporary.open("w", encoding="utf-8") as file:
                json.dump(payload, file, indent=2)
                file.write("\n")
                file.flush()
                os.fsync(file.fileno())
            temporary.replace(self.search_queries_path)
        except Exception as err:
            logger.warning(
                f"Failed to persist search queries to {self.search_queries_path}: {err}"
            )

    def _load_search_queries(self, defaults=None):

        if not self.search_queries_path.exists():
            resolved_defaults = list(defaults or [])
            if resolved_defaults:
                try:
                    self.search_queries = resolved_defaults
                    self.save_search_queries()
                except Exception as err:
                    logger.warning(f"Could not persist default search queries: {err}")
            return resolved_defaults
        try:
            records = json.loads(self.search_queries_path.read_text(encoding="utf-8"))
            loaded = []
            for item in records:
                term = str(item.get("term", "")).strip()
                if not term:
                    continue
                is_remote = any(
                    k in term.lower()
                    for k in (
                        "remote",
                        "wfh",
                        "work from home",
                        "anywhere in australia",
                    )
                ) or bool(item.get("remote"))
                raw_loc = str(
                    item.get("location")
                    or ("Australia" if is_remote else "Melbourne, VIC")
                ).strip()
                loc = (
                    "Australia"
                    if (
                        is_remote
                        and raw_loc.lower() in ("melbourne, vic", "melbourne", "")
                    )
                    else (raw_loc or "Australia")
                )
                loaded.append(
                    SearchQuery(
                        term,
                        loc,
                        str(item.get("stream", "core-it")).strip(),
                        str(item.get("group", "")).strip(),
                        float(item.get("weight", 1.0)),
                        tuple(
                            str(t).strip()
                            for t in item.get("exclude_terms", [])
                            if str(t).strip()
                        ),
                        bool(item.get("enabled", True)),
                    )
                )
            return loaded or list(defaults or DEFAULT_QUERIES)
        except (OSError, TypeError, ValueError, json.JSONDecodeError):
            return list(defaults or [])

    def update_search_queries(self, items):
        if isinstance(items, dict):
            items = items.get("queries") or items.get("items") or []
        if not isinstance(items, list):
            items = []
        updated = []
        for item in items:
            if isinstance(item, str):
                term = item.strip()
                if not term:
                    continue
                item_dict = {"term": term}
            elif isinstance(item, dict):
                item_dict = item
                term = str(
                    item.get("term", "")
                    or item.get("query", "")
                    or item.get("title", "")
                ).strip()
                if not term:
                    continue
            else:
                continue

            is_remote = any(
                k in term.lower()
                for k in ("remote", "wfh", "work from home", "anywhere in australia")
            ) or bool(item_dict.get("remote"))
            raw_loc = str(
                item_dict.get("location")
                or ("Australia" if is_remote else "Melbourne, VIC")
            ).strip()
            loc = (
                "Australia"
                if (
                    is_remote and raw_loc.lower() in ("melbourne, vic", "melbourne", "")
                )
                else (raw_loc or "Australia")
            )
            raw_exclude = item_dict.get("exclude_terms", [])
            if not isinstance(raw_exclude, (list, tuple)):
                raw_exclude = []
            exclude_terms = tuple(str(t).strip() for t in raw_exclude if str(t).strip())
            try:
                weight = float(item_dict.get("weight", 1.0))
            except (ValueError, TypeError):
                weight = 1.0

            stream = (
                str(item_dict.get("stream", "core-it")).strip().lower() or "core-it"
            )
            group = str(item_dict.get("group", "")).strip()
            enabled = bool(item_dict.get("enabled", True))

            updated.append(
                SearchQuery(
                    term,
                    loc,
                    stream,
                    group,
                    weight,
                    exclude_terms,
                    enabled,
                )
            )
        self.search_queries = updated
        self.save_search_queries()
        result = []
        for query in self.search_queries:
            entry = {
                "term": query.term,
                "location": query.location,
                "stream": query.stream,
            }
            if (
                query.group
                or query.weight != 1.0
                or query.exclude_terms
                or not query.enabled
            ):
                entry.update(
                    {
                        "group": query.group,
                        "weight": query.weight,
                        "exclude_terms": list(query.exclude_terms),
                        "enabled": query.enabled,
                    }
                )
            result.append(entry)
        return result

    def update_status(self, job_id: str, status: str):
        result = self.repository.update_status(job_id, status)
        for job in self.jobs:
            if job.get("id") == job_id:
                job["status"] = status
                break
        return result

    # Lightweight industry → representative job titles map used by the backend
    # suggestion endpoint. Mirrors the frontend's INDUSTRY_QUERY_MAP so that
    # GET /api/search-criteria/suggestions returns industry-relevant terms.
    _INDUSTRY_TITLES: dict[str, list[str]] = {
        "Technology & IT": [
            "systems administrator",
            "support engineer",
            "helpdesk",
            "infrastructure engineer",
            "cloud engineer",
            "devops engineer",
            "service desk analyst",
            "Microsoft 365 Administrator",
            "Azure Administrator",
            "SharePoint Administrator",
            "Intune Administrator",
            "Endpoint Engineer",
            "PowerShell Automation Engineer",
            "ServiceNow Administrator",
            "Technical Support Engineer",
            "Infrastructure Consultant",
        ],
        "Healthcare & Medical": [
            "registered nurse",
            "enrolled nurse",
            "clinical nurse consultant",
            "nurse practitioner",
            "ward manager",
            "hospital administrator",
            "allied health professional",
            "physiotherapist",
            "occupational therapist",
            "medical receptionist",
            "healthcare coordinator",
            "clinical coordinator",
            "aged care worker",
            "disability support worker",
            "patient services officer",
        ],
        "Finance & Accounting": [
            "financial analyst",
            "accountant",
            "senior accountant",
            "management accountant",
            "financial controller",
            "tax accountant",
            "payroll officer",
            "bookkeeper",
            "finance manager",
            "business analyst",
            "investment analyst",
            "compliance officer",
        ],
        "Marketing & Sales": [
            "marketing manager",
            "digital marketing manager",
            "SEO specialist",
            "content strategist",
            "brand manager",
            "account manager",
            "business development manager",
            "sales manager",
            "CRM manager",
        ],
        "Construction & Trades": [
            "site manager",
            "project manager construction",
            "construction manager",
            "estimator",
            "quantity surveyor",
            "building supervisor",
            "civil engineer",
            "structural engineer",
            "contracts administrator",
        ],
        "Education": [
            "teacher",
            "primary school teacher",
            "secondary school teacher",
            "early childhood educator",
            "curriculum developer",
            "education consultant",
            "instructional designer",
            "school administrator",
            "TAFE trainer",
        ],
        "Legal": [
            "solicitor",
            "lawyer",
            "legal counsel",
            "in-house counsel",
            "paralegal",
            "legal secretary",
            "conveyancer",
            "litigation lawyer",
            "corporate lawyer",
        ],
        "HR & People": [
            "HR business partner",
            "HR manager",
            "human resources officer",
            "talent acquisition specialist",
            "recruiter",
            "learning and development manager",
            "people and culture manager",
            "HRIS specialist",
        ],
        "Retail & Hospitality": [
            "retail manager",
            "store manager",
            "hospitality manager",
            "restaurant manager",
            "hotel manager",
            "customer experience manager",
        ],
        "Engineering": [
            "mechanical engineer",
            "electrical engineer",
            "chemical engineer",
            "process engineer",
            "project engineer",
            "design engineer",
            "maintenance engineer",
            "systems engineer",
            "automation engineer",
        ],
        "Logistics & Supply Chain": [
            "supply chain manager",
            "logistics coordinator",
            "warehouse manager",
            "operations manager logistics",
            "procurement manager",
            "inventory manager",
        ],
        "Creative & Design": [
            "graphic designer",
            "UX designer",
            "UI designer",
            "product designer",
            "creative director",
            "art director",
            "video editor",
            "web designer",
        ],
    }

    def _normalize_industry_key(self, ind_raw: str) -> str:
        s = str(ind_raw or "").lower()
        if any(k in s for k in ("health", "nurs", "medic", "clinic")):
            return "Healthcare & Medical"
        if any(k in s for k in ("tech", "cloud", "software", "it", "developer", "data")):
            return "Technology & IT"
        if any(k in s for k in ("finance", "account", "bank", "cpa")):
            return "Finance & Accounting"
        if any(k in s for k in ("construct", "trade", "build")):
            return "Construction & Trades"
        if any(k in s for k in ("educat", "teach", "school")):
            return "Education"
        if any(k in s for k in ("legal", "law", "solicitor")):
            return "Legal"
        if any(k in s for k in ("hr", "people", "talent", "recruit")):
            return "HR & People"
        if any(k in s for k in ("market", "sales")):
            return "Marketing & Sales"
        if any(k in s for k in ("retail", "hospitality")):
            return "Retail & Hospitality"
        if any(k in s for k in ("engineer", "mechanical", "electrical")):
            return "Engineering"
        if any(k in s for k in ("logistics", "supply chain", "transport")):
            return "Logistics & Supply Chain"
        if any(k in s for k in ("creative", "design")):
            return "Creative & Design"
        return "Technology & IT"

    def suggested_search_queries(self):
        """Return search terms grounded in the candidate's profile and industry.

        Priority:
        1. Explicit target titles / target roles from the profile (highest relevance).
        2. Past job titles from experience entries.
        3. Industry-appropriate titles from ``_INDUSTRY_TITLES``.
        All terms are deduplicated and capped at 20 suggestions.
        """
        profile = self.dashboard.profile
        terms = []
        seen: set[str] = set()
        location = (
            str(
                profile.get("location")
                or profile.get("locationPreference")
                or profile.get("location_preference")
                or "Melbourne, VIC"
            )
            .split("(")[0]
            .strip()
            or "Melbourne, VIC"
        )

        def add(term: str, stream: str = "core") -> None:
            term = str(term).strip()
            if term and term.lower() not in seen and len(terms) < 20:
                seen.add(term.lower())
                terms.append(SearchQuery(term, location, stream))

        # 1. Explicit target titles / target roles — highest priority
        titles = (
            profile.get("targetTitles")
            or profile.get("targetRoles")
            or profile.get("target_titles")
            or profile.get("target_roles")
            or []
        )
        for title in titles:
            add(title)

        # 2. Past experience titles
        for experience in profile.get("experience") or []:
            add(experience.get("title", ""))

        # 3. Industry-appropriate titles
        industry_raw = str(profile.get("industry") or "Technology & IT")
        norm_industry = self._normalize_industry_key(industry_raw)
        for title in self._INDUSTRY_TITLES.get(
            norm_industry,
            self._INDUSTRY_TITLES.get(
                industry_raw, self._INDUSTRY_TITLES["Technology & IT"]
            ),
        ):
            add(title)

        return [
            {"term": query.term, "location": query.location, "stream": query.stream}
            for query in terms
        ]

    def _load_generated_documents(self):
        path = self.data_dir / "generated_documents.json"
        if not path.exists():
            return {}
        try:
            records = json.loads(path.read_text(encoding="utf-8"))
            return {
                job_id: metadata
                for job_id, metadata in records.items()
                if self._documents_exist(metadata)
            }
        except json.JSONDecodeError:
            return {}

    @staticmethod
    def _documents_exist(metadata):
        return all(
            Path(metadata.get(name, "")).is_file()
            for name in ("resume_pdf", "cover_letter_pdf")
        )

    def _recover_generated_documents(self, job_id):
        """Recover a completed pair if the worker was interrupted after writing files."""
        if job_id in self.generated_documents and self._documents_exist(
            self.generated_documents[job_id]
        ):
            return self.generated_documents[job_id]
        raw = next((job for job in self.jobs if normalize_job(job).id == job_id), None)
        if raw is None:
            return None
        application_id = re.sub(
            r"[^a-z0-9]+",
            "_",
            f"{raw.get('company', '')}_{raw.get('title', '')}".lower(),
        ).strip("_")[:160]
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
            self.generation_progress[job_id] = {
                "phase": "Completed",
                "estimate_seconds": 0,
                "progress": 100,
                "done": True,
                **metadata,
            }
            return metadata
        return None

    def save_generated_documents(self):
        payload = {
            str(job_id): meta for job_id, meta in self.generated_documents.items()
        }
        (self.data_dir / "generated_documents.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    def _load_compare_results(self):
        path = self.data_dir / "compare_results.json"
        if not path.exists():
            return {}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, TypeError, ValueError, json.JSONDecodeError):
            return {}

    def _save_compare_results(self):
        (self.data_dir / "compare_results.json").write_text(
            json.dumps(self.compare_results, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    def _compare_update(self, comparison_id, model_id, cache_key, result):
        comparison = self.compare_results.setdefault(
            comparison_id,
            {
                "comparison_id": comparison_id,
                "job_id": comparison_id.removeprefix("cmp_").rsplit("_", 1)[0],
                "models": {},
                "selected_model": None,
            },
        )
        comparison["models"][model_id] = {**result, "cache_key": cache_key}
        self.compare_progress[comparison_id] = {
            "done": all(
                item.get("status") in {"completed", "failed", "timeout"}
                for item in comparison["models"].values()
            )
            and len(comparison["models"]) == len(COMPARE_MODELS),
            "models": comparison["models"],
        }
        self._save_compare_results()

    def start_compare(self, job_id: str):
        raw = next((job for job in self.jobs if normalize_job(job).id == job_id), None)
        if raw is None:
            raise KeyError(job_id)
        analysis = self.dashboard.analyse(raw)
        comparison_id = f"cmp_{job_id}_{int(time.time())}"
        comparison = {
            "comparison_id": comparison_id,
            "job_id": job_id,
            "started_at": time.time(),
            "models": {},
            "selected_model": None,
            "warning": "Low match quality; review carefully before using generated documents."
            if analysis.score.score < 70 or not analysis.score.matched_skills
            else "",
        }
        self.compare_results[comparison_id] = comparison
        self.compare_progress[comparison_id] = {
            "done": False,
            "models": {
                model_id: {
                    "model_id": model_id,
                    "display_name": display_name,
                    "status": "queued",
                }
                for model_id, display_name in COMPARE_MODELS
            },
            "warning": comparison["warning"],
        }
        self._save_compare_results()
        cached = {
            result.get("cache_key"): result
            for past in self.compare_results.values()
            for result in past.get("models", {}).values()
            if result.get("cache_key")
        }
        self.compare_runner.submit(
            comparison_id,
            analysis.job,
            self.dashboard.profile,
            cached,
            lambda model, key, result: self._compare_update(
                comparison_id, model, key, result
            ),
        )
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
        application_id = re.sub(
            r"[^a-z0-9]+", "_", f"{job_id}_{model_id}".lower()
        ).strip("_")[:160]
        resume_path = output_dir / f"{application_id}_resume.md"
        cover_path = output_dir / f"{application_id}_cover_letter.md"
        resume_path.write_text(selected["resume_text"], encoding="utf-8")
        cover_path.write_text(selected["cover_letter_text"], encoding="utf-8")
        self._write_pdf(
            output_dir / f"{application_id}_resume.pdf", selected["resume_text"]
        )
        self._write_pdf(
            output_dir / f"{application_id}_cover_letter.pdf",
            selected["cover_letter_text"],
        )
        metadata = {
            "application_id": application_id,
            "model_id": model_id,
            "status": "needs_review"
            if not selected.get("audit", {}).get("verified", True)
            else "draft_ready",
            "audit": selected.get("audit", {}),
            "resume": str(resume_path),
            "cover_letter": str(cover_path),
            "resume_pdf": str(output_dir / f"{application_id}_resume.pdf"),
            "cover_letter_pdf": str(output_dir / f"{application_id}_cover_letter.pdf"),
        }
        self.generated_documents[job_id] = metadata
        comparison["selected_model"] = model_id
        self.save_generated_documents()
        self._save_compare_results()
        return metadata

    def retry_compare_model(self, comparison_id: str, model_id: str):
        comparison = self.compare_results.get(comparison_id)
        if not comparison:
            raise KeyError(comparison_id)
        raw = next(
            (job for job in self.jobs if normalize_job(job).id == comparison["job_id"]),
            None,
        )
        if raw is None:
            raise KeyError(comparison["job_id"])
        self.compare_runner.submit(
            comparison_id,
            self.dashboard.analyse(raw).job,
            self.dashboard.profile,
            {},
            lambda model, key, result: self._compare_update(
                comparison_id, model, key, result
            ),
            model_ids=[model_id],
        )
        comparison["models"][model_id] = {"model_id": model_id, "status": "loading"}
        self._save_compare_results()
        return comparison["models"][model_id]

    def _write_pdf(self, output_path: Path, text: str):
        styles = getSampleStyleSheet()
        body = ParagraphStyle(
            "DocumentBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor("#26383a"),
            spaceAfter=5,
        )
        name = ParagraphStyle(
            "DocumentName",
            parent=body,
            fontName="Helvetica-Bold",
            fontSize=21,
            leading=24,
            textColor=colors.HexColor("#123c42"),
            spaceAfter=2,
        )
        heading = ParagraphStyle(
            "DocumentHeading",
            parent=body,
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=14,
            textColor=colors.HexColor("#123c42"),
            spaceBefore=10,
            spaceAfter=5,
            keepWithNext=True,
        )
        role = ParagraphStyle(
            "DocumentRole",
            parent=body,
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#26383a"),
            spaceBefore=6,
            spaceAfter=1,
            keepWithNext=True,
        )
        date = ParagraphStyle(
            "DocumentDate",
            parent=body,
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#607477"),
            spaceAfter=3,
            keepWithNext=True,
        )
        bullet = ParagraphStyle(
            "DocumentBullet",
            parent=body,
            leftIndent=10,
            firstLineIndent=-7,
            bulletIndent=0,
            spaceAfter=3,
        )

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
            elif re.fullmatch(
                r"(?:[A-Z][a-z]+ \d{4}|Present|\d{4})\s*[–-]\s*(?:[A-Z][a-z]+ \d{4}|Present|\d{4})",
                line,
            ):
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

        document = SimpleDocTemplate(
            str(output_path),
            pagesize=letter,
            rightMargin=20 * mm,
            leftMargin=20 * mm,
            topMargin=16 * mm,
            bottomMargin=20 * mm,
            title=output_path.stem,
            author="Local Job Desk",
        )
        document.build(story, onFirstPage=footer, onLaterPages=footer)

    def _document_metadata(self, job_id, documents, output_dir):
        metadata = {
            "application_id": documents["application_id"],
            "status": documents.get("status", "draft_ready"),
            "audit": documents.get(
                "audit", {"verified": True, "issue_count": 0, "issues": []}
            ),
            "resume": str(output_dir / f"{documents['application_id']}_resume.md"),
            "cover_letter": str(
                output_dir / f"{documents['application_id']}_cover_letter.md"
            ),
            "resume_pdf": str(output_dir / f"{documents['application_id']}_resume.pdf"),
            "cover_letter_pdf": str(
                output_dir / f"{documents['application_id']}_cover_letter.pdf"
            ),
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
        return {
            "phase": phase,
            "estimate_seconds": round(estimate),
            "progress": pct,
            "started_at": started_at,
        }

    def _load_jobs(self):
        if "PYTEST_CURRENT_TEST" in os.environ:
            candidate_paths = [
                self.jobs_path,
                self.data_dir / "jobs_combined.json",
                Path(__file__).parent / "static" / "demo_jobs.json",
            ]
        else:
            candidate_paths = [
                self.jobs_path,
                Path(__file__).parent / "static" / "jobs_combined.json",
                Path(__file__).parent / "static" / "demo_jobs.json",
                self.data_dir / "jobs_combined.json",
                Path("/app/src/job_dashboard/static/jobs_combined.json"),
                Path("/app/data/jobs.json"),
                Path(__file__).resolve().parents[3]
                / "job-dashboard-react"
                / "public"
                / "jobs_combined.json",
                Path(__file__).resolve().parents[3]
                / "job-dashboard-site"
                / "scrapers"
                / "jobs_combined.json",
            ]
        for p in candidate_paths:
            if p and p.exists():
                try:
                    raw_data = json.loads(p.read_text(encoding="utf-8"))
                    jobs = (
                        raw_data
                        if isinstance(raw_data, list)
                        else (
                            raw_data.get("jobs", [])
                            if isinstance(raw_data, dict)
                            else []
                        )
                    )
                    if jobs:
                        logger.info(f"Loaded {len(jobs)} jobs from {p}")
                        return jobs
                except Exception as e:
                    logger.error(f"Error loading jobs from {p}: {e}")
        return []

    def save_jobs(self):
        self.jobs_path.write_text(
            json.dumps({"jobs": self.jobs}, indent=2, ensure_ascii=False, default=str)
            + "\n",
            encoding="utf-8",
        )
        self.repository.replace_jobs(self.jobs)

    def materialize_jobs(self, jobs):
        materialized = []
        skipped = []
        for raw in jobs:
            # Confidential/blank-company ads are still valid postings — coerce
            # rather than reject, since a single unnormalizable job previously
            # raised and aborted materialization for the entire batch.
            candidate = raw.to_dict() if hasattr(raw, "to_dict") else dict(raw)
            if not str(candidate.get("company") or "").strip():
                candidate["company"] = "Confidential"
            if (
                isinstance(candidate.get("salary"), dict)
                and "raw_text" in candidate["salary"]
            ):
                candidate["salary"] = candidate["salary"]["raw_text"]
            elif hasattr(candidate.get("salary"), "raw_text"):
                candidate["salary"] = candidate["salary"].raw_text
            try:
                job = normalize_job(candidate)
                analysis = self.dashboard.analyse(candidate)
            except Exception as error:
                logger.warning(
                    f"Skipping unnormalizable job during materialization: {error}"
                )
                skipped.append({"job": candidate, "error": str(error)})
                continue
            item = dict(candidate)
            item.update(
                {
                    "id": job.id,
                    "score": analysis.score.score,
                    "stream": analysis.stream,
                    "fit_category": analysis.fit_category,
                    "dimensions": analysis.score.dimensions,
                    "matched_skills": analysis.score.matched_skills,
                    "missing_skills": analysis.score.missing_skills,
                    "description": clean_description(job.description),
                }
            )
            materialized.append(item)
        self.last_skipped_jobs = skipped
        return materialized

    def analyses(self):
        return [self.dashboard.analyse(job) for job in self.jobs]

    def rejected_applications(self):
        archived = []
        seen = set()
        for raw in self.jobs:
            events = [
                event
                for event in raw.get("email_events", [])
                if event.get("category") == "rejected"
            ]
            if not events:
                continue
            job = normalize_job(raw)
            latest = events[-1]
            email_id = latest.get("email_id", "")
            if email_id in seen:
                continue
            seen.add(email_id)
            archived.append(
                {
                    "id": job.id,
                    "title": job.title,
                    "company": job.company or "Company not identified",
                    "received_at": latest.get("received_at", ""),
                    "confidence": latest.get("confidence", 0),
                    "email_url": f"https://mail.google.com/mail/u/0/#all/{email_id}"
                    if email_id
                    else "",
                    "description": job.description,
                }
            )
        return archived

    def application_archive(self):
        archive = []
        for raw in self.jobs:
            for event in raw.get("email_events", []):
                archive.append(
                    {
                        "title": raw.get("title", "Gmail application"),
                        "company": raw.get("company", "Company not identified"),
                        "category": event.get("category", "tracked"),
                        "received_at": event.get("received_at", ""),
                    }
                )
        return archive

    # Phase 6: Smart Application Methods
    def add_smart_application(
        self,
        job_id: str,
        job_title: str,
        company: str,
        application_type: str = "direct",
        match_score: float = 0.0,
        application_url: str = None,
    ) -> dict:
        """Add a new smart application to track."""
        from .smart_applications import ApplicationType

        app_type = ApplicationType(application_type.lower())
        application = self.application_tracker.add_application(
            job_id=job_id,
            job_title=job_title,
            company=company,
            application_type=app_type,
            match_score=match_score,
            application_url=application_url,
        )
        return application.to_dict()

    def update_application_status(
        self, application_id: str, status: str, notes: str = None
    ) -> dict:
        """Update application status."""
        from .smart_applications import ApplicationStatus

        app_status = ApplicationStatus(status.lower())
        application = self.application_tracker.update_status(
            application_id, app_status, notes
        )
        if application:
            return application.to_dict()
        return {"error": "Application not found"}

    def get_smart_applications(self, status: str = None) -> list:
        """Get smart applications filtered by status."""
        from .smart_applications import ApplicationStatus

        if status:
            app_status = ApplicationStatus(status.lower())
            applications = self.application_tracker.get_applications_by_status(
                app_status
            )
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

    def set_application_follow_up(
        self, application_id: str, days_from_now: int = 7
    ) -> dict:
        """Schedule a follow-up for an application."""
        application = self.application_tracker.set_follow_up(
            application_id, days_from_now
        )
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
            if (
                not filters.get("status")
                and stored_job.get("status", "sourced") != "sourced"
            ):
                continue
            if not filters.get("status") and (
                stored_job.get("status") == "rejected"
                or not self._has_recent_activity(stored_job)
            ):
                continue

            job_id = stored_job.get("id")
            raw_memory = next(
                (
                    j
                    for j in self.jobs
                    if j.get("id") == job_id or j.get("url") == stored_job.get("url")
                ),
                {},
            )
            posted = stored_job.get("posted") or raw_memory.get("posted", "")
            generated = raw_memory.get("generated") or self.generated_documents.get(
                job_id
            )
            email_events = stored_job.get("email_events") or raw_memory.get(
                "email_events", []
            )
            email_id = email_events[-1].get("email_id") if email_events else ""

            # Check precomputed fields from stored_job or raw_memory or data_json
            data_json = stored_job.get("data_json")
            extra = {}
            if isinstance(data_json, str):
                try:
                    extra = json.loads(data_json)
                except Exception:
                    extra = {}
            elif isinstance(data_json, dict):
                extra = data_json

            fit_val = stored_job.get("fit") or extra.get("fit") or raw_memory.get("fit")
            matched_skills = (
                stored_job.get("matched_skills")
                or extra.get("matched_skills")
                or raw_memory.get("matched_skills")
            )
            missing_skills = (
                stored_job.get("missing_skills")
                or extra.get("missing_skills")
                or raw_memory.get("missing_skills")
            )
            dimensions = (
                stored_job.get("dimensions")
                or extra.get("dimensions")
                or raw_memory.get("dimensions")
            )
            score_val = (
                stored_job.get("score")
                if stored_job.get("score") is not None
                else extra.get("score")
            )
            stream_val = (
                stored_job.get("stream")
                or extra.get("stream")
                or raw_memory.get("stream")
            )
            fit_cat = (
                stored_job.get("fit_category")
                or extra.get("fit_category")
                or raw_memory.get("fit_category")
            )

            # Fallback to dynamic analysis ONLY if score was never computed (avoids 40s CPU freeze)
            if score_val is None or not dimensions:
                analysis = None
                try:
                    norm_target = dict(stored_job)
                    if not str(norm_target.get("company") or "").strip():
                        norm_target["company"] = "Confidential"
                    if not str(norm_target.get("title") or "").strip():
                        norm_target["title"] = "Untitled Position"
                    analysis = self.dashboard.analyse(norm_target)
                except Exception as e:
                    logger.warning(f"Error analysing stored job {job_id}: {e}")

                if analysis:
                    fit_val = fit_val or analysis.score.fit
                    matched_skills = matched_skills or analysis.score.matched_skills
                    missing_skills = missing_skills or analysis.score.missing_skills
                    dimensions = dimensions or analysis.score.dimensions
                    score_val = (
                        score_val if score_val is not None else analysis.score.score
                    )
                    stream_val = stream_val or analysis.stream
                    fit_cat = fit_cat or analysis.fit_category

            fit_val = fit_val or "Moderate Match"
            matched_skills = matched_skills or []
            missing_skills = missing_skills or []
            dimensions = dimensions or {}
            score_val = 70 if score_val is None else score_val
            stream_val = stream_val or "core-it"
            fit_cat = fit_cat or "Core IT"

            result.append(
                {
                    "id": job_id,
                    "title": stored_job.get("title", ""),
                    "company": stored_job.get("company") or "Confidential",
                    "location": stored_job.get("location", ""),
                    "description": clean_description(stored_job.get("description", "")),
                    "source": stored_job.get("source", ""),
                    "url": stored_job.get("url", ""),
                    "email_url": f"https://mail.google.com/mail/u/0/#all/{email_id}"
                    if email_id
                    else "",
                    "salary": stored_job.get("salary") or raw_memory.get("salary", ""),
                    "posted": posted,
                    "posted_age": posted_age(posted),
                    "remote": bool(stored_job.get("remote", False)),
                    "stream": stream_val,
                    "fit_category": fit_cat,
                    "score": score_val,
                    "fit": fit_val,
                    "matched_skills": matched_skills,
                    "missing_skills": missing_skills,
                    "dimensions": dimensions,
                    "generated": generated,
                    "status": stored_job.get("status", "sourced"),
                }
            )
        return result

    @staticmethod
    def _has_recent_activity(job, days: int = 30):
        dates = [job.get("posted", "")]
        dates.extend(
            event.get("received_at", "") for event in job.get("email_events", [])
        )
        return any(value and is_recent({"posted": value}, days=days) for value in dates)

    def refresh(
        self, queries, force: bool = False, ttl_hours: float = 12.0, on_progress=None
    ):
        self.db_ready_event.wait(timeout=5.0)
        with self.lock:
            if not queries:
                queries = list(self.search_queries or [])
            if not queries:
                from .scrape import resolve_cli_queries

                queries = resolve_cli_queries(None)

            normalized_queries: list[SearchQuery] = []
            for q in queries:
                if isinstance(q, SearchQuery):
                    term = q.term
                    stream = q.stream
                    loc = q.location
                    is_rem = stream.lower() == "remote" or any(
                        k in term.lower()
                        for k in (
                            "remote",
                            "wfh",
                            "work from home",
                            "anywhere in australia",
                        )
                    )
                    if is_rem and (
                        not loc or loc.lower() in ("melbourne, vic", "melbourne", "vic")
                    ):
                        loc = "Australia"
                    normalized_queries.append(
                        SearchQuery(
                            term=term,
                            location=loc or "Australia",
                            stream=stream,
                            group=q.group,
                            weight=q.weight,
                            exclude_terms=q.exclude_terms,
                            enabled=q.enabled,
                        )
                    )
                elif isinstance(q, str):
                    if q.strip():
                        s_term = q.strip()
                        s_stream = detect_query_stream(s_term)
                        is_rem = s_stream.lower() == "remote" or any(
                            k in s_term.lower()
                            for k in (
                                "remote",
                                "wfh",
                                "work from home",
                                "anywhere in australia",
                            )
                        )
                        s_loc = "Australia" if is_rem else "Melbourne, VIC"
                        normalized_queries.append(
                            SearchQuery(term=s_term, location=s_loc, stream=s_stream)
                        )
                elif isinstance(q, dict):
                    term = str(q.get("term") or "").strip()
                    if term:
                        stream = str(
                            q.get("stream") or detect_query_stream(term)
                        ).strip()
                        is_rem = (
                            stream.lower() == "remote"
                            or any(
                                k in term.lower()
                                for k in (
                                    "remote",
                                    "wfh",
                                    "work from home",
                                    "anywhere in australia",
                                )
                            )
                            or bool(q.get("remote"))
                        )
                        raw_loc = str(
                            q.get("location")
                            or ("Australia" if is_rem else "Melbourne, VIC")
                        ).strip()
                        loc = (
                            "Australia"
                            if (
                                is_rem
                                and raw_loc.lower()
                                in ("melbourne, vic", "melbourne", "vic", "")
                            )
                            else (raw_loc or "Australia")
                        )
                        enabled = bool(q.get("enabled", True))
                        normalized_queries.append(
                            SearchQuery(
                                term=term, location=loc, stream=stream, enabled=enabled
                            )
                        )
                elif hasattr(q, "term"):
                    term = str(getattr(q, "term", "")).strip()
                    if term:
                        stream = str(
                            getattr(q, "stream", detect_query_stream(term))
                        ).strip()
                        is_rem = (
                            stream.lower() == "remote"
                            or any(
                                k in term.lower()
                                for k in (
                                    "remote",
                                    "wfh",
                                    "work from home",
                                    "anywhere in australia",
                                )
                            )
                            or bool(getattr(q, "remote", False))
                        )
                        raw_loc = str(
                            getattr(
                                q,
                                "location",
                                "Australia" if is_rem else "Melbourne, VIC",
                            )
                        ).strip()
                        loc = (
                            "Australia"
                            if (
                                is_rem
                                and raw_loc.lower()
                                in ("melbourne, vic", "melbourne", "vic", "")
                            )
                            else (raw_loc or "Australia")
                        )
                        enabled = bool(getattr(q, "enabled", True))
                        normalized_queries.append(
                            SearchQuery(
                                term=term, location=loc, stream=stream, enabled=enabled
                            )
                        )

            queries_to_scrape = []
            cached_query_terms = []
            db_satisfied_terms = []

            for q in normalized_queries:
                term = q.term
                loc = q.location

                # 1. Database-First: Check if SQLite already has sufficient fresh matching jobs (>= 10)
                if not force:
                    has_cov, match_count = self.repository.has_sufficient_matching_jobs(
                        term, loc, threshold=10, max_age_days=21
                    )
                    if has_cov:
                        db_satisfied_terms.append(term)
                        cached_query_terms.append(term)
                        # Record cache entry with actual matching count
                        self.repository.record_query_scrape(term, loc, match_count)
                        continue

                # 2. Query Scrape Cache: Check if scraped within TTL
                if not force and self.repository.is_query_cached(
                    term, loc, ttl_hours=ttl_hours
                ):
                    cached_query_terms.append(term)
                else:
                    queries_to_scrape.append(q)

            pipeline_errors = []
            if queries_to_scrape:
                if on_progress:
                    on_progress(
                        f"Scanning {len(queries_to_scrape)} live employment gateway queries...",
                        10,
                    )
                pipeline = ScrapePipeline(
                    self.sources, days=14, health_check=self.health_check
                )
                fresh = pipeline.run(queries_to_scrape, on_progress=on_progress)
                pipeline_errors = pipeline.errors
                self.source_health = getattr(pipeline, "source_health", {})

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

                    # Persist fresh materialized jobs into SQLite repository
                    try:
                        self.repository.replace_jobs(fresh_materialized)
                    except Exception as repo_err:
                        logger.warning(
                            f"Error persisting fresh jobs to repository: {repo_err}"
                        )

                    # Update jobs_combined.json for static client compatibility
                    try:
                        combined_path = self.data_dir / "jobs_combined.json"
                        combined_path.write_text(
                            json.dumps(self.jobs, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8",
                        )
                    except Exception as comb_err:
                        logger.warning(f"Error updating jobs_combined.json: {comb_err}")

                    from .config import settings

                    if settings.gcs_data_bucket:
                        backup_to_gcs(settings.gcs_data_bucket, self.data_dir)

                # Record cache hit timestamps for freshly scraped queries
                for q in queries_to_scrape:
                    term = q.term if hasattr(q, "term") else str(q.get("term", ""))
                    loc = (
                        q.location
                        if hasattr(q, "location")
                        else str(q.get("location", ""))
                    )
                    self.repository.record_query_scrape(term, loc, len(fresh or []))
            elif on_progress:
                on_progress(
                    f"All {len(cached_query_terms)} queries already fresh (cached), skipping re-scan...",
                    60,
                )

            # Recalibrate/score all database jobs against current profile when updated
            if queries_to_scrape or force:
                self.jobs = self.materialize_jobs(self.jobs)

            stats = {
                "total_jobs": len(self.jobs),
                "queries_scraped": len(queries_to_scrape),
                "queries_cached": len(cached_query_terms),
                "satisfied_from_db": db_satisfied_terms,
                "cache_hit": len(queries_to_scrape) == 0,
                "cached_terms": cached_query_terms,
                "skipped_jobs_count": len(getattr(self, "last_skipped_jobs", [])),
                "skipped_jobs": getattr(self, "last_skipped_jobs", []),
            }
            return self.public_jobs(), pipeline_errors, stats

    @staticmethod
    def _gmail_job_details(message):
        subject = re.sub(
            r"^\s*(re|fw|fwd)\s*:\s*", "", message.subject, flags=re.IGNORECASE
        ).strip()
        from_lower = (message.from_address or "").lower()
        sub_lower = subject.lower()

        title = ""
        company = ""

        # Specific Australian & Enterprise Employers
        if "kbr" in from_lower or "kbr" in sub_lower:
            company = "KBR"
        elif "schoolbox" in from_lower or "schoolbox" in sub_lower:
            company = "Schoolbox"
        elif "nexon" in from_lower or "nexon" in sub_lower:
            company = "Nexon"
        elif (
            "health.vic" in from_lower
            or "victorian department of health" in sub_lower
            or "department of health" in sub_lower
        ):
            company = "Victorian Department of Health"
        elif "racv" in from_lower or "racv" in sub_lower:
            company = "RACV"
        elif "olympus" in from_lower or "olympus" in sub_lower:
            company = "Olympus"
        elif "nextdc" in from_lower or "nextdc" in sub_lower:
            company = "NEXTDC"

        # Regex pattern matching for Title and Company
        match = re.search(
            r"(?:application|applying|applied|interest|submission|interview).*?(?:for|to|:)[\s\-]*(.+?)\s+(?:at|with)\s+(.+)$",
            subject,
            re.IGNORECASE,
        )
        if match:
            t, c = match.groups()
            title = title or t
            company = company or c
        else:
            # Check for "Company - Title" or "Company: Title" pattern
            comp_dash = re.search(
                r"^([A-Za-z0-9\s&.,'-]+?)\s*[:|–\-]\s*(?:Interview Invitation|Application Acknowledgment|Application Receipt|Application Received|Update on your application|Update|Status)?\s*[:|–\-]?\s*([A-Za-z0-9\s/()\-]+)$",
                subject,
                re.IGNORECASE,
            )
            if comp_dash:
                c, t = comp_dash.groups()
                company = company or c.strip()
                title = title or t.strip()

        if not title:
            # Check for explicit roles
            if "sharepoint" in sub_lower and "analyst" in sub_lower:
                title = "SharePoint Online Analyst"
            elif "cloud" in sub_lower and "engineer" in sub_lower:
                title = "Cloud Engineer"
            else:
                title = subject or "Gmail application"

        if not company:
            domain = re.search(r"@([\w.-]+)", message.from_address)
            if domain:
                company = domain.group(1).split(".")[0].replace("-", " ").title()

        # Clean noise from title and company
        title = re.sub(
            r"(?i)\b(interview\s*invitation|application\s*(?:received|confirmation|confirmed|acknowledgment|status|receipt)|update\s*on\s*your\s*application)\b",
            "",
            title,
        ).strip(" .:-")
        company = re.sub(
            r"(?i)\b(careers|talent|recruitment|jobs)\b", "", company
        ).strip(" .:-")
        return (title[:160].strip() or "Gmail application"), (
            company[:120].strip() or "Direct Employer"
        )

    @staticmethod
    def _gmail_status(category):
        return {
            "application_confirmed": "applied",
            "recruiter_reply": "applied",
            "interview_requested": "interviewing",
            "offer_extended": "offer",
            "rejected": "rejected",
        }.get(category, "applied")

    @staticmethod
    def _same_job(left, title, company):
        def tokens(value):
            return {
                token
                for token in re.findall(r"[a-z0-9]+", (value or "").lower())
                if len(token) > 2
            }

        left_title = tokens(left.get("title", ""))
        target_title = tokens(title)
        left_company = tokens(left.get("company", ""))
        target_company = tokens(company)

        norm = lambda s: re.sub(r"[^a-z0-9]", "", (s or "").lower())
        if (
            norm(left.get("company"))
            and norm(company)
            and norm(left.get("company")) == norm(company)
        ):
            if left_title & target_title:
                return True

        title_overlap = left_title & target_title
        company_overlap = left_company & target_company
        if company_overlap and len(title_overlap) >= 1:
            return True
        return len(title_overlap) >= 2 and (
            not company or not left.get("company") or company_overlap
        )

    def scan_gmail(
        self,
        username: str | None = None,
        app_password: str | None = None,
        days: int = 7,
    ):
        with self.lock:
            days = max(1, min(7, int(days)))
            credential_candidates = []
            for candidate in (
                Path(__file__).resolve().parents[2].glob("client_secret_*.json")
            ):
                try:
                    config = json.loads(candidate.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    continue
                if "installed" in config:
                    credential_candidates.insert(0, candidate)
                else:
                    credential_candidates.append(candidate)
            if username and app_password:
                scanner = GmailScanner(username, app_password, days=days)
            elif credential_candidates:
                scanner = GmailApiScanner(
                    str(credential_candidates[0]),
                    str(self.data_dir / "gmail_token.json"),
                    days=days,
                )
            else:
                raise RuntimeError(
                    "Gmail OAuth client file or IMAP credentials are required"
                )
            matched = created = updated = 0
            messages = scanner.application_messages()
            for message, category, confidence in messages:
                title, company = self._gmail_job_details(message)
                existing = next(
                    (job for job in self.jobs if self._same_job(job, title, company)),
                    None,
                )
                status = self._gmail_status(category)
                if existing:
                    job_id = normalize_job(existing).id
                    events = existing.setdefault("email_events", [])
                    # Deduplicate event records by email_id
                    if not any(e.get("email_id") == message.email_id for e in events):
                        events.append(
                            {
                                "email_id": message.email_id,
                                "category": category,
                                "received_at": message.received_at,
                                "confidence": confidence,
                            }
                        )
                    self.repository.update_status(job_id, status)
                    updated += 1
                    matched += 1
                    continue

                # Ensure we do not duplicate-create by email_id
                existing_gmail_job = next(
                    (
                        job
                        for job in self.jobs
                        if job.get("id") == f"gmail-{message.email_id}"
                    ),
                    None,
                )
                if existing_gmail_job:
                    self.repository.update_status(existing_gmail_job["id"], status)
                    updated += 1
                    continue

                posted_date = (message.received_at or "")[:10]
                if not re.match(r"^\d{4}-\d{2}-\d{2}$", posted_date):
                    posted_date = (
                        datetime.datetime.now(datetime.timezone.utc).date().isoformat()
                    )

                clean_desc = EmailClassifier.clean_email_text(
                    message.body_preview or message.snippet
                )
                new_job = {
                    "id": f"gmail-{message.email_id}",
                    "title": title,
                    "company": company,
                    "location": "",
                    "description": clean_desc,
                    "source": "Gmail",
                    "url": "",
                    "posted": posted_date,
                    "remote": False,
                    "tags": ["gmail", "application", category],
                    "email_events": [
                        {
                            "email_id": message.email_id,
                            "category": category,
                            "received_at": message.received_at,
                            "confidence": confidence,
                        }
                    ],
                }
                self.jobs.extend(self.materialize_jobs([new_job]))
                self.save_jobs()
                self.repository.update_status(new_job["id"], status)
                created += 1
            if updated:
                self.save_jobs()
            return {
                "scanned": len(messages),
                "matched": matched,
                "updated": updated,
                "created": created,
                "jobs": self.public_jobs(),
            }

    def start_gmail_scan(self):
        thread = threading.Thread(
            target=self.scan_gmail, kwargs={"days": 7}, daemon=True
        )
        thread.start()
        return thread

    def sync_tracker(self):
        """Pull the shared application tracker sheet and reconcile it against current jobs."""
        if not TRACKER_CSV_URL:
            self.tracker_state = {
                **self.tracker_state,
                "status": "idle",
                "rows": 0,
                "matched": 0,
            }
            return self.tracker_state
        self.tracker_state = {**self.tracker_state, "status": "syncing"}
        try:
            request = urllib.request.Request(
                TRACKER_CSV_URL, headers={"User-Agent": "job-dashboard/1.0"}
            )
            with urllib.request.urlopen(request, timeout=20) as response:
                text = response.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError) as error:
            self.tracker_state = {
                **self.tracker_state,
                "status": "failed",
                "error": str(error),
            }
            return self.tracker_state
        rows = [
            row
            for row in csv.DictReader(io.StringIO(text))
            if any(value.strip() for value in row.values())
        ]
        self.tracker_rows = rows
        matched = 0
        for row in rows:
            title = str(
                row.get("Job Title")
                or row.get("Title")
                or row.get("Role")
                or row.get("Position")
                or ""
            ).strip()
            company = str(row.get("Company") or row.get("Employer") or "").strip()
            status = str(row.get("Status") or row.get("Stage") or "").strip().lower()
            if not title:
                continue
            existing = next(
                (job for job in self.jobs if self._same_job(job, title, company)), None
            )
            if not existing:
                continue
            matched += 1
            mapped_status = self._map_tracker_status(status)
            if mapped_status:
                try:
                    self.update_status(normalize_job(existing).id, mapped_status)
                except (KeyError, ValueError):
                    pass
        self.tracker_state = {
            "status": "completed",
            "last_sync": time.time(),
            "rows": len(rows),
            "matched": matched,
            "error": None,
        }
        return self.tracker_state

    def start_tracker_sync(self):
        thread = threading.Thread(target=self.sync_tracker, daemon=True)
        thread.start()
        return thread

    @staticmethod
    def _map_tracker_status(status_text: str) -> str | None:
        """Classify a free-text tracker status cell into a dashboard stage."""
        text = status_text.lower()
        if any(
            term in text
            for term in ("unsuccessful", "reject", "declined", "closed", "expired")
        ):
            return "rejected"
        if "offer" in text:
            return "offer"
        if "interview" in text:
            return "interviewing"
        if any(term in text for term in ("shortlist",)):
            return "shortlisted"
        if any(
            term in text
            for term in (
                "applied",
                "submitted",
                "confirmation",
                "confirmed",
                "under review",
                "action required",
                "viewed",
                "response received",
            )
        ):
            return "applied"
        return None

    def tracker_suggestions(self):
        """Tracker rows not yet represented among the dashboard's jobs."""
        suggestions = []
        for row in self.tracker_rows:
            title = str(
                row.get("Job Title")
                or row.get("Title")
                or row.get("Role")
                or row.get("Position")
                or ""
            ).strip()
            company = str(row.get("Company") or row.get("Employer") or "").strip()
            if not title or any(
                self._same_job(job, title, company) for job in self.jobs
            ):
                continue
            suggestions.append(
                {
                    "title": title,
                    "company": company or "Company not listed",
                    "status": str(row.get("Status") or row.get("Stage") or "").strip(),
                    "date": str(row.get("Date") or row.get("Applied") or "").strip(),
                    "notes": str(row.get("Notes") or "").strip(),
                    "email_link": str(
                        row.get("Email Link")
                        or row.get("Email link")
                        or row.get("Email")
                        or ""
                    ).strip(),
                }
            )
        return suggestions

    # Phase 4B: Advanced AI Features
    def analyze_resume_ai(self, resume_text: str) -> dict:
        """AI-powered resume analysis."""
        analyzer = get_resume_analyzer()
        return analyzer.analyze(resume_text)

    def simulate_interview(
        self, job_description: str, role: str, question_count: int = 5
    ) -> dict:
        """Simulate an interview for a job."""
        simulator = get_interview_simulator()
        return simulator.create_session(job_description, role, question_count)

    def submit_interview_answer(
        self, session_id: str, question_id: str, answer: str
    ) -> dict:
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
                documents = generator.generate(
                    normalize_job(raw), self.dashboard.profile
                )
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
        self.generation_progress[job_id] = {
            "phase": "Completed",
            "estimate_seconds": 0,
            "progress": 100,
            "started_at": started_at,
            "done": True,
            **self.generated_documents[job_id],
        }
        return {**documents, **self.generated_documents[job_id]}

    def start_generation(self, job_id):
        existing = self._recover_generated_documents(job_id)
        if existing and self._documents_exist(existing):
            return {
                "phase": "Completed",
                "estimate_seconds": 0,
                "progress": 100,
                "done": True,
                **existing,
            }
        if self.generation_progress.get(job_id, {}).get("done"):
            return self.generation_progress[job_id]
        started_at = time.time()
        self.generation_progress[job_id] = self._generation_status(job_id, started_at)

        def runner():
            try:
                generated = self.generate(job_id)
                status = {
                    "phase": "Completed",
                    "estimate_seconds": 0,
                    "progress": 100,
                    "started_at": started_at,
                    "done": True,
                    **generated,
                }
            except Exception as error:
                status = {
                    "phase": "Failed",
                    "error": str(error),
                    "estimate_seconds": 0,
                    "progress": 100,
                    "started_at": started_at,
                    "done": True,
                    "failed": True,
                }
            self.generation_progress[job_id] = status

        thread = threading.Thread(target=runner, daemon=True)
        thread.start()
        return self.generation_progress[job_id]


def _is_valid_profile(p: Any) -> bool:
    """Return True if p is a non-empty, valid candidate profile dictionary."""
    if not p or not isinstance(p, dict):
        return False
    return bool(
        p.get("coreSkills")
        or p.get("targetTitles")
        or p.get("title")
        or p.get("industry")
        or p.get("job_titles")
        or p.get("skills")
        or p.get("name")
        or p.get("email")
        or p.get("fullWorkExperienceText")
        or p.get("professional_summary")
        or len(p) >= 2
    )


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
            from .security import decode_token

            decoded = decode_token(token)
            if decoded and decoded.get("sub"):
                return str(decoded["sub"])
        except Exception:
            pass
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


def validate_password_complexity(password: str) -> tuple[bool, str]:
    """
    Validates password complexity:
    - At least 8 characters
    - At least one uppercase letter [A-Z]
    - At least one lowercase letter [a-z]
    - At least one numeric digit [0-9]
    - At least one special character / symbol
    """
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not any(c.isupper() for c in password):
        return False, "Password must include at least one uppercase letter (A-Z)."
    if not any(c.islower() for c in password):
        return False, "Password must include at least one lowercase letter (a-z)."
    if not any(c.isdigit() for c in password):
        return False, "Password must include at least one number (0-9)."
    special_chars = set("!@#$%^&*()_+-=[]{};':\"|,.<>/?~`")
    if not any(c in special_chars for c in password):
        return (
            False,
            "Password must include at least one special character (!@#$%^&* etc.).",
        )
    return True, ""


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
        def __init__(self, *args, **kwargs):
            self.app = app
            super().__init__(*args, **kwargs)

        def _cors_origin(self):
            origin = self.headers.get("Origin", "")
            if origin in _ALLOWED_ORIGINS:
                return origin
            return ""

        def _send_cors_headers(self):
            origin = self._cors_origin()
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header(
                "Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"
            )
            self.send_header(
                "Access-Control-Allow-Headers",
                "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-User-Id",
            )
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

        def do_HEAD(self):
            parsed = urlparse(self.path)
            path = parsed.path
            if path in ("/health", "/", "/index.html"):
                self.send_response(200)
                self.send_header(
                    "Content-Type",
                    "application/json"
                    if path == "/health"
                    else "text/html; charset=utf-8",
                )
                self._send_cors_headers()
            else:
                self.do_GET()

        def _get_job_seek_pass_report(
            self, job_id: str, query_params: dict[str, list[str]] | None = None
        ) -> dict[str, Any] | None:
            job = None
            repo = (
                getattr(app, "repository", None)
                or (
                    app
                    if (hasattr(app, "get_job") or hasattr(app, "get_job_by_id"))
                    else None
                )
                or getattr(self, "repository", None)
            )
            if repo:
                if hasattr(repo, "get_job"):
                    job = repo.get_job(job_id)
                if not job and hasattr(repo, "get_job_by_id"):
                    job = repo.get_job_by_id(job_id)
            if not job and hasattr(app, "dashboard") and hasattr(app.dashboard, "jobs"):
                for j in app.dashboard.jobs:
                    if getattr(j, "id", "") == job_id:
                        job = j
                        break
            if not job:
                return None

            user_id = (
                resolve_user_id(self, query_params or {})
                if hasattr(self, "headers")
                else None
            )
            profile = None
            if repo and user_id and hasattr(repo, "get_user_profile"):
                profile = repo.get_user_profile(user_id)
            if (
                not profile
                and hasattr(app, "dashboard")
                and hasattr(app.dashboard, "profile")
            ):
                profile = app.dashboard.profile
            if not profile and repo and hasattr(repo, "get_profile"):
                profile = repo.get_profile()
            profile = profile or {}

            job_dict = (
                dict(job)
                if isinstance(job, dict)
                else (dict(job.__dict__) if hasattr(job, "__dict__") else {})
            )
            job_dict.setdefault("id", job_id)
            return generate_seek_pass_report(job_dict, profile)

        def do_GET(self):
            self.command = "GET"
            parsed = urlparse(self.path)
            path = parsed.path
            query_params = parse_qs(parsed.query)

            if app_router.dispatch(self, "GET", path):
                return

            static_dir = Path(__file__).parent / "static"
            target_asset = (static_dir / path.removeprefix("/")).resolve()
            if target_asset.is_file() and str(target_asset).startswith(
                str(static_dir.resolve())
            ):
                data = target_asset.read_bytes()
                self.send_response(200)
                self.send_header(
                    "Content-Type",
                    mimetypes.guess_type(target_asset.name)[0] or "text/plain",
                )
                self.send_header("Content-Length", str(len(data)))
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(data)
                return

            if path == "/" or (
                not path.startswith("/api/")
                and not path.startswith("/health")
                and not path.startswith("/metrics")
            ):
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
            self.command = "POST"
            parsed = urlparse(self.path)
            path = parsed.path
            query_params = parse_qs(parsed.query)
            try:
                if app_router.dispatch(self, "POST", path):
                    return
                self.send_json(404, {"error": f"Endpoint not found: {path}"})
            except Exception as error:
                logger.error(f"POST {path} failed: {error}", exc_info=True)
                self.send_json(500, {"error": str(error)})

        def do_DELETE(self):
            self.command = "DELETE"
            parsed = urlparse(self.path)
            path = parsed.path
            query_params = parse_qs(parsed.query)
            try:
                if app_router.dispatch(self, "DELETE", path):
                    return
                self.send_json(404, {"error": f"Endpoint not found: {path}"})
            except Exception as error:
                logger.error(f"DELETE {path} failed: {error}", exc_info=True)
                self.send_json(500, {"error": str(error)})

        def log_message(self, *_args):
            return

    Handler.app = app
    return Handler


JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-fallback")
JWT_EXPIRY_HOURS = 24


def serve(app: DashboardApp, host: str = "127.0.0.1", port: int = 8787):
    server = ThreadingHTTPServer((host, port), make_handler(app))
    print(f"Job dashboard running at http://{host}:{port}")
    server.serve_forever()
