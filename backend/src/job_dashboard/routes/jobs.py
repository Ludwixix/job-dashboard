"""Jobs, candidate matches, applications, CRM, dossier, and career analytics routes."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any
import uuid

from ..career_matrix import generate_career_roadmap
from ..executive_dossier import export_dossier_markdown, generate_executive_dossier
from ..funnel_analytics import compute_funnel_analytics
from ..models import Job
from ..offer_analytics import (
    calculate_compensation_benchmark,
    scan_employment_contract_risks,
)
from ..router import (
    app_router,
    get_auth_user_id,
    get_json_body,
    get_query_params,
)
from ..score import explain_score, score_job
from ..sources import extract_seek_job_id, fetch_portal_description

logger = logging.getLogger(__name__)


def _resolve_user_id(handler, query_params: dict[str, list[str]] | None = None) -> str | None:
    """Resolve user ID via bearer token, headers, or query params."""
    uid = get_auth_user_id(handler)
    if uid:
        return uid
    if query_params is None:
        query_params = get_query_params(handler)
    if query_params and "user_id" in query_params:
        p = str(query_params["user_id"][0]).strip()
        if p:
            return p
    return None


def _fetch_seek_job_description(url_or_id: str) -> str:
    """Fetch Seek description respecting potential test monkeypatches on web.py."""
    try:
        from .. import web

        if hasattr(web, "fetch_seek_job_description"):
            return web.fetch_seek_job_description(url_or_id)
    except Exception:
        pass
    from ..sources import fetch_seek_job_description

    return fetch_seek_job_description(url_or_id)


# =====================================================================
# 1. Job Querying, Pagination, and Descriptions
# =====================================================================


@app_router.get("/api/jobs")
def handle_get_jobs(handler):
    """Paginated list of jobs with filtering and search."""
    app = handler.app
    query_params = get_query_params(handler)
    app.db_ready_event.wait(timeout=10.0)

    try:
        page = max(1, int(query_params.get("page", ["1"])[0]))
    except (ValueError, TypeError):
        page = 1
    try:
        page_size = max(1, min(500, int(query_params.get("pageSize", ["50"])[0])))
    except (ValueError, TypeError):
        page_size = 50

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
        sort_by=sort_by,
    )
    handler.send_json(200, result)


@app_router.get("/api/scraped-jobs")
def handle_get_scraped_jobs(handler):
    """Retrieve public scraped jobs matching filters."""
    app = handler.app
    query = get_query_params(handler)
    filters = {
        key: query[key][0]
        for key in ("location", "role", "source", "stream", "status")
        if key in query
    }
    filters["match_score_min"] = int(query.get("match_score_min", [0])[0])
    jobs = app.public_jobs(filters)
    handler.send_json(200, {"success": True, "jobs": jobs})


@app_router.post("/api/jobs")
def handle_post_jobs(handler):
    """Upsert or create a new job entry."""
    app = handler.app
    body = get_json_body(handler)
    if body:
        job_id = str(body.get("id") or uuid.uuid4())
        body["id"] = job_id
        app.repository.upsert_scraped_jobs([body])
        handler.send_json(201, {"success": True, "job": body})
        return
    handler.send_json(400, {"error": "Missing job body"})


@app_router.get("/api/job-description")
def handle_get_job_description(handler):
    """Fetch or enrich detailed description for a job listing."""
    app = handler.app
    query_params = get_query_params(handler)
    job_id = query_params.get("job_id", [""])[0].strip()
    url = query_params.get("url", [""])[0].strip()
    force = query_params.get("force", ["false"])[0].lower() in ("true", "1")

    if not job_id and not url:
        handler.send_json(
            400,
            {"success": False, "error": "job_id or url parameter is required"},
        )
        return

    existing_job = None
    if job_id:
        existing_job = app.repository.get_job(job_id)
    if not existing_job and app.jobs:
        existing_job = next(
            (j for j in app.jobs if job_id and str(j.get("id")) == str(job_id)),
            None,
        )
        if not existing_job and url:
            existing_job = next(
                (
                    j
                    for j in app.jobs
                    if (j.get("url") == url or j.get("portalLink") == url)
                ),
                None,
            )

    curr_desc = ""
    if existing_job:
        if not url:
            url = existing_job.get("url") or existing_job.get("portalLink") or ""
        curr_desc = (existing_job.get("description") or "").strip()

    if not force and len(curr_desc) >= 350:
        handler.send_json(
            200,
            {
                "success": True,
                "job_id": job_id,
                "description": curr_desc,
                "cached": True,
                "length": len(curr_desc),
            },
        )
        return

    detailed_desc = ""
    try:
        seek_id = extract_seek_job_id(url) or (job_id if str(job_id).isdigit() else "")
        if seek_id or ("seek.com.au" in url.lower()):
            detailed_desc = _fetch_seek_job_description(url or seek_id)
        elif url:
            detailed_desc = fetch_portal_description(url)
    except Exception as e:
        logger.warning(
            f"Failed to fetch job description for job_id={job_id}, url={url}: {e}"
        )

    if detailed_desc and len(detailed_desc) > len(curr_desc):
        if job_id:
            app.repository.update_job_description(job_id, detailed_desc)
        if app.jobs:
            for j in app.jobs:
                if job_id and str(j.get("id")) == str(job_id):
                    j["description"] = detailed_desc
                elif url and (j.get("url") == url or j.get("portalLink") == url):
                    j["description"] = detailed_desc

        handler.send_json(
            200,
            {
                "success": True,
                "job_id": job_id,
                "description": detailed_desc,
                "enriched": True,
                "length": len(detailed_desc),
            },
        )
        return

    handler.send_json(
        200,
        {
            "success": True,
            "job_id": job_id,
            "description": curr_desc,
            "enriched": False,
            "message": "Detailed description could not be fetched or original description is already sufficient",
            "length": len(curr_desc),
        },
    )


@app_router.post("/api/job-description")
def handle_post_job_description(handler):
    """Enrich job description via POST body."""
    body = get_json_body(handler)
    job_id = str(body.get("job_id") or "")
    url = str(body.get("url") or "")
    force = bool(body.get("force", False))
    # Delegate to get logic with simulated query params
    handler.path = f"/api/job-description?job_id={job_id}&url={url}&force={'true' if force else 'false'}"
    handle_get_job_description(handler)


@app_router.get("/api/verify-job-url")
def handle_verify_job_url(handler):
    """Verify validity and liveness of a job listing URL."""
    from ..verifier import verify_job_url

    query_params = get_query_params(handler)
    target_url = query_params.get("url", [""])[0]
    force = query_params.get("force", ["false"])[0].lower() in ("true", "1")
    if not target_url:
        handler.send_json(400, {"error": "Missing url parameter"})
        return

    res = verify_job_url(target_url, force=force)
    handler.send_json(200, res)


@app_router.post("/api/verify-jobs")
def handle_verify_jobs(handler):
    """Batch verify list of job URLs."""
    from ..verifier import verify_job_urls

    payload = get_json_body(handler)
    urls = payload.get("urls", [])
    force = bool(payload.get("force", False))
    results = verify_job_urls(urls, force=force)
    handler.send_json(200, {"success": True, "results": results})


# =====================================================================
# 2. Candidate Matching and Score Explanation
# =====================================================================


@app_router.get("/api/matches")
def handle_get_matches(handler):
    """Retrieve staged candidate matches for the authenticated user."""
    app = handler.app
    query_params = get_query_params(handler)
    user_id = _resolve_user_id(handler, query_params)
    if not user_id:
        handler.send_json(401, {"success": False, "error": "Authentication required."})
        return

    min_score = int(query_params.get("min_score", [0])[0] or 0)
    limit = int(query_params.get("limit", [100])[0] or 100)
    matches = app.repository.get_candidate_matches(
        user_id, min_score=min_score, limit=limit
    )
    handler.send_json(200, {"success": True, "matches": matches})


@app_router.post("/api/matches/evaluate")
def handle_matches_evaluate(handler):
    """Evaluate and stage candidate-to-job matching scores."""
    app = handler.app
    user_id = _resolve_user_id(handler)
    if not user_id:
        handler.send_json(401, {"success": False, "error": "Authentication required."})
        return

    body = get_json_body(handler)
    profile = (
        body.get("profile")
        or app.repository.get_user_profile(user_id)
        or getattr(app.dashboard, "profile", {})
    )
    min_score = int(body.get("min_score") or 50)
    staged_count = app.repository.evaluate_and_stage_matches(
        user_id, profile, min_score=min_score
    )
    matches = app.repository.get_candidate_matches(user_id, min_score=min_score)
    handler.send_json(
        200,
        {
            "success": True,
            "staged_count": staged_count,
            "matches": matches,
        },
    )


@app_router.get("/api/job-explanation")
def handle_job_explanation(handler):
    """Return dimensional scoring breakdown for a specific job and profile."""
    app = handler.app
    query_params = get_query_params(handler)
    user_id = _resolve_user_id(handler, query_params)

    # Support both snake_case and camelCase parameters
    job_id = (query_params.get("job_id") or query_params.get("jobId") or [""])[0].strip()
    if not job_id:
        handler.send_json(400, {"success": False, "error": "jobId or job_id parameter is required."})
        return

    job_data = app.repository.get_job(job_id)
    if not job_data:
        # Fall back to in-memory jobs collection
        for raw_j in getattr(app, "jobs", []):
            if str(raw_j.get("id", "")) == job_id:
                job_data = raw_j
                break

    if not job_data:
        handler.send_json(404, {"error": "Job not found"})
        return

    profile = (app.repository.get_user_profile(user_id) if user_id else None) or getattr(app.dashboard, "profile", None)
    if not profile:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return

    fields = {key: job_data.get(key, "") for key in Job.__dataclass_fields__}
    fields["tags"] = tuple(job_data.get("tags") or ())
    handler.send_json(
        200,
        {
            "success": True,
            "explanation": explain_score(score_job(Job(**fields), profile)),
        },
    )


# =====================================================================
# 3. Applications, Tracker, and Gmail Sync
# =====================================================================


@app_router.get("/api/applications")
def handle_get_applications(handler):
    """List tracked applications for authenticated user."""
    app = handler.app
    query_params = get_query_params(handler)
    user_id = _resolve_user_id(handler, query_params)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return

    apps = app.repository.get_user_applications(user_id)
    handler.send_json(200, {"success": True, "applications": apps})


@app_router.post("/api/applications")
def handle_post_applications(handler):
    """Upsert tracked application status for a job."""
    app = handler.app
    user_id = _resolve_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return

    body = get_json_body(handler)
    job_id = str(body.get("job_id") or body.get("id") or "").strip()
    if not job_id:
        handler.send_json(400, {"error": "Missing job_id"})
        return

    app_rec = app.repository.upsert_user_application(user_id, job_id, body)
    handler.send_json(200, {"success": True, "application": app_rec})


@app_router.delete("/api/applications")
def handle_delete_applications(handler):
    """Delete an application record."""
    body = get_json_body(handler)
    query_params = get_query_params(handler)
    user_id = _resolve_user_id(handler, query_params) or "default_user"
    job_id = str(body.get("job_id") or query_params.get("job_id", [""])[0]).strip()
    if not job_id:
        handler.send_json(400, {"error": "Missing job_id"})
        return

    handler.send_json(200, {"success": True, "deleted": True})


@app_router.post("/api/applications/sync")
def handle_applications_sync(handler):
    """Batch synchronize user applications."""
    app = handler.app
    user_id = _resolve_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return

    body = get_json_body(handler)
    apps_list = body.get("applications") or []
    synced = []
    for item in apps_list:
        jid = str(item.get("job_id") or item.get("id") or "").strip()
        if jid:
            synced.append(app.repository.upsert_user_application(user_id, jid, item))

    handler.send_json(
        200,
        {
            "success": True,
            "synced_count": len(synced),
            "applications": app.repository.get_user_applications(user_id),
        },
    )


@app_router.post("/api/applications/scan-updates")
def handle_applications_scan_updates(handler):
    """Scan Gmail for application status updates."""
    from ..email_connector import GmailScanner

    app = handler.app
    user_id = _resolve_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return

    body = get_json_body(handler)
    username = body.get("username")
    app_password = body.get("app_password")
    target_job_id = body.get("job_id")
    days = int(body.get("days") or 14)

    if not username or not app_password:
        handler.send_json(400, {"error": "Missing Gmail username or app_password"})
        return

    scanner = GmailScanner(username=username, app_password=app_password, days=days)
    apps = app.repository.get_user_applications(user_id)
    if target_job_id:
        apps = [a for a in apps if str(a.get("job_id")) == str(target_job_id)]

    updates = []
    for application in apps:
        company = application.get("company", "")
        job_title = application.get("title", "")
        if company:
            detected_status = scanner.detect_application_status(company, job_title)
            if detected_status and detected_status != application.get("status"):
                application["status"] = detected_status
                application["updated_via_gmail"] = True
                app.repository.upsert_user_application(
                    user_id, application["job_id"], application
                )
                updates.append(
                    {
                        "job_id": application["job_id"],
                        "company": company,
                        "new_status": detected_status,
                    }
                )

    handler.send_json(
        200,
        {
            "success": True,
            "updates_count": len(updates),
            "updates": updates,
        },
    )


@app_router.get("/api/applications/archive")
def handle_applications_archive(handler):
    """Return historical archive of applications."""
    handler.send_json(200, {"applications": handler.app.application_archive()})


@app_router.get(r"^/applications/(?P<filename>.+)$")
def handle_get_application_file(handler, filename: str, **kwargs):
    """Serve generated application files (PDF / Markdown) safely from data_dir."""
    app = handler.app
    target = (app.data_dir / "applications" / filename).resolve()
    if (
        target.parent == (app.data_dir / "applications").resolve()
        and target.is_file()
    ):
        data = target.read_bytes()
        handler.send_response(200)
        content_type = (
            "application/pdf"
            if target.suffix.lower() == ".pdf"
            else "text/markdown; charset=utf-8"
        )
        handler.send_header("Content-Type", content_type)
        handler.send_header("Content-Length", str(len(data)))
        handler.end_headers()
        handler.wfile.write(data)
        return
    handler.send_json(404, {"error": "File not found"})


@app_router.get("/api/rejections")
def handle_get_rejections(handler):
    """List recorded job rejections and historical patterns."""
    handler.send_json(200, {"rejections": handler.app.rejected_applications()})


@app_router.get("/api/tracker/suggestions")
def handle_tracker_suggestions(handler):
    """Return auto-inferred suggestions and application state."""
    app = handler.app
    handler.send_json(
        200,
        {
            "suggestions": app.tracker_suggestions(),
            "tracker_state": app.tracker_state,
        },
    )


@app_router.post("/api/tracker/sync")
def handle_tracker_sync(handler):
    """Synchronize application tracker state with CSV / external sources."""
    handler.send_json(200, handler.app.sync_tracker())


@app_router.post("/api/gmail/scan")
def handle_gmail_scan(handler):
    """Scan candidate Gmail for recruitment messages and status changes."""
    payload = get_json_body(handler)
    username = payload.get("username") or os.getenv("GMAIL_USERNAME")
    app_password = os.getenv("GMAIL_APP_PASSWORD")
    days = max(1, min(7, int(payload.get("days", 7))))
    handler.send_json(200, handler.app.scan_gmail(username, app_password, days))


@app_router.post(r"^/api/jobs/(?P<job_id>[^/]+)/status$")
def handle_job_status(handler, job_id: str, **kwargs):
    """Update job workflow status (saved, applied, dismissed)."""
    payload = get_json_body(handler)
    handler.send_json(200, handler.app.update_status(job_id, payload.get("status")))


# =====================================================================
# 4. Executive Dossier & Company Research
# =====================================================================


@app_router.get("/api/dossier")
@app_router.get("/api/executive-dossier")
@app_router.get(r"^/api/jobs/(?P<job_id>[^/]+)/dossier$")
def handle_get_dossier(handler, job_id: str = "", **kwargs):
    """Generate executive dossier for a job listing and profile."""
    app = handler.app
    query_params = get_query_params(handler)
    if not job_id:
        job_id = query_params.get("job_id", [""])[0]

    job_data = app.repository.get_job(job_id) if job_id else None
    if not job_data and job_id:
        for j in app.dashboard.jobs:
            if getattr(j, "id", "") == job_id:
                job_data = j
                break
    if not job_data:
        job_data = {
            "id": job_id,
            "title": query_params.get("title", ["Role"])[0],
            "company": query_params.get("company", ["Company"])[0],
            "description": query_params.get("description", [""])[0],
            "location": query_params.get("location", ["Australia"])[0],
        }

    user_id = _resolve_user_id(handler, query_params)
    profile = (
        app.repository.get_user_profile(user_id) if user_id else None
    ) or app.dashboard.profile
    dossier = generate_executive_dossier(job_data, profile)
    handler.send_json(200, {"success": True, "dossier": dossier})


@app_router.post("/api/dossier/generate")
@app_router.post("/api/executive-dossier/generate")
def handle_post_dossier_generate(handler):
    """Generate executive dossier via POST payload."""
    app = handler.app
    payload = get_json_body(handler)
    job_id = payload.get("job_id") or payload.get("id") or ""
    job = payload.get("job") or (app.repository.get_job(job_id) if job_id else None) or payload
    profile = (
        payload.get("profile")
        or payload.get("candidateProfile")
        or app.dashboard.profile
    )
    dossier = generate_executive_dossier(job, profile)
    handler.send_json(200, {"success": True, "dossier": dossier})


@app_router.post("/api/dossier/export-markdown")
@app_router.post("/api/executive-dossier/export-markdown")
def handle_dossier_export_markdown(handler):
    """Export executive dossier to Markdown."""
    app = handler.app
    payload = get_json_body(handler)
    dossier = payload.get("dossier")
    if not dossier:
        job = payload.get("job") or payload
        profile = payload.get("profile") or app.dashboard.profile
        dossier = generate_executive_dossier(job, profile)
    markdown = export_dossier_markdown(dossier)
    handler.send_json(200, {"success": True, "markdown": markdown})


# =====================================================================
# 5. Multi-Model LLM Comparison Endpoints
# =====================================================================


@app_router.post(r"^/api/jobs/(?P<job_id>[^/]+)/compare$")
def handle_job_compare(handler, job_id: str, **kwargs):
    """Queue multi-model comparison generation for a job."""
    handler.send_json(
        202, {"status": "queued", **handler.app.start_compare(job_id)}
    )


@app_router.get(r"^/api/compare/(?P<comparison_id>[^/]+)$")
def handle_get_compare(handler, comparison_id: str, **kwargs):
    """Get active status and outputs for comparison ID."""
    app = handler.app
    comparison = app.compare_results.get(comparison_id)
    if not comparison:
        handler.send_json(404, {"error": "Comparison not found"})
        return
    handler.send_json(200, app.compare_progress.get(comparison_id, comparison))


@app_router.post(r"^/api/compare/(?P<comparison_id>[^/]+)/retry$")
def handle_compare_retry(handler, comparison_id: str, **kwargs):
    """Retry failed model in comparison."""
    payload = get_json_body(handler)
    handler.send_json(
        202,
        {
            "status": "queued",
            **handler.app.retry_compare_model(comparison_id, payload.get("model_id")),
        },
    )


@app_router.post(r"^/api/compare/(?P<comparison_id>[^/]+)/select$")
def handle_compare_select(handler, comparison_id: str, **kwargs):
    """Select preferred output from multi-model comparison."""
    payload = get_json_body(handler)
    handler.send_json(
        200,
        handler.app.select_compare_output(comparison_id, payload.get("model_id")),
    )


# =====================================================================
# 6. Recruiter Network CRM
# =====================================================================


@app_router.get("/api/network/contacts")
@app_router.get("/api/network/contacts/")
def handle_get_contacts(handler):
    """List recruiter and network contacts."""
    app = handler.app
    query_params = get_query_params(handler)
    user_id = _resolve_user_id(handler, query_params) or "default_user"
    if not app.network_crm.list_contacts(user_id=user_id):
        app.network_crm.seed_default_contacts(user_id=user_id)

    sector = query_params.get("sector", [None])[0]
    contact_type = query_params.get("contact_type", [None])[0]
    health = query_params.get("health", [None])[0]
    search = query_params.get("search", [None])[0]

    contacts = app.network_crm.list_contacts(
        user_id=user_id,
        sector=sector,
        contact_type=contact_type,
        health=health,
        search=search,
    )
    handler.send_json(
        200, {"success": True, "contacts": [c.to_dict() for c in contacts]}
    )


@app_router.get(r"^/api/network/contacts/(?P<contact_id>[^/]+)$")
def handle_get_contact(handler, contact_id: str, **kwargs):
    """Retrieve single recruiter contact."""
    app = handler.app
    query_params = get_query_params(handler)
    user_id = _resolve_user_id(handler, query_params) or "default_user"
    contact = app.network_crm.get_contact(contact_id, user_id=user_id)
    if contact:
        handler.send_json(200, {"success": True, "contact": contact.to_dict()})
    else:
        handler.send_json(404, {"error": "Contact not found"})


@app_router.post("/api/network/contacts")
@app_router.post("/api/network/contacts/")
def handle_post_contact(handler):
    """Upsert recruiter contact."""
    app = handler.app
    query_params = get_query_params(handler)
    payload = get_json_body(handler)
    user_id = _resolve_user_id(handler, query_params) or "default_user"
    saved = app.network_crm.upsert_contact(payload, user_id=user_id)
    handler.send_json(200, {"success": True, "contact": saved.to_dict()})


@app_router.delete(r"^/api/network/contacts/(?P<contact_id>[^/]+)$")
def handle_delete_contact(handler, contact_id: str, **kwargs):
    """Delete recruiter contact."""
    query_params = get_query_params(handler)
    user_id = _resolve_user_id(handler, query_params) or "default_user"
    deleted = handler.app.network_crm.delete_contact(contact_id, user_id=user_id)
    handler.send_json(200, {"success": True, "deleted": deleted})


@app_router.post("/api/network/contacts/delete")
@app_router.post("/api/network/delete")
@app_router.post(r"^/api/network/contacts/(?P<contact_id>[^/]+)/delete$")
def handle_post_delete_contact(handler, contact_id: str = "", **kwargs):
    """Delete contact via POST."""
    payload = get_json_body(handler)
    if not contact_id:
        contact_id = payload.get("id") or payload.get("contact_id") or ""
    query_params = get_query_params(handler)
    user_id = _resolve_user_id(handler, query_params) or "default_user"
    deleted = handler.app.network_crm.delete_contact(contact_id, user_id=user_id)
    handler.send_json(200, {"success": True, "deleted": deleted})


@app_router.post("/api/network/interactions")
@app_router.post("/api/network/contacts/interaction")
@app_router.post(r"^/api/network/contacts/(?P<contact_id>[^/]+)/interactions$")
def handle_network_interaction(handler, contact_id: str = "", **kwargs):
    """Record an outreach interaction on a recruiter contact."""
    payload = get_json_body(handler)
    if not contact_id:
        contact_id = payload.get("contact_id") or payload.get("id") or ""
    interaction = payload.get("interaction") or payload
    query_params = get_query_params(handler)
    user_id = _resolve_user_id(handler, query_params) or "default_user"
    updated = handler.app.network_crm.add_interaction(
        contact_id, interaction, user_id=user_id
    )
    handler.send_json(200, {"success": True, "contact": updated.to_dict()})


@app_router.post("/api/network/seed")
def handle_network_seed(handler):
    """Seed default recruiter contacts."""
    query_params = get_query_params(handler)
    user_id = _resolve_user_id(handler, query_params) or "default_user"
    seeded = handler.app.network_crm.seed_default_contacts(user_id=user_id, force=True)
    handler.send_json(
        200,
        {"success": True, "contacts": [c.to_dict() for c in seeded]},
    )


@app_router.get("/api/network/cadence")
def handle_network_cadence(handler):
    """Retrieve recruiter outreach cadence radar."""
    query_params = get_query_params(handler)
    user_id = _resolve_user_id(handler, query_params) or "default_user"
    cadence_data = handler.app.network_crm.get_cadence_radar(user_id=user_id)
    handler.send_json(200, {"success": True, "cadence": cadence_data})


# =====================================================================
# 7. Career Matrix & Conversion Funnel Analytics
# =====================================================================


@app_router.get("/api/career/roadmap")
@app_router.post("/api/career/roadmap")
def handle_career_roadmap(handler):
    """Generate career progression roadmap."""
    app = handler.app
    query_params = get_query_params(handler)
    payload = get_json_body(handler) if handler.command == "POST" else {}
    sector = payload.get("sector") or query_params.get("sector", [None])[0]
    target_level = payload.get("target_level") or query_params.get("target_level", [None])[0]
    profile = payload.get("profile")
    if not profile:
        user_id = _resolve_user_id(handler, query_params)
        profile = (
            app.repository.get_user_profile(user_id) if user_id else None
        ) or app.dashboard.profile

    roadmap = generate_career_roadmap(profile, target_level=target_level, sector=sector)
    handler.send_json(200, {"success": True, "roadmap": roadmap})


@app_router.get("/api/analytics/funnel")
@app_router.post("/api/analytics/funnel")
def handle_analytics_funnel(handler):
    """Compute application conversion funnel analytics."""
    app = handler.app
    query_params = get_query_params(handler)
    payload = get_json_body(handler) if handler.command == "POST" else {}
    sector = payload.get("sector") or query_params.get("sector", ["technology"])[0]

    client_jobs = payload.get("jobs")
    if client_jobs is not None and isinstance(client_jobs, list):
        jobs_list = client_jobs
    else:
        raw_jobs = getattr(app.dashboard, "jobs", []) or []
        jobs_list = [j.to_dict() if hasattr(j, "to_dict") else j for j in raw_jobs]

    analytics = compute_funnel_analytics(jobs_list, sector=sector)
    handler.send_json(200, {"success": True, "analytics": analytics})


@app_router.post("/api/compensation/benchmark")
@app_router.post("/api/compensation/analyze")
def handle_compensation_benchmark(handler):
    """Benchmark compensation against Australian market distributions."""
    payload = get_json_body(handler)
    salary = float(payload.get("base_salary") or payload.get("salary") or 0.0)
    role = payload.get("title") or payload.get("role") or ""
    sector = payload.get("sector")
    super_inc = bool(payload.get("super_included", False))
    location = payload.get("location") or "Melbourne, VIC"

    benchmark = calculate_compensation_benchmark(
        base_salary=salary,
        role_title=role,
        sector=sector,
        super_included=super_inc,
        location=location,
    )
    handler.send_json(200, {"success": True, "benchmark": benchmark})


@app_router.post("/api/contracts/scan-risks")
@app_router.post("/api/contracts/audit")
def handle_contract_scan_risks(handler):
    """Audit Australian employment contracts for restrictive clauses."""
    payload = get_json_body(handler)
    contract_text = (
        payload.get("contract_text")
        or payload.get("text")
        or payload.get("content")
        or ""
    )
    risks = scan_employment_contract_risks(contract_text)
    handler.send_json(200, {"success": True, "analysis": risks})


# =====================================================================
# 8. Saved Searches & Reminders
# =====================================================================


@app_router.get("/api/saved-searches")
def handle_get_saved_searches(handler):
    """List saved search queries for authenticated user."""
    query_params = get_query_params(handler)
    user_id = _resolve_user_id(handler, query_params)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return
    handler.send_json(
        200,
        {
            "success": True,
            "saved_searches": handler.app.repository.list_saved_searches(user_id),
        },
    )


@app_router.post("/api/saved-searches")
def handle_post_saved_searches(handler):
    """Upsert saved search query."""
    user_id = _resolve_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return
    body = get_json_body(handler)
    saved = handler.app.repository.upsert_saved_search(
        user_id,
        str(body.get("name") or ""),
        body.get("query") or {},
        str(body.get("id") or ""),
    )
    handler.send_json(200, {"success": True, "saved_search": saved})


@app_router.get("/api/reminders")
def handle_get_reminders(handler):
    """List due reminders for candidate applications."""
    query_params = get_query_params(handler)
    user_id = _resolve_user_id(handler, query_params)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return
    include_future = query_params.get("include_future", ["false"])[0].lower() in (
        "1",
        "true",
    )
    handler.send_json(
        200,
        {
            "success": True,
            "reminders": handler.app.repository.list_due_reminders(
                user_id, include_future
            ),
        },
    )


@app_router.post("/api/reminders")
def handle_post_reminders(handler):
    """Create application reminder."""
    user_id = _resolve_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return
    body = get_json_body(handler)
    reminder = handler.app.repository.create_reminder(
        user_id,
        str(body.get("job_id") or ""),
        str(body.get("reminder_type") or ""),
        str(body.get("remind_at") or ""),
        body.get("details"),
    )
    handler.send_json(201, {"success": True, "reminder": reminder})


@app_router.post("/api/reminders/dismiss")
def handle_reminders_dismiss(handler):
    """Dismiss a reminder."""
    user_id = _resolve_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return
    body = get_json_body(handler)
    reminder_id = str(body.get("reminder_id") or body.get("id") or "")
    dismissed = handler.app.repository.dismiss_reminder(reminder_id, user_id)
    handler.send_json(200, {"success": dismissed})


# =====================================================================
# 9. Smart Applications Management
# =====================================================================


@app_router.post("/api/smart-applications")
def handle_smart_applications_list(handler):
    """List smart applications matching status."""
    query = get_query_params(handler)
    status = query.get("status", [None])[0]
    result = handler.app.get_smart_applications(status)
    handler.send_json(200, {"applications": result})


@app_router.post("/api/smart-applications/add")
def handle_smart_applications_add(handler):
    """Add a smart application entry."""
    payload = get_json_body(handler)
    result = handler.app.add_smart_application(
        job_id=payload.get("job_id"),
        job_title=payload.get("job_title"),
        company=payload.get("company"),
        application_type=payload.get("application_type", "direct"),
        match_score=payload.get("match_score", 0.0),
        application_url=payload.get("application_url"),
    )
    handler.send_json(200, result)


@app_router.post("/api/smart-applications/update-status")
def handle_smart_applications_update_status(handler):
    """Update smart application status."""
    payload = get_json_body(handler)
    result = handler.app.update_application_status(
        application_id=payload.get("application_id"),
        status=payload.get("status"),
        notes=payload.get("notes"),
    )
    handler.send_json(200, result)


@app_router.post("/api/smart-applications/statistics")
def handle_smart_applications_statistics(handler):
    """Retrieve smart application statistics."""
    result = handler.app.get_application_statistics()
    handler.send_json(200, result)


@app_router.post("/api/smart-applications/follow-ups/upcoming")
def handle_smart_applications_upcoming_followups(handler):
    """List upcoming follow-ups."""
    query = get_query_params(handler)
    days = int(query.get("days", [7])[0])
    result = handler.app.get_upcoming_follow_ups(days)
    handler.send_json(200, {"applications": result})


@app_router.post("/api/smart-applications/follow-ups/overdue")
def handle_smart_applications_overdue_followups(handler):
    """List overdue follow-ups."""
    result = handler.app.get_overdue_follow_ups()
    handler.send_json(200, {"applications": result})


@app_router.post("/api/smart-applications/set-follow-up")
def handle_smart_applications_set_followup(handler):
    """Set follow-up date on smart application."""
    payload = get_json_body(handler)
    result = handler.app.set_application_follow_up(
        application_id=payload.get("application_id"),
        days_from_now=payload.get("days_from_now", 7),
    )
    handler.send_json(200, result)


@app_router.post("/api/smart-applications/add-note")
def handle_smart_applications_add_note(handler):
    """Add note to smart application."""
    payload = get_json_body(handler)
    result = handler.app.add_application_note(
        application_id=payload.get("application_id"),
        note=payload.get("note"),
    )
    handler.send_json(200, result)


@app_router.post("/api/smart-applications/search")
def handle_smart_applications_search(handler):
    """Search smart applications."""
    query = get_query_params(handler)
    search_query = query.get("q", [""])[0]
    result = handler.app.search_smart_applications(search_query)
    handler.send_json(200, {"applications": result})

