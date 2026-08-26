import argparse
import os
import threading
import time
from pathlib import Path

from .llm import OpenRouterDocumentGenerator
from .profile import load_profile
from .scrape_config import DEFAULT_QUERIES
from .sources import AdzunaApiSource, IndeedJobSpySource, LinkedInBrowserSource, RemoteOkApiSource, SeekApiSource
from .web import DashboardApp, serve

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SYNC_INTERVAL_SECONDS = 30 * 60


def load_dotenv(path: Path):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key and key not in os.environ:
            os.environ[key] = value.strip().strip("\"'")


def main():
    load_dotenv(PROJECT_ROOT / ".env")
    parser = argparse.ArgumentParser(description="Run the local job dashboard")
    parser.add_argument("--profile", type=Path, default=PROJECT_ROOT.parent / "job-dashboard-site" / "job_profile.json")
    parser.add_argument("--data-dir", type=Path, default=PROJECT_ROOT / "data")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--no-linkedin", action="store_true")
    parser.add_argument("--source-dir", type=Path, default=PROJECT_ROOT / "Source of truth")
    parser.add_argument("--guidelines-dir", type=Path, default=PROJECT_ROOT / "Guidelines")
    parser.add_argument("--examples-dir", type=Path, default=PROJECT_ROOT / "Guidelines" / "Examples")
    args = parser.parse_args()
    profile = load_profile(args.profile)
    seek_enabled = os.getenv("SEEK_ENABLED", "1").lower() not in {"0", "false", "no"}
    sources = [IndeedJobSpySource()]
    if seek_enabled:
        sources.append(SeekApiSource(
            max_pages=int(os.getenv("SEEK_MAX_PAGES", "3")),
            max_results=int(os.getenv("SEEK_MAX_RESULTS", "60")),
            pause_seconds=float(os.getenv("SEEK_PAUSE_SECONDS", "1.5")),
            endpoint=os.getenv("SEEK_API_ENDPOINT") or None,
            allow_browser_fallback=os.getenv("SEEK_BROWSER_FALLBACK", "true").lower() in {"1", "true", "yes"},
            cache_path=os.getenv("SEEK_CACHE_PATH") or PROJECT_ROOT.parent / "job-dashboard-site" / "scrapers" / "jobs_seek_robust.json",
            allow_cache_fallback=os.getenv("SEEK_CACHE_FALLBACK", "true").lower() in {"1", "true", "yes"},
        ))
    sources.extend([AdzunaApiSource(), RemoteOkApiSource()])
    if not args.no_linkedin:
        sources.append(LinkedInBrowserSource())
    generator = OpenRouterDocumentGenerator(args.source_dir, args.guidelines_dir, examples_dir=args.examples_dir)
    app = DashboardApp(profile, sources, args.data_dir, generator, DEFAULT_QUERIES)
    def synchronize():
        try:
            app.refresh(app.search_queries)
            print("Sources refreshed in the background.", flush=True)
        except Exception as error:
            print(f"Source refresh failed: {error}", flush=True)
        if list(PROJECT_ROOT.glob("client_secret_*.json")) and (args.data_dir / "gmail_token.json").exists():
            try:
                app.scan_gmail(days=7)
                print("Gmail scanned in the background (last 7 days).", flush=True)
            except Exception as error:
                print(f"Gmail scan failed: {error}", flush=True)

    def sync_loop():
        synchronize()
        while True:
            time.sleep(SYNC_INTERVAL_SECONDS)
            synchronize()

    threading.Thread(target=sync_loop, daemon=True).start()
    print("Automatic source refresh and Gmail scan enabled (on launch and every 30 minutes).")
    if not app.jobs:
        print("No saved jobs yet. Use Refresh in the dashboard to scrape configured queries.")
    serve(app, port=args.port)


if __name__ == "__main__":
    main()
