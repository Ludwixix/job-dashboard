from __future__ import annotations

import re
import time
import urllib.parse
import urllib.request
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
from typing import Any, Protocol

from ..health import HealthCheck
from ..logging import get_logger

logger = get_logger("job_dashboard.sources.base")


@dataclass(frozen=True)
class SearchQuery:
    term: str
    location: str = "Melbourne, VIC"
    stream: str = "core-it"
    group: str = ""
    weight: float = 1.0
    exclude_terms: tuple[str, ...] = ()
    enabled: bool = True


class JobSource(Protocol):
    name: str

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        ...


class SeekUnavailableError(RuntimeError):
    """SEEK did not permit this request or returned an unusable response."""


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def clean_description(value: Any, limit: int = 12000) -> str:
    """Turn provider HTML or email formats into readable text while preserving paragraph breaks."""
    raw = str(value or "")
    if not raw.strip():
        return ""

    # Remove script and style tags completely
    html = re.sub(r"<\s*style\b[^>]*>[\s\S]*?<\s*/\s*style\s*>", "", raw, flags=re.IGNORECASE)
    html = re.sub(r"<\s*script\b[^>]*>[\s\S]*?<\s*/\s*script\s*>", "", html, flags=re.IGNORECASE)
    html = re.sub(r"<\s*head\b[^>]*>[\s\S]*?<\s*/\s*head\s*>", "", html, flags=re.IGNORECASE)
    html = re.sub(r"<!--[\s\S]*?-->", "", html)

    # Strip email MIME/header artifacts
    html = re.sub(r"(?i)^.*?Content-Type:\s*text/html.*?\n\n", "", html, flags=re.DOTALL)
    html = re.sub(r"(?i)^.*?boundary=.*?\n\n", "", html, flags=re.DOTALL)
    html = re.sub(r"(?i)(?:unsubscribe|view this job on seek|manage alerts|email preference|terms of service)[\s\S]*?$", "", html)

    # Format paragraph, heading, and list tags
    html = re.sub(r"<\s*(?:br\s*/?|p|div|section|article|h[1-6]|ul|ol|tr)\b[^>]*>", "\n\n", html, flags=re.IGNORECASE)
    html = re.sub(r"<\s*li\b[^>]*>", "\n• ", html, flags=re.IGNORECASE)
    html = re.sub(r"<\s*/\s*(?:p|div|section|article|h[1-6]|ul|ol|li|tr|table)\s*>", "\n", html, flags=re.IGNORECASE)

    parser = _TextExtractor()
    parser.feed(html)
    text = unescape("".join(parser.parts)).replace("\u00a0", " ")
    
    # Clean decoded text lines
    lines = []
    for raw_line in text.splitlines():
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        # Skip pure separator or garbage artifact lines
        if re.match(r"^[-=_*~]{4,}$", line):
            continue
        if line:
            lines.append(line)
        elif lines and lines[-1] != "":
            lines.append("")
            
    text = "\n".join(lines).strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text[:limit].rstrip() + ("..." if len(text) > limit else "")


def is_recent(job: Mapping[str, Any], days: int = 14, now: datetime | None = None) -> bool:
    """A job with no verifiable posted date cannot be vouched for as recent."""
    value = normalize_posted_date(job.get("posted", ""), now)
    if not value:
        return False
    try:
        posted = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            posted = datetime.strptime(value[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return False
    if posted.tzinfo is None:
        posted = posted.replace(tzinfo=timezone.utc)
    current = now or datetime.now(timezone.utc)
    return posted >= current - timedelta(days=days)


def normalize_posted_date(value: Any, now: datetime | None = None) -> str:
    """Normalize ISO and relative provider dates to an ISO calendar date."""
    text = str(value or "").strip().lower()
    current = now or datetime.now(timezone.utc)
    relative = re.fullmatch(r"(\d+)\s*d(?:ays?)?\s*ago", text)
    if relative:
        return (current - timedelta(days=int(relative.group(1)))).date().isoformat()
    try:
        posted = datetime.fromisoformat(text.replace("z", "+00:00"))
    except ValueError:
        try:
            posted = datetime.strptime(text[:10], "%Y-%m-%d")
        except ValueError:
            return ""
    if posted.tzinfo is None:
        posted = posted.replace(tzinfo=timezone.utc)
    return posted.astimezone(timezone.utc).date().isoformat()


def canonical_posted_date(value: Any, captured_at: datetime | None = None) -> str:
    """Convert provider-relative dates to absolute dates at capture time."""
    text = str(value or "").strip().lower()
    captured = captured_at or datetime.now(timezone.utc)
    relative = re.fullmatch(r"(\d+)\s*d(?:ays?)?\s*ago(?:\s*[•|].*)?", text)
    if relative:
        return (captured - timedelta(days=int(relative.group(1)))).date().isoformat()
    return normalize_posted_date(value, captured) or ""


def posted_age(value: Any, now: datetime | None = None) -> str:
    """Return a human-readable age while retaining the original date in storage."""
    text = normalize_posted_date(value, now)
    if not text:
        return "Posting date unavailable"
    try:
        posted = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        try:
            posted = datetime.strptime(text[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return "Posting date unavailable"
    if posted.tzinfo is None:
        posted = posted.replace(tzinfo=timezone.utc)
    current = now or datetime.now(timezone.utc)
    age = max(0, (current.date() - posted.astimezone(timezone.utc).date()).days)
    if age == 0:
        return "Posted today"
    if age == 1:
        return "Posted yesterday"
    return f"Posted {age} days ago"


def _page_description(url: str, timeout: float = 4.0) -> str:
    if not url:
        return ""
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            html = response.read(250000).decode("utf-8", errors="replace")
        patterns = [
            r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)',
            r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)',
            r'"description"\s*:\s*"((?:\\.|[^"])*)"',
        ]
        for pattern in patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                value = unescape(match.group(1)).replace("\\n", " ").replace("\\\"", '"')
                value = re.sub(r"\s+", " ", value).strip()
                if value:
                    return value[:1000]
    except Exception:
        return ""
    return ""


def ensure_descriptions(jobs: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Fill provider omissions without allowing enrichment failure to drop a job."""
    enriched = []
    for raw in jobs:
        job = dict(raw)
        description = clean_description(job.get("description", ""))
        if not description:
            description = _page_description(str(job.get("url") or job.get("application_route") or ""))
        if not description:
            description = f"{job.get('title', 'Role')} at {job.get('company', 'the listed employer')} in {job.get('location', 'the advertised location')}."
        job["description"] = description
        enriched.append(job)
    return enriched


class ScrapePipeline:
    def __init__(
        self,
        sources: Iterable[JobSource],
        days: int = 14,
        pause_seconds: float = 0.0,
        health_check: HealthCheck | None = None,
    ):
        self.sources = tuple(sources)
        self.days = days
        self.pause_seconds = pause_seconds
        self.health_check = health_check
        self.source_health: dict[str, dict[str, Any]] = {}

    def _load_mock_fixture(self) -> list[dict[str, Any]]:
        import json
        from pathlib import Path
        candidate_paths = [
            Path(__file__).resolve().parent.parent.parent.parent / "data" / "mock_jobs_fixture.json",
            Path(__file__).resolve().parent.parent / "data" / "mock_jobs_fixture.json",
            Path("/app/data/mock_jobs_fixture.json"),
            Path("data/mock_jobs_fixture.json"),
        ]
        for path in candidate_paths:
            if path.exists():
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                    jobs = data.get("jobs", data) if isinstance(data, dict) else data
                    today_iso = datetime.now(timezone.utc).date().isoformat()
                    for j in jobs:
                        if not j.get("posted") or j.get("posted") == "today":
                            j["posted"] = today_iso
                    return jobs
                except Exception:
                    pass
        today = datetime.now(timezone.utc).date().isoformat()
        return [
            {
                "id": "mock-01",
                "title": "Senior Software Engineer",
                "company": "Canva",
                "location": "Sydney NSW",
                "description": "Full stack web application development in React and Python.",
                "source": "SEEK",
                "url": "https://www.seek.com.au/job/mock-01",
                "posted": today,
                "tags": ["react", "python"],
            }
        ]

    def run(self, queries: Iterable[SearchQuery], on_progress=None) -> list[dict[str, Any]]:
        import os
        from .dedup import deduplicate_jobs

        active_queries = [query for query in queries if query.enabled]
        is_mock = os.environ.get("MOCK_SCRAPERS", "").strip().lower() in ("true", "1", "yes")
        if is_mock:
            if on_progress:
                on_progress("Mock scrapers active (MOCK_SCRAPERS=true): loading static fixture...", 50)
            mock_jobs = self._load_mock_fixture()
            for source in self.sources:
                self.source_health[source.name] = {
                    "jobs": len(mock_jobs),
                    "queries": len(active_queries) or 1,
                    "success": True,
                    "last_success": datetime.now(timezone.utc).isoformat(),
                    "last_error": "",
                }
            if on_progress:
                on_progress("Mock scrapers complete", 100)
            return ensure_descriptions(deduplicate_jobs(job for job in mock_jobs if is_recent(job, self.days)))

        collected: list[Mapping[str, Any]] = []
        self.errors: list[str] = []
        total_sources = len(self.sources)
        total_attempts = max(1, total_sources * len(active_queries))
        completed_attempts = 0
        for idx, source in enumerate(self.sources):
            started_at = time.monotonic()
            if on_progress:
                on_progress(f'Scraping {source.name}...', int((idx / total_sources) * 100))
            health = self.source_health.setdefault(source.name, {"jobs": 0, "queries": 0, "success": False, "last_error": ""})
            for query in active_queries:
                if on_progress:
                    on_progress(
                        f"{source.name}: searching '{query.term}' ({completed_attempts + 1}/{total_attempts})...",
                        min(89, 10 + int((completed_attempts / total_attempts) * 75)),
                    )
                try:
                    results = source.search(query)
                    health["queries"] += 1
                    health["success"] = True
                    health["last_success"] = datetime.now(timezone.utc).isoformat()
                    for job in results:
                        text = " ".join(str(job.get(field, "")) for field in ("title", "company", "description", "tags")).lower()
                        if not any(term.lower() in text for term in query.exclude_terms):
                            collected.append(job)
                            health["jobs"] += 1
                except Exception as error:
                    health["queries"] += 1
                    health["last_error"] = str(error)
                    self.errors.append(f"{source.name} / {query.term}: {error}")
                completed_attempts += 1
                if self.pause_seconds:
                    time.sleep(self.pause_seconds)
            if self.health_check:
                status = "healthy" if health["success"] and not health["last_error"] else "degraded" if health["success"] else "unhealthy"
                self.health_check.record_check(
                    component=f"scraper:{source.name}",
                    status=status,
                    duration=time.monotonic() - started_at,
                    details=dict(health),
                )
        return ensure_descriptions(deduplicate_jobs(job for job in collected if is_recent(job, self.days)))
