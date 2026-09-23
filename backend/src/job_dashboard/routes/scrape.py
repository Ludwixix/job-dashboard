"""Scraping, SSE streaming, search criteria, source health, telemetry, and metrics routes."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import time
from typing import Any
import urllib.request

from ..digest import format_slack_digest_blocks, generate_morning_digest
from ..gcs_backup import create_backup_snapshot, get_backup_status
from ..openapi import generate_openapi_spec
from ..router import (
    app_router,
    get_auth_user_id,
    get_json_body,
    get_query_params,
)
from ..sources import SearchQuery, detect_query_stream
from ..sources.self_healing import (
    apply_and_verify_patch,
    diagnose_source,
    get_all_sources_health_summary,
    get_source_code_context,
    remediate_runtime,
)
from ..system_metrics import get_system_telemetry

logger = logging.getLogger(__name__)


def _resolve_user_id(
    handler, query_params: dict[str, list[str]] | None = None
) -> str | None:
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


# =====================================================================
# 1. Scraping Coordination & Execution
# =====================================================================


@app_router.post("/api/refresh")
@app_router.post("/api/scrape")
def handle_scrape_refresh(handler):
    """Trigger on-demand multi-source job scrape refresh."""
    app = handler.app
    payload = get_json_body(handler)
    raw_queries = payload.get("queries", [])
    if not isinstance(raw_queries, list):
        raw_queries = []

    queries = []
    for item in raw_queries:
        if isinstance(item, str):
            term = item.strip()
            location, stream, group, weight, exclude_terms, enabled = (
                "Melbourne, VIC",
                detect_query_stream(term),
                "",
                1.0,
                (),
                True,
            )
        elif isinstance(item, dict):
            term = str(item.get("term") or "").strip()
            location = str(item.get("location") or "Melbourne, VIC")
            stream = str(item.get("stream") or detect_query_stream(term))
            group = str(item.get("group") or "")
            weight = float(item.get("weight", 1.0))
            exclude_terms = tuple(str(v) for v in (item.get("exclude_terms") or ()))
            enabled = bool(item.get("enabled", True))
        else:
            continue
        if term:
            queries.append(
                SearchQuery(
                    term,
                    location,
                    stream,
                    group,
                    weight,
                    exclude_terms,
                    enabled,
                )
            )

    if not queries:
        user_id = _resolve_user_id(handler)
        user_profile = (
            app.repository.get_user_profile(user_id) if user_id else None
        ) or app.dashboard.profile
        if user_profile and (
            user_profile.get("targetTitles") or user_profile.get("target_titles")
        ):
            titles = (
                user_profile.get("targetTitles")
                or user_profile.get("target_titles")
                or []
            )
            loc = (
                str(user_profile.get("location") or "Melbourne, VIC").strip()
                or "Melbourne, VIC"
            )
            for t in titles:
                if str(t).strip():
                    queries.append(
                        SearchQuery(
                            term=str(t).strip(),
                            location=loc,
                            stream=detect_query_stream(str(t)),
                        )
                    )
        if not queries:
            queries = list(app.search_queries)

    force = bool(payload.get("force", False))
    ttl_hours = float(payload.get("ttl_hours", 12.0))
    coordinator = getattr(app, "scrape_coordinator", None)
    is_async = bool(payload.get("async", False)) or handler.path.endswith("/api/scrape")

    if is_async and coordinator:
        enqueued_results = coordinator.enqueue_queries(queries, app, force=force)
        handler.send_json(
            202,
            {
                "success": True,
                "enqueued": True,
                "queue_depth": coordinator.get_queue_depth(),
                "coordinator_status": coordinator.get_status(),
                "queries": enqueued_results,
            },
        )
        return

    try:
        jobs, errors, cache_stats = app.refresh(
            queries, force=force, ttl_hours=ttl_hours
        )
    except Exception as refresh_err:
        logger.warning(
            f"/api/refresh scrape failed, returning cached DB jobs: {refresh_err}"
        )
        try:
            cached_result = app.repository.query_jobs_paginated(page=1, page_size=5000)
            jobs = cached_result.get("jobs", [])
        except Exception:
            jobs = []
        errors = [str(refresh_err)]
        cache_stats = {"fallback": True, "total": len(jobs)}

    handler.send_json(
        200,
        {
            "jobs": jobs,
            "errors": errors,
            "cache_stats": cache_stats,
            "success": True,
        },
    )


@app_router.get("/api/scrape/status")
def handle_scrape_status(handler):
    """Retrieve active background scrape coordinator status and timers."""
    app = handler.app
    coordinator = getattr(app, "scrape_coordinator", None)
    if coordinator and hasattr(coordinator, "get_status"):
        status = coordinator.get_status()
        handler.send_json(200, {"success": True, **status})
    else:
        handler.send_json(
            200,
            {"success": True, "is_scraping": False, "queue_depth": 0},
        )


@app_router.get("/api/scrape/stream")
@app_router.post("/api/scrape/stream")
def handle_scrape_stream(handler):
    """Server-Sent Events (SSE) live progress stream during job scraping."""
    app = handler.app
    handler.send_response(200)
    handler.send_header("Content-Type", "text/event-stream")
    handler.send_header("Cache-Control", "no-cache")
    handler.send_header("Connection", "keep-alive")
    if hasattr(handler, "_send_cors_headers"):
        handler._send_cors_headers()
    handler.end_headers()

    queries = []
    if getattr(handler, "command", "GET") == "GET":
        query = get_query_params(handler)
        terms = query.get("term", ["Python Developer"])
        queries = [
            SearchQuery(
                term=t,
                location="Melbourne, VIC",
                stream=detect_query_stream(t),
            )
            for t in terms
        ]
    else:
        payload = get_json_body(handler)
        raw_queries = payload.get("queries", [])
        for item in raw_queries:
            if isinstance(item, str):
                queries.append(
                    SearchQuery(
                        term=item,
                        location="Melbourne, VIC",
                        stream=detect_query_stream(item),
                    )
                )
            elif isinstance(item, dict):
                queries.append(
                    SearchQuery(
                        term=str(item.get("term") or ""),
                        location=str(item.get("location") or "Melbourne, VIC"),
                        stream=str(
                            item.get("stream")
                            or detect_query_stream(str(item.get("term") or ""))
                        ),
                        group=str(item.get("group") or ""),
                        weight=float(item.get("weight", 1.0)),
                        exclude_terms=tuple(item.get("exclude_terms") or ()),
                        enabled=bool(item.get("enabled", True)),
                    )
                )
        if not queries:
            queries = list(app.search_queries)

    try:

        def on_progress(stage: str, percent: float):
            data = json.dumps({"stage": stage, "percent": percent})
            handler.wfile.write(f"data: {data}\n\n".encode("utf-8"))
            handler.wfile.flush()

        app.refresh(queries, on_progress=on_progress)
        handler.wfile.write(b"data: [DONE]\n\n")
        handler.wfile.flush()
    except Exception as e:
        logger.error(f"SSE scrape stream error: {e}")


# =====================================================================
# 2. Search Criteria Management
# =====================================================================


@app_router.get("/api/search-criteria")
def handle_get_search_criteria(handler):
    """List configured search discovery criteria queries."""
    app = handler.app
    queries_data = [
        {
            "term": q.term,
            "location": q.location,
            "stream": q.stream,
            "group": q.group,
            "weight": q.weight,
            "exclude_terms": list(q.exclude_terms),
            "enabled": q.enabled,
        }
        for q in app.search_queries
    ]
    handler.send_json(
        200,
        {
            "success": True,
            "queries": queries_data,
            "searchCriteria": queries_data,
            "criteria": queries_data,
        },
    )


@app_router.post("/api/search-criteria")
def handle_post_search_criteria(handler):
    """Save or update configured search discovery criteria queries."""
    app = handler.app
    payload = get_json_body(handler)
    if isinstance(payload, dict):
        raw_queries = payload.get(
            "queries", payload.get("items", payload.get("searchCriteria", []))
        )
    elif isinstance(payload, list):
        raw_queries = payload
    else:
        raw_queries = []

    res_queries = app.update_search_queries(raw_queries)
    handler.send_json(
        200,
        {
            "success": True,
            "queries": res_queries,
            "searchCriteria": res_queries,
            "criteria": res_queries,
        },
    )


@app_router.get("/api/search-criteria/defaults")
def handle_search_criteria_defaults(handler):
    """Retrieve default discovery search queries."""
    from ..scrape_config import DEFAULT_QUERIES

    handler.send_json(
        200,
        {
            "defaults": [
                {
                    "term": q.term,
                    "location": q.location,
                    "stream": q.stream,
                    "group": q.group,
                    "weight": q.weight,
                    "exclude_terms": list(q.exclude_terms),
                    "enabled": q.enabled,
                }
                for q in DEFAULT_QUERIES
            ]
        },
    )


@app_router.get("/api/search-criteria/suggestions")
def handle_search_criteria_suggestions(handler):
    """Generate search criteria suggestions inferred from candidate profile."""
    handler.send_json(200, {"queries": handler.app.suggested_search_queries()})


# =====================================================================
# 3. Health, Diagnostics, and Scraper Self-Healing
# =====================================================================


@app_router.get("/health")
@app_router.get("/api/health")
def handle_health(handler):
    """Liveness and container readiness health check probe."""
    app = handler.app
    handler.send_json(
        200,
        {
            "status": "healthy",
            "timestamp": time.time(),
            "version": "1.0.0",
            "services": {
                "database": True,
                "cache": True,
                "jobs_count": len(getattr(app, "jobs", [])),
            },
        },
    )


@app_router.get("/api/source-health")
def handle_source_health(handler):
    """Detailed health status and worker activity of job scraping sources."""
    app = handler.app
    query_params = get_query_params(handler)
    hours = max(1, min(168, int(query_params.get("hours", ["24"])[0])))
    workers_info = {
        "generation_tasks": len(getattr(app, "generation_progress", {})),
        "active_generation_tasks": len(
            [
                p
                for p in getattr(app, "generation_progress", {}).values()
                if not p.get("done", False)
            ]
        ),
        "scrape_in_progress": getattr(app, "scrape_in_progress", False),
        "scheduler_active": getattr(app, "scheduler_active", True),
    }
    checks = (
        app.health_check.get_recent_checks(hours=hours)
        if getattr(app, "health_check", None)
        else []
    )
    handler.send_json(
        200,
        {
            "success": True,
            "checks": checks,
            "workers": workers_info,
        },
    )


@app_router.get("/api/sources/health")
def handle_sources_health(handler):
    """Comprehensive health summary for all configured scraper adapters."""
    summary_data = get_all_sources_health_summary(handler.app)
    handler.send_json(
        200,
        {
            "status": "ok",
            "success": True,
            "summary": summary_data,
            "sources": summary_data,
            "overall_status": "healthy",
        },
    )


@app_router.post("/api/sources/diagnose")
def handle_sources_diagnose(handler):
    """Run diagnostics on a scraper adapter."""
    body = get_json_body(handler)
    source_name = body.get("source", "Seek")
    query = body.get("query", "Software Engineer")
    diag = diagnose_source(source_name, handler.app, probe_query=query)
    handler.send_json(200, {"success": True, "diagnosis": diag, **diag})


@app_router.post("/api/sources/remediate")
@app_router.post("/api/sources/heal")
def handle_sources_remediate(handler):
    """Remediate or self-heal runtime failures on a scraper source."""
    body = get_json_body(handler)
    source_name = body.get("source", "Seek")
    diag = body.get("diagnosis", {})
    res = remediate_runtime(source_name, handler.app, diag)
    handler.send_json(200, {"success": True, "remediation": res, **res})


@app_router.post("/api/sources/llm-repair-context")
def handle_sources_repair_context(handler):
    """Extract code context for LLM self-healing repair."""
    body = get_json_body(handler)
    source_name = body.get("source", "Seek")
    err = body.get("error", "")
    res = get_source_code_context(source_name, err)
    handler.send_json(200, res)


@app_router.post("/api/sources/apply-patch")
def handle_sources_apply_patch(handler):
    """Apply and verify live patch to scraper source code."""
    body = get_json_body(handler)
    source_name = body.get("source", "Seek")
    patch_code = body.get("patch", "")
    if not patch_code:
        handler.send_json(400, {"success": False, "error": "Missing patch code"})
        return
    res = apply_and_verify_patch(source_name, patch_code)
    handler.send_json(200, res)


# =====================================================================
# 4. Telemetry, Settings, and Cookies
# =====================================================================


@app_router.get("/api/telemetry/status")
def handle_telemetry_status(handler):
    """Retrieve provider telemetry status, cookies, and gateway connectivity."""
    app = handler.app
    from ..config import settings

    seek_cookies = app.repository.get_provider_cookies("seek")
    indeed_cookies = app.repository.get_provider_cookies("indeed")
    providers = {
        "seek": {
            "name": "SEEK",
            "status": "active"
            if seek_cookies.get("updated_at") or settings.seek_enabled
            else "active",
            "badge": "🟢 Active",
            "has_custom_session": bool(
                seek_cookies.get("headers") or seek_cookies.get("cookies")
            ),
        },
        "indeed": {
            "name": "Indeed",
            "status": "active",
            "badge": "🟢 Active",
            "has_custom_session": bool(
                indeed_cookies.get("headers") or indeed_cookies.get("cookies")
            ),
        },
        "adzuna": {
            "name": "Adzuna",
            "status": "active"
            if bool(settings.adzuna_app_id and settings.adzuna_api_key)
            else "configured",
            "badge": "🟢 Active" if bool(settings.adzuna_app_id) else "🟡 Standby",
            "has_credentials": bool(settings.adzuna_app_id and settings.adzuna_api_key),
        },
        "remoteok": {
            "name": "RemoteOK",
            "status": "active",
            "badge": "🟢 Active",
            "has_credentials": True,
        },
    }
    handler.send_json(
        200,
        {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "providers": providers,
            "workers": {
                "active_scrapes": 0,
                "generation_queue_length": 0,
                "scheduler_active": True,
            },
        },
    )


@app_router.get("/api/settings/cookies")
def handle_get_settings_cookies(handler):
    """Retrieve stored provider session cookies."""
    query_params = get_query_params(handler)
    provider = query_params.get("provider", [""])[0]
    if not provider:
        handler.send_json(400, {"error": "Missing provider parameter"})
        return
    data = handler.app.repository.get_provider_cookies(provider)
    handler.send_json(200, {"success": True, **data})


@app_router.post("/api/settings/cookies")
def handle_post_settings_cookies(handler):
    """Store or update provider session cookies and headers."""
    body = get_json_body(handler)
    provider = body.get("provider", "").lower()
    if not provider:
        handler.send_json(400, {"error": "Missing provider"})
        return
    handler.app.repository.set_provider_cookies(
        provider=provider,
        headers=body.get("headers"),
        cookies=body.get("cookies"),
    )
    handler.send_json(
        200,
        {
            "success": True,
            "provider": provider,
            "message": f"Successfully stored session cookies for {provider}",
        },
    )


# =====================================================================
# 5. Metrics, Daily Digest, and Telemetry
# =====================================================================


@app_router.get("/metrics")
def handle_metrics(handler):
    """Prometheus metrics export endpoint."""
    try:
        from ..metrics import get_metrics

        metrics = get_metrics()
        handler.send_response(200)
        handler.send_header("Content-Type", "text/plain; version=0.0.4")
        handler.send_header("Content-Length", str(len(metrics.encode("utf-8"))))
        if hasattr(handler, "_send_cors_headers"):
            handler._send_cors_headers()
        handler.end_headers()
        handler.wfile.write(metrics.encode("utf-8"))
    except ImportError:
        handler.send_json(200, {"metrics": "not_available"})


@app_router.get("/api/metrics/summary")
@app_router.get("/api/stats")
def handle_metrics_summary(handler):
    """Job repository metrics summary and tracker state."""
    app = handler.app
    metrics = app.repository.metrics()
    metrics["tracker_state"] = app.tracker_state
    handler.send_json(200, metrics)


@app_router.get("/api/metrics/hourly")
def handle_metrics_hourly(handler):
    """Hourly aggregation of scraped jobs."""
    query = get_query_params(handler)
    hours = int(query.get("hours", [24])[0])
    stats = handler.app.repository.hourly_metrics(hours=hours)
    handler.send_json(200, {"success": True, **stats})


@app_router.get("/api/metrics/system")
def handle_metrics_system(handler):
    """System memory, CPU, and process telemetry."""
    handler.send_json(200, get_system_telemetry(handler.app.repository))


@app_router.get("/api/digest/preview")
def handle_digest_preview(handler):
    """Render preview of morning opportunities digest."""
    app = handler.app
    query_params = get_query_params(handler)
    try:
        min_score = int(query_params.get("min_score", ["85"])[0])
    except (ValueError, TypeError):
        min_score = 85
    try:
        limit = int(query_params.get("limit", ["5"])[0])
    except (ValueError, TypeError):
        limit = 5

    jobs = app.repository.list_jobs(match_score_min=min_score)
    digest_data = generate_morning_digest(jobs, min_score=min_score, limit=limit)
    slack_blocks = format_slack_digest_blocks(digest_data)
    handler.send_json(
        200,
        {
            "success": True,
            "digest": digest_data,
            "slack_blocks": slack_blocks,
        },
    )


@app_router.post("/api/digest/dispatch")
def handle_digest_dispatch(handler):
    """Dispatch morning opportunities digest to configured webhook."""
    app = handler.app
    body = get_json_body(handler)
    min_score = int(body.get("min_score", 85))
    limit = int(body.get("limit", 5))
    webhook_url = body.get("webhook_url") or os.environ.get("SLACK_WEBHOOK_URL")

    jobs = app.repository.list_jobs(match_score_min=min_score)
    digest_data = generate_morning_digest(jobs, min_score=min_score, limit=limit)
    slack_blocks = format_slack_digest_blocks(digest_data)

    if not webhook_url:
        handler.send_json(
            200,
            {
                "status": "dry_run",
                "message": "No webhook URL provided or configured in environment. Digest rendered successfully.",
                "digest": digest_data,
                "slack_blocks": slack_blocks,
            },
        )
        return

    req = urllib.request.Request(
        webhook_url,
        data=json.dumps({"blocks": slack_blocks}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        status_code = response.getcode()

    handler.send_json(
        200,
        {
            "status": "dispatched",
            "http_code": status_code,
            "total_opportunities": len(digest_data.get("top_opportunities", [])),
        },
    )


# =====================================================================
# 6. Database Backup & OpenAPI Specification
# =====================================================================


@app_router.get("/api/backup/status")
def handle_backup_status(handler):
    """Retrieve Google Cloud Storage database backup status."""
    app = handler.app
    bucket = os.getenv("JOB_DASHBOARD_GCS_BUCKET") or os.getenv("GCS_BUCKET_NAME")
    handler.send_json(200, get_backup_status(bucket, Path(app.data_dir)))


@app_router.post("/api/backup/snapshot")
def handle_backup_snapshot(handler):
    """Trigger manual database snapshot to Cloud Storage."""
    app = handler.app
    body = get_json_body(handler)
    snapshot_tag = body.get("snapshot_tag")
    bucket = os.getenv("JOB_DASHBOARD_GCS_BUCKET") or os.getenv("GCS_BUCKET_NAME")
    result = create_backup_snapshot(
        bucket, Path(app.data_dir), snapshot_tag=snapshot_tag
    )
    handler.send_json(200, result)


@app_router.get("/api/openapi.json")
def handle_openapi_spec(handler):
    """Generate OpenAPI 3.0 specification for all backend REST endpoints."""
    handler.send_json(200, generate_openapi_spec())
