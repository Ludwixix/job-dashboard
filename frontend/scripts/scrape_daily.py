"""
scrape_daily.py — Portable daily job scrape for the job-dashboard-react app.

Uses the installed `jobspy` package directly (no third-party shim), with:
  - portable paths (resolved from this file, works on any machine)
  - rate limiting with jitter and retries with backoff
  - 14-day freshness filter and URL dedup that preserves Indeed's ?jk= id
  - resume/merge into the dashboard's jobs_combined.json (flat list schema)
  - optional LinkedIn scraping (--sites indeed,linkedin)

Usage:
    python scripts/scrape_daily.py                       # Indeed, default terms
    python scripts/scrape_daily.py --sites indeed,linkedin
    python scripts/scrape_daily.py --terms "azure engineer" --terms "help desk"
    python scripts/scrape_daily.py --dry-run             # scrape, don't write
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "public" / "jobs_combined.json"

TZ = timezone(timedelta(hours=10))  # Melbourne
NOW = datetime.now(TZ)
CUTOFF = NOW - timedelta(days=14)
TODAY = NOW.strftime("%Y-%m-%d")

DEFAULT_TERMS = [
    "systems administrator", "infrastructure engineer", "cloud engineer",
    "devops engineer", "service desk analyst", "desktop support",
    "IT support", "microsoft 365", "entra ID", "endpoint engineer",
    "intune", "azure engineer",
]
DEFAULT_LOCATIONS = ["Melbourne VIC", "Remote"]

RETRY_DELAYS = (5, 15, 30)  # seconds between retries


def ok_date(d) -> bool:
    """Keep listings posted within the 14-day window (or with no date)."""
    if not d:
        return True
    try:
        return datetime.fromisoformat(str(d)[:10]).replace(tzinfo=TZ) >= CUTOFF
    except ValueError:
        return True  # unparseable dates are kept; dedupe handles duplicates


def clean_url(url: str) -> str:
    """Strip fragments and tracking params, preserving identity params like jk."""
    s = str(url or "").strip()
    if "#" in s:
        s = s.split("#")[0]
    if "?" in s:
        base, _, qs = s.partition("?")
        keep = [
            kv for kv in qs.split("&")
            if kv and not kv.split("=")[0].lower().startswith("utm_")
            and kv.split("=")[0].lower() not in {"fbclid", "gclid", "xptdk", "cmpid", "from"}
        ]
        s = base + ("?" + "&".join(keep) if keep else "")
    return s.rstrip("/")


def record_from_row(row, query_term: str, location: str, source_label: str) -> dict:
    url = clean_url(row.get("job_url", ""))
    return {
        "company": str(row.get("company", "Unknown") or "Unknown"),
        "title": str(row.get("title", "Unknown") or "Unknown"),
        "location": str(row.get("location", "") or location),
        "posted": str(row.get("date_posted", "") or "")[:10],
        "source": source_label,
        "url": url,
        "remote": "remote" in str(row.get("location", "")).lower() or bool(row.get("is_remote")),
        "description": str(row.get("description", "") or "")[:12000],
        "tags": [t for t in query_term.split() if len(t) > 2][:5],
        "status": "Fresh individual listing",
        "application_route": url,
        "application_route_type": f"{source_label} listing",
        "listing_verification": f"Captured from {source_label} on {TODAY}. Confirm availability before applying.",
    }


def load_existing() -> tuple[dict, set[str]]:
    """Load the dashboard data file; tolerate list or {jobs: [...]} shapes."""
    data: dict = {"jobs": [], "updated": "", "count": 0}
    if DATA_PATH.exists():
        raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        if isinstance(raw, dict):
            data = raw
            data.setdefault("jobs", [])
        elif isinstance(raw, list):
            data["jobs"] = raw
    seen = {
        clean_url(j.get("application_route") or j.get("url", ""))
        for j in data["jobs"]
        if j.get("url") or j.get("application_route")
    }
    return data, seen


def scrape(site: str, term: str, location: str, results_wanted: int, hours_old: int):
    from jobspy import scrape_jobs
    return scrape_jobs(
        site_name=[site],
        search_term=term,
        location=location,
        country_indeed="australia",
        results_wanted=results_wanted,
        hours_old=hours_old,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Daily job scrape (jobspy, portable)")
    parser.add_argument("--sites", default="indeed", help="comma list: indeed,linkedin")
    parser.add_argument("--terms", action="append", default=[], help="override search terms (repeatable)")
    parser.add_argument("--results-wanted", type=int, default=20)
    parser.add_argument("--hours-old", type=int, default=336)
    parser.add_argument("--delay", type=float, default=8.0, help="seconds between searches (+ jitter)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sites = [s.strip().lower() for s in args.sites.split(",") if s.strip()]
    terms = args.terms or DEFAULT_TERMS

    try:
        import jobspy  # noqa: F401
    except ImportError:
        print("ERROR: jobspy is required. Install with: pip install python-jobspy", file=sys.stderr)
        return 1

    data, seen = load_existing()
    print(f"Existing records: {len(data['jobs'])} | unique URLs: {len(seen)}")

    added = 0
    per_source: dict[str, int] = {}
    for site in sites:
        label = "Indeed" if site == "indeed" else site.capitalize()
        for term in terms:
            for location in (DEFAULT_LOCATIONS if site == "indeed" else DEFAULT_LOCATIONS[:1]):
                df = None
                for attempt, backoff in enumerate((0, *RETRY_DELAYS), start=1):
                    if backoff:
                        print(f"  retry {attempt - 1}/{len(RETRY_DELAYS)} for '{term}' in {backoff}s...")
                        time.sleep(backoff)
                    try:
                        df = scrape(site, term, location, args.results_wanted, args.hours_old)
                        break
                    except Exception as e:  # noqa: BLE001 — jobspy raises varied provider errors; we retry then continue
                        print(f"  ERR {site} '{term}'/{location}: {e}")
                if df is None or df.empty:
                    continue
                n = 0
                for _, row in df.iterrows():
                    rec = record_from_row(row, term, location, label)
                    if not rec["url"] or rec["url"] in seen or not ok_date(rec["posted"]):
                        continue
                    data["jobs"].append(rec)
                    seen.add(rec["url"])
                    n += 1
                    added += 1
                per_source[label] = per_source.get(label, 0) + n
                print(f"  {site} '{term}'/{location}: +{n}")
                time.sleep(args.delay + random.uniform(0, args.delay * 0.25))

    data["jobs"].sort(key=lambda j: (str(j.get("posted", "")), str(j.get("company", ""))), reverse=True)
    data["updated"] = NOW.isoformat()
    data["count"] = len(data["jobs"])
    data["policy"] = f"Fresh scrape ({', '.join(sites)}) with rate limiting and retries. 14-day filter. Updated {TODAY}."

    print(f"\nScrape done: +{added} new jobs ({per_source}) | total {data['count']}")
    if args.dry_run:
        print("Dry run — not writing.")
        return 0

    backup = DATA_PATH.with_suffix(f".{NOW.strftime('%Y%m%d-%H%M%S')}.bak.json")
    if DATA_PATH.exists():
        backup.write_text(DATA_PATH.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"Backup: {backup.name}")
    DATA_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {DATA_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
