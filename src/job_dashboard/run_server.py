import argparse
import os
import threading
import time
from pathlib import Path

from .config import settings
from .llm import OpenRouterDocumentGenerator
from .profile import load_profile
from .scrape_config import DEFAULT_QUERIES
from .sources import (
    AdzunaApiSource,
    IndeedJobSpySource,
    LinkedInBrowserSource,
    RemoteOkApiSource,
    SeekApiSource,
)
from .web import DashboardApp, serve

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SYNC_INTERVAL_SECONDS = settings.sync_interval_seconds


def main():
    parser = argparse.ArgumentParser(description="Run the job dashboard server")
    parser.add_argument("--profile", type=Path, default=None)
    parser.add_argument("--data-dir", type=Path, default=settings.data_dir)
    parser.add_argument("--port", type=int, default=None)
    parser.add_argument("--host", type=str, default=None)
    parser.add_argument("--no-linkedin", action="store_true")
    parser.add_argument("--source-dir", type=Path, default=settings.source_dir)
    parser.add_argument("--guidelines-dir", type=Path, default=settings.guidelines_dir)
    parser.add_argument("--examples-dir", type=Path, default=settings.examples_dir)
    args = parser.parse_args()

    # Cloud Run injects $PORT; fall back to arg, then settings, then 8080
    port = int(os.environ.get("PORT") or args.port or settings.port or 8080)
    # Cloud Run requires binding to 0.0.0.0
    host = os.environ.get("HOST") or args.host or "0.0.0.0"


    # Profile is optional on Cloud Run — use empty profile if not found
    profile_path = args.profile or (PROJECT_ROOT.parent / "job-dashboard-site" / "job_profile.json")
    profile = load_profile(profile_path) if profile_path.exists() else {}

    # Validate and warn about missing credentials
    from .logging import get_logger
    startup_logger = get_logger("job_dashboard.startup")
    
    if settings.seek_enabled:
        startup_logger.info("Seek scraper enabled")
    
    if settings.adzuna_app_id and settings.adzuna_api_key:
        startup_logger.info("Adzuna credentials loaded")
    else:
        startup_logger.warning("Adzuna credentials not found (set ADZUNA_APP_ID and ADZUNA_API_KEY)")
    
    if settings.openrouter_api_key:
        startup_logger.info("OpenRouter API key loaded")
    else:
        startup_logger.warning("OpenRouter API key not found (set JOB_DASHBOARD_OPENROUTER_API_KEY)")

    sources = [IndeedJobSpySource()]
    if settings.seek_enabled:
        sources.append(SeekApiSource(
            max_pages=settings.seek_max_pages,
            max_results=settings.seek_max_results,
            pause_seconds=settings.seek_pause_seconds,
            endpoint=settings.seek_api_endpoint,
            allow_browser_fallback=settings.seek_browser_fallback,
            cache_path=settings.seek_cache_path,
            allow_cache_fallback=settings.seek_cache_fallback,
        ))
    sources.extend([AdzunaApiSource(
        app_id=settings.adzuna_app_id,
        api_key=settings.adzuna_api_key,
    ), RemoteOkApiSource()])
    if not args.no_linkedin and settings.linkedin_enabled:
        sources.append(LinkedInBrowserSource())
    generator = OpenRouterDocumentGenerator(
        args.source_dir,
        args.guidelines_dir,
        model=settings.llm_model,
        api_key=settings.openrouter_api_key,
        examples_dir=args.examples_dir
    )
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

        try:
            # Simple 24h throttling (storing last run in data dir)
            digest_flag = args.data_dir / "last_digest.txt"
            should_send = True
            if digest_flag.exists():
                last_time = float(digest_flag.read_text())
                if time.time() - last_time < 86400:
                    should_send = False
            
            if should_send:
                app.send_daily_digest()
                digest_flag.write_text(str(time.time()))
                print("Daily email digest generated.", flush=True)
        except Exception as error:
            print(f"Digest failed: {error}", flush=True)

        try:
            app.sync_tracker()
            print("Application tracker synced in the background.", flush=True)
        except Exception as error:
            print(f"Tracker sync failed: {error}", flush=True)

    def sync_loop():
        synchronize()
        while True:
            time.sleep(SYNC_INTERVAL_SECONDS)
            synchronize()

    threading.Thread(target=sync_loop, daemon=True).start()
    print(f"Job dashboard starting on http://{host}:{port}")
    print("Automatic source refresh, Gmail scan, and tracker sync enabled.")
    if not app.jobs:
        print("No saved jobs yet. Use /api/refresh to scrape configured queries.")
    serve(app, host=host, port=port)


if __name__ == "__main__":
    main()