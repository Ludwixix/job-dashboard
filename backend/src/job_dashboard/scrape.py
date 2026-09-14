from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from .scrape_config import DEFAULT_QUERIES
from .sources import (
    AdzunaApiSource,
    IndeedJobSpySource,
    JobSource,
    LinkedInBrowserSource,
    RemoteOkApiSource,
    ScrapePipeline,
    SearchQuery,
    SeekApiSource,
    detect_query_stream,
)


from .config import settings


def build_sources(names: list[str]) -> list[JobSource]:
    factories = {
        "indeed": lambda: IndeedJobSpySource(
            browser_fallback=settings.stealth_browser_enabled,
            multi_board=settings.multi_board_enabled,
            proxy=settings.proxy_url,
        ),
        "seek": lambda: SeekApiSource(
            max_pages=settings.seek_max_pages,
            max_results=settings.seek_max_results,
            pause_seconds=settings.seek_pause_seconds,
            endpoint=settings.seek_api_endpoint,
            allow_browser_fallback=settings.seek_browser_fallback and settings.stealth_browser_enabled,
            cache_path=settings.seek_cache_path,
            allow_cache_fallback=settings.seek_cache_fallback,
            allow_cross_source_fallback=settings.multi_board_enabled,
            proxy=settings.proxy_url,
        ),
        "linkedin": lambda: LinkedInBrowserSource(proxy=settings.proxy_url),
        "adzuna": lambda: AdzunaApiSource(
            app_id=settings.adzuna_app_id,
            api_key=settings.adzuna_api_key,
        ),
        "remoteok": RemoteOkApiSource,
    }
    unknown = sorted(set(names) - set(factories))
    if unknown:
        raise ValueError(f"unknown source(s): {', '.join(unknown)}")
    return [factories[name]() for name in names]


def resolve_cli_queries(
    cli_queries: list[str] | None,
    location: str = "Australia",
    profile_path: Path | None = None,
) -> list[SearchQuery]:
    """Resolves search queries dynamically from CLI flags, profile JSON, or discovery defaults."""
    if cli_queries:
        queries = []
        for q in cli_queries:
            term = str(q).strip()
            if term:
                is_remote = any(k in term.lower() for k in ("remote", "wfh", "work from home", "anywhere in australia"))
                loc = "Australia" if is_remote else location
                queries.append(SearchQuery(term=term, location=loc, stream=detect_query_stream(term)))
        if queries:
            return queries

    if profile_path and profile_path.is_file():
        try:
            data = json.loads(profile_path.read_text(encoding="utf-8"))
            target_titles = (
                data.get("targetTitles")
                or data.get("target_titles")
                or data.get("preferences", {}).get("target_roles")
                or data.get("profile", {}).get("preferences", {}).get("target_roles")
                or []
            )
            is_profile_remote = (
                bool(data.get("remoteOnly"))
                or "remote" in str(data.get("workArrangements") or "").lower()
                or "remote" in str(data.get("preferences", {}).get("work_arrangement") or "").lower()
            )
            prof_loc = str(
                data.get("location")
                or data.get("profile", {}).get("personal", {}).get("location", {}).get("city")
                or location
            ).strip() or location
            queries = []
            for title in target_titles:
                t = str(title).strip()
                if t:
                    is_remote = is_profile_remote or any(k in t.lower() for k in ("remote", "wfh", "work from home", "anywhere in australia"))
                    loc = "Australia" if is_remote else prof_loc
                    queries.append(SearchQuery(term=t, location=loc, stream=detect_query_stream(t)))
            if queries:
                return queries
        except Exception:
            pass

    if DEFAULT_QUERIES:
        return list(DEFAULT_QUERIES)

    # Multi-sector default discovery queries for fresh runs
    return [
        SearchQuery(term="Registered Nurse", location=location, stream="healthcare"),
        SearchQuery(term="Financial Accountant", location=location, stream="finance"),
        SearchQuery(term="Site Supervisor", location=location, stream="trades"),
        SearchQuery(term="Legal Counsel", location=location, stream="legal"),
        SearchQuery(term="Systems Engineer", location=location, stream="technology"),
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect and normalize jobs from supported sources")
    parser.add_argument(
        "--source",
        action="append",
        choices=["indeed", "seek", "linkedin", "adzuna", "remoteok"],
        dest="sources",
    )
    parser.add_argument("-q", "--query", action="append", dest="queries", help="Target search term/title to scrape (repeatable)")
    parser.add_argument("-l", "--location", type=str, default="Melbourne, VIC", help="Location filter (default: 'Melbourne, VIC')")
    parser.add_argument("--profile-json", type=Path, default=None, help="Path to profile JSON to extract targetTitles and location")
    parser.add_argument("--days", type=int, default=14)
    parser.add_argument("--output", type=Path, default=Path("jobs.json"))
    parser.add_argument("--seek-browser-fallback", action="store_true")
    parser.add_argument("--seek-cache-path", type=Path)
    parser.add_argument("--seek-cache-fallback", action="store_true")
    parser.add_argument("--proxy", type=str, default=None, help="Proxy URL (http://user:pass@host:port or socks5://...)")
    args = parser.parse_args()

    source_names = args.sources or ["indeed", "seek", "linkedin", "adzuna", "remoteok"]
    sources = build_sources(source_names)
    for source in sources:
        if hasattr(source, "proxy_rotator") and args.proxy:
            from .sources.proxy import ProxyRotator
            source.proxy_rotator = ProxyRotator([args.proxy])
        if isinstance(source, SeekApiSource):
            source.allow_browser_fallback = args.seek_browser_fallback
            source.cache_path = args.seek_cache_path
            source.allow_cache_fallback = args.seek_cache_fallback
    
    target_queries = resolve_cli_queries(
        cli_queries=args.queries,
        location=args.location,
        profile_path=args.profile_json,
    )
    jobs = ScrapePipeline(sources, days=args.days).run(target_queries)
    payload = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "sources": source_names,
        "total": len(jobs),
        "jobs": jobs,
    }
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Collected {len(jobs)} jobs from {', '.join(source_names)} -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
