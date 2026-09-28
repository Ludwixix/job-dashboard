"""Legacy Application Importer for JSON Trackers.

Provides an idempotent, verified import path from legacy ownerless
JSON trackers (smart_applications.json) into SQLite user_applications.
"""

from __future__ import annotations

import json
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .repository import JobRepository

logger = logging.getLogger(__name__)

STATUS_MAPPING: dict[str, str] = {
    "new": "Discovered",
    "review": "Discovered",
    "ready": "Discovered",
    "applied": "Applied",
    "applied / in review": "Applied",
    "interview": "Interviewing",
    "interviewing": "Interviewing",
    "offer": "Offer Received",
    "offer received": "Offer Received",
    "rejected": "Rejected",
    "archived": "Rejected",
    "rejected / closed": "Rejected",
    "rejected / dismissed": "Rejected",
}


def normalize_status(raw_status: str | None) -> str:
    """Normalize legacy status string to canonical vocabulary."""
    if not raw_status:
        return "Discovered"
    cleaned = str(raw_status).strip().lower()
    return STATUS_MAPPING.get(
        cleaned, "Applied" if "applied" in cleaned else "Discovered"
    )


def import_legacy_applications(
    source_path: str | Path,
    user_id: str,
    repository: JobRepository,
    backup: bool = True,
) -> dict[str, Any]:
    """Import legacy JSON applications into user-scoped SQLite records.

    Rules:
    - user_id is mandatory and cannot be empty or 'default_user'.
    - If backup is True, creates a timestamped copy of source_path before reading.
    - Idempotent: existing records with newer updated_at are preserved; older records updated.
    - Source JSON file is retained intact.
    - Returns a structured reconciliation report.
    """
    if not user_id or not str(user_id).strip():
        raise ValueError("Explicit user_id is required for legacy application import.")
    if user_id.strip() == "default_user":
        raise ValueError(
            "Cannot import legacy applications to ownerless 'default_user'."
        )

    user_id = str(user_id).strip()
    source_file = Path(source_path).resolve()
    if not source_file.is_file():
        raise FileNotFoundError(f"Source JSON file not found: {source_file}")

    # 1. Verified Backup
    backup_path = None
    if backup:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        backup_path = source_file.with_name(
            f"{source_file.stem}_backup_{ts}{source_file.suffix}"
        )
        shutil.copy2(source_file, backup_path)
        logger.info(f"Created pre-import backup at {backup_path}")

    # 2. Parse Source JSON
    with open(source_file, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    records: list[dict[str, Any]] = []
    if isinstance(raw_data, dict):
        records = list(raw_data.values())
    elif isinstance(raw_data, list):
        records = raw_data
    else:
        raise ValueError(
            "Invalid JSON structure: expected dictionary or list of applications."
        )

    report = {
        "source_file": str(source_file),
        "backup_file": str(backup_path) if backup_path else None,
        "target_user_id": user_id,
        "total_records": len(records),
        "imported": 0,
        "updated": 0,
        "skipped": 0,
        "errors": [],
    }

    # Fetch existing user applications for conflict resolution
    existing_apps = {
        str(a.get("job_id") or a.get("id")): a
        for a in repository.get_user_applications(user_id)
    }

    for idx, item in enumerate(records):
        try:
            if not isinstance(item, dict):
                report["skipped"] += 1
                continue

            job_id = str(
                item.get("job_id") or item.get("id") or item.get("application_id") or ""
            ).strip()

            if not job_id:
                comp = str(item.get("company") or "").strip()
                tit = str(item.get("job_title") or item.get("title") or "").strip()
                if comp and tit:
                    job_id = f"{comp}_{tit}"
                else:
                    report["errors"].append(
                        f"Record index {idx}: Missing job identifier or company/title"
                    )
                    report["skipped"] += 1
                    continue

            status = normalize_status(item.get("status"))
            applied_at = (
                item.get("applied_at")
                or item.get("appliedDate")
                or item.get("created_at")
            )
            updated_at = (
                item.get("updated_at") or datetime.now(timezone.utc).isoformat()
            )

            app_data = {
                "company": item.get("company", ""),
                "title": item.get("job_title") or item.get("title", ""),
                "status": status,
                "notes": item.get("notes", ""),
                "applied_at": applied_at,
                "resume_text": item.get("resume_text", ""),
                "cover_letter_text": item.get("cover_letter_text", ""),
                "resume_url": item.get("generated_resume_path")
                or item.get("resume_url", ""),
                "cover_letter_url": item.get("generated_cover_path")
                or item.get("cover_letter_url", ""),
                "job_data": item,
            }

            existing = existing_apps.get(job_id)
            if existing:
                existing_updated = existing.get("updated_at") or ""
                if str(updated_at) >= str(existing_updated):
                    repository.upsert_user_application(user_id, job_id, app_data)
                    report["updated"] += 1
                else:
                    report["skipped"] += 1
            else:
                repository.upsert_user_application(user_id, job_id, app_data)
                report["imported"] += 1
                existing_apps[job_id] = app_data
        except Exception as e:
            logger.error(f"Error importing record index {idx}: {e}", exc_info=True)
            report["errors"].append(f"Record index {idx} ({job_id}): {str(e)}")

    return report
