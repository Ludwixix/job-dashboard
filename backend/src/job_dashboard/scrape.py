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
    SeekApiSource,
)


def build_sources(names: list[str]) -> list[JobSource]:
    factories = {
        "indeed": IndeedJobSpySource,
        "seek": SeekApiSource,
        "linkedin": LinkedInBrowserSource,
        "adzuna": AdzunaApiSource,
        "remoteok": RemoteOkApiSource,
    }
    unknown = sorted(set(names) - set(factories))
    if unknown:
        raise ValueError(f"unknown source(s): {', '.join(unknown)}")
    return [factories[name]() for name in names]


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect and normalize jobs from supported sources")
    parser.add_argument(
        "--source",
        action="append",
        choices=["indeed", "seek", "linkedin", "adzuna", "remoteok"],
        dest="sources",
    )
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
    jobs = ScrapePipeline(sources, days=args.days).run(DEFAULT_QUERIES)
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
