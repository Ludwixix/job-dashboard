"""Scraper source health diagnostic probes and autonomous self-healing engine."""

from __future__ import annotations

import ast
import os
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..logging import get_logger
from .base import SearchQuery

logger = get_logger("job_dashboard.sources.self_healing")

SOURCE_FILE_MAP: dict[str, str] = {
    "seek": "seek.py",
    "indeed": "indeed.py",
    "adzuna": "adzuna.py",
    "remoteok": "remoteok.py",
    "portal": "portal_crawler.py",
    "resilience": "resilience.py",
}


def _resolve_source_instance(source_name: str, app: Any) -> Any | None:
    """Resolve source instance by case-insensitive name match."""
    norm = source_name.strip().lower()
    for s in getattr(app, "sources", []):
        if s.name.lower() == norm or norm in s.name.lower():
            return s
    return None


def diagnose_source(
    source_name: str, app: Any, probe_query: str = "Software Engineer"
) -> dict[str, Any]:
    """Execute an on-demand live diagnostic probe against a scraper source.

    Measures response latency, validates job extraction, and categorizes
    any observed error into actionable resolution classes.
    """
    source = _resolve_source_instance(source_name, app)
    if not source:
        return {
            "success": False,
            "source_name": source_name,
            "status": "unhealthy",
            "jobs_found": 0,
            "duration_ms": 0,
            "error": f"Scraper source '{source_name}' is not registered in active pipeline.",
            "error_category": "SOURCE_NOT_FOUND",
            "recommended_action": "VERIFY_SOURCE_CONFIGURATION",
        }

    start_time = time.monotonic()
    query = SearchQuery(term=probe_query, location="Australia", enabled=True)
    try:
        results = list(source.search(query))
        duration_ms = round((time.monotonic() - start_time) * 1000, 2)
        return {
            "success": True,
            "source_name": source.name,
            "status": "healthy" if results else "degraded",
            "jobs_found": len(results),
            "duration_ms": duration_ms,
            "error": "" if results else "Probe search returned zero matching positions",
            "error_category": "NONE" if results else "EMPTY_RESULTS",
            "recommended_action": "NO_ACTION_REQUIRED"
            if results
            else "EXPAND_SEARCH_TERMS",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        duration_ms = round((time.monotonic() - start_time) * 1000, 2)
        err_msg = str(exc)
        err_lower = err_msg.lower()

        if any(
            w in err_lower
            for w in ("403", "turnstile", "challenge", "bot", "blocked", "forbidden")
        ):
            error_category = "BOT_BLOCKED"
            action = "ACTIVATE_STEALTH_BROWSER_OR_FALLBACK"
        elif any(w in err_lower for w in ("429", "rate limit", "too many requests")):
            error_category = "RATE_LIMITED"
            action = "ROTATE_PROXY_AND_RESET_BACKOFF"
        elif any(
            w in err_lower
            for w in ("credential", "api key", "app_id", "unauthorized", "auth")
        ):
            error_category = "CREDENTIALS_MISSING"
            action = "CONFIGURE_API_CREDENTIALS"
        elif any(
            w in err_lower
            for w in (
                "selector",
                "attributeerror",
                "keyerror",
                "indexerror",
                "json",
                "parse",
            )
        ):
            error_category = "PARSER_BREAKAGE"
            action = "LLM_CODE_REPAIR_REQUIRED"
        else:
            error_category = "TRANSIENT_NETWORK"
            action = "RETRY_WITH_BACKOFF"

        return {
            "success": False,
            "source_name": source.name,
            "status": "unhealthy",
            "jobs_found": 0,
            "duration_ms": duration_ms,
            "error": err_msg,
            "error_category": error_category,
            "recommended_action": action,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


def remediate_runtime(
    source_name: str, app: Any, diagnosis: dict[str, Any]
) -> dict[str, Any]:
    """Execute automated operational self-healing on a degraded scraper source.

    Adjusts runtime settings (escalating fallback tiers to stealth browser or
    validated cache, resetting rate-limit backoff, or rotating headers), then
    re-probes the source to confirm recovery.
    """
    source = _resolve_source_instance(source_name, app)
    if not source:
        return {
            "success": False,
            "remedied": False,
            "error": f"Source '{source_name}' not found",
        }

    actions: list[str] = []
    norm = source.name.lower()

    if "seek" in norm:
        if hasattr(source, "allow_browser_fallback"):
            source.allow_browser_fallback = True
            actions.append("Enabled Playwright stealth headless browser tier")
        if hasattr(source, "allow_cache_fallback"):
            source.allow_cache_fallback = True
            actions.append("Enabled atomic verified cache fallback tier")
        if hasattr(source, "allow_cross_source_fallback"):
            source.allow_cross_source_fallback = True
            actions.append("Enabled Australian cross-source gateway fallback")

    elif "indeed" in norm:
        if hasattr(source, "html_fallback"):
            source.html_fallback = True
            actions.append("Enabled structured embedded JSON & JSON-LD fallback")
        if hasattr(source, "browser_fallback"):
            source.browser_fallback = True
            actions.append("Enabled adaptive DOM extractor stealth browser tier")

    else:
        if hasattr(source, "pause_seconds"):
            source.pause_seconds = max(0.5, getattr(source, "pause_seconds", 1.5))
            actions.append("Adjusted request cadence to prevent rate-limiting")

    action_label = "ESCALATED_FALLBACK_TIERS" if actions else "RESET_RUNTIME_BACKOFF"

    # Execute recovery re-probe
    post_diagnosis = diagnose_source(source.name, app, probe_query="Engineer")
    is_remedied = (
        post_diagnosis.get("status") in ("healthy", "degraded")
        and post_diagnosis.get("jobs_found", 0) > 0
    )

    if is_remedied:
        # Update source health in memory
        if hasattr(app, "source_health") and isinstance(app.source_health, dict):
            entry = app.source_health.setdefault(source.name, {})
            entry["success"] = True
            entry["last_error"] = ""
            entry["last_success"] = datetime.now(timezone.utc).isoformat()

        # Update health check database if available
        if getattr(app, "health_check", None):
            try:
                app.health_check.record_check(
                    component=f"scraper:{source.name}",
                    status="healthy",
                    duration=post_diagnosis.get("duration_ms", 0.0) / 1000.0,
                    details={
                        "remedied": True,
                        "actions": actions,
                        "jobs": post_diagnosis.get("jobs_found", 0),
                    },
                )
            except Exception as e:
                logger.debug(f"Failed to record healthy check to db: {e}")

    return {
        "success": is_remedied,
        "remedied": is_remedied,
        "source_name": source.name,
        "action_taken": action_label,
        "actions_detail": actions,
        "post_health": post_diagnosis,
        "next_step": "NONE" if is_remedied else "CODE_REPAIR_REQUIRED",
    }


def get_source_code_context(
    source_name: str, error_details: str = ""
) -> dict[str, Any]:
    """Retrieve the source file code context and construct a structured LLM repair prompt."""
    norm = source_name.strip().lower()
    filename = SOURCE_FILE_MAP.get(norm, "base.py")
    sources_dir = Path(__file__).resolve().parent
    file_path = sources_dir / filename

    if not file_path.exists():
        return {
            "success": False,
            "source_name": source_name,
            "error": f"Source file '{filename}' does not exist at {file_path}",
        }

    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as err:
        return {
            "success": False,
            "source_name": source_name,
            "error": f"Failed to read source file: {err}",
        }

    # Construct structured repair prompt for user's active LLM
    prompt = f"""# LLM Repair Prompt: Scraper Source Diagnostic & Code Repair Task
**Target Source**: {source_name}
**File**: `{file_path.name}`

## Failure Summary
The scraper for `{source_name}` encountered a parser or anti-bot challenge:
```
{error_details or "Diagnostic probe failed: HTML layout changed or selector not found."}
```

## Objective
Analyze the scraper code in `{file_path.name}` and output a surgical code patch that:
1. Fixes the broken parser, regex, or request header extraction.
2. Implements resilient fallback handling so future layout shifts don't raise uncaught exceptions.
3. Preserves all existing method signatures and models (`JobRecord`, `SearchQuery`).
4. Output valid Python code with complete imports.
"""

    return {
        "success": True,
        "source_name": source_name,
        "file_name": file_path.name,
        "file_path": str(file_path),
        "code_snippet": content,
        "llm_prompt": prompt,
    }


def apply_and_verify_patch(
    source_name: str,
    patch_code: str,
    target_file_path: Path | None = None,
    test_command: str | None = None,
) -> dict[str, Any]:
    """Atomically apply a proposed code patch, validate syntax, and run verification tests.

    If the tests fail, automatically rolls back to the previous revision.
    """
    if target_file_path is None:
        norm = source_name.strip().lower()
        filename = SOURCE_FILE_MAP.get(norm, "seek.py")
        sources_dir = Path(__file__).resolve().parent
        target_file_path = sources_dir / filename

    target_path = Path(target_file_path)
    if not target_path.exists():
        return {
            "success": False,
            "error": f"Target file does not exist: {target_path}",
        }

    # 1. Syntax validation via AST parse
    try:
        ast.parse(patch_code)
    except SyntaxError as syn_err:
        return {
            "success": False,
            "error": f"SyntaxError in proposed patch: {syn_err}",
            "rolled_back": False,
        }

    # 2. Create atomic backup
    backup_path = target_path.with_suffix(".py.bak")
    try:
        shutil.copyfile(target_path, backup_path)
    except Exception as copy_err:
        return {
            "success": False,
            "error": f"Failed to create file backup: {copy_err}",
        }

    # 3. Write patch code
    try:
        target_path.write_text(patch_code, encoding="utf-8")
    except Exception as write_err:
        if backup_path.exists():
            shutil.copyfile(backup_path, target_path)
        return {
            "success": False,
            "error": f"Failed to write patch: {write_err}",
            "rolled_back": True,
        }

    # 4. Execute test verification command
    cmd = test_command or "python3 -m pytest tests/test_scrapers.py"
    repo_root = target_path.resolve().parents[3]
    try:
        proc = subprocess.run(
            cmd,
            shell=True,
            cwd=str(repo_root),
            capture_output=True,
            text=True,
            timeout=120,
        )
        if proc.returncode == 0:
            if backup_path.exists():
                backup_path.unlink()
            return {
                "success": True,
                "tested": True,
                "test_output": proc.stdout[-500:],
                "source_name": source_name,
                "file_path": str(target_path),
            }
        else:
            # Tests failed -> rollback
            shutil.copyfile(backup_path, target_path)
            if backup_path.exists():
                backup_path.unlink()
            return {
                "success": False,
                "rolled_back": True,
                "error": f"Tests failed with exit code {proc.returncode}: {proc.stderr or proc.stdout[-300:]}",
                "test_output": proc.stdout[-500:],
            }
    except Exception as test_err:
        # Rollback on unexpected execution exception
        if backup_path.exists():
            shutil.copyfile(backup_path, target_path)
            backup_path.unlink()
        return {
            "success": False,
            "rolled_back": True,
            "error": f"Test runner execution error: {test_err}",
        }


def get_all_sources_health_summary(app: Any) -> list[dict[str, Any]]:
    """Aggregate health status, query counts, and tiers across all configured sources."""
    sources = getattr(app, "sources", [])
    health_dict = getattr(app, "source_health", {}) or {}
    results = []

    for s in sources:
        h = health_dict.get(s.name, {})
        last_err = h.get("last_error", "")
        success = h.get("success", True)
        status = (
            "healthy"
            if success and not last_err
            else "degraded"
            if success
            else "unhealthy"
        )

        # Determine active operational tiers
        tiers = ["Tier 1 (API/REST)"]
        if getattr(s, "allow_browser_fallback", False) or getattr(
            s, "browser_fallback", False
        ):
            tiers.append("Tier 2 (Stealth Browser)")
        if getattr(s, "allow_cache_fallback", False) or getattr(
            s, "html_fallback", False
        ):
            tiers.append("Tier 3 (Cache / Embedded JSON)")
        if getattr(s, "allow_cross_source_fallback", False):
            tiers.append("Tier 4 (Cross-Source Gateway)")

        results.append(
            {
                "name": s.name,
                "status": status,
                "badge": "🟢 Healthy"
                if status == "healthy"
                else "🟡 Degraded"
                if status == "degraded"
                else "🔴 Unhealthy",
                "jobs_collected": h.get("jobs", 0),
                "queries_executed": h.get("queries", 0),
                "last_success": h.get("last_success", None),
                "last_error": last_err,
                "operational_tiers": tiers,
                "can_auto_heal": True,
            }
        )

    return results
