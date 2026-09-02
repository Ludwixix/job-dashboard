"""Maintain a validated local SEEK cache for fallback ingestion.

Usage examples:
    PYTHONPATH=src python -m job_dashboard.seek_cache_ingest \
      --input /path/to/export.json --output data/seek_cache.json

The input may be a SEEK scraper payload ({"jobs": [...]}) or a flat list.
Only records with a real listing URL, title, company, description, and a
verifiable date within ``--days`` are written. The output is written
atomically and is the format consumed by ``SeekApiSource`` when its live API
is unavailable.
"""
from __future__ import annotations

import argparse
import json
import os
import tempfile
from collections.abc import Mapping
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .sources import canonical_posted_date, clean_description, is_recent


def _records(payload: Any) -> list[Mapping[str, Any]]:
    values = payload.get("jobs", []) if isinstance(payload, Mapping) else payload
    return [value for value in values if isinstance(value, Mapping)] if isinstance(values, list) else []


def _normalize(record: Mapping[str, Any], days: int = 14) -> dict[str, Any] | None:
    title = str(record.get("title") or "").strip()
    company = str(record.get("company") or "").strip()
    url = str(record.get("url") or record.get("application_route") or "").strip()
    description = clean_description(record.get("description") or record.get("teaser") or "")
    posted = canonical_posted_date(record.get("posted") or record.get("listingDate") or "")
    if not (title and company and description and url.startswith(("https://", "http://"))):
        return None
    normalized = {
        **dict(record),
        "title": title,
        "company": company,
        "url": url,
        "application_route": url,
        "description": description,
        "posted": posted,
        "source": "Seek",
    }
    return normalized if is_recent(normalized, days=days) else None


def ingest(input_path: Path, output_path: Path, days: int = 14) -> int:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    valid: dict[str, dict[str, Any]] = {}
    for record in _records(payload):
        candidate = _normalize(record, days=days)
        if candidate is None:
            continue
        key = str(candidate.get("id") or candidate.get("jobId") or candidate["url"])
        valid[key] = candidate

    output_path.parent.mkdir(parents=True, exist_ok=True)
    document = {
        "source": "seek_cache_ingest",
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "count": len(valid),
        "jobs": list(valid.values()),
    }
    fd, temporary_name = tempfile.mkstemp(prefix="seek_cache.", suffix=".tmp", dir=output_path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(document, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, output_path)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)
    return len(valid)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate and atomically update the maintained SEEK cache")
    parser.add_argument("--input", type=Path, required=True, help="SEEK export JSON (payload or list)")
    parser.add_argument("--output", type=Path, default=Path("data/seek_cache.json"))
    parser.add_argument("--days", type=int, default=14)
    args = parser.parse_args()
    count = ingest(args.input, args.output, days=args.days)
    print(f"Wrote {count} verified SEEK listings to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
