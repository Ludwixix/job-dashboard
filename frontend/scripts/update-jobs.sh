#!/bin/bash
set -e

LOCK_FILE=/tmp/job-dashboard-scrape.lock
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    echo "Another job scrape is already running; exiting."
    exit 0
fi

echo "=== Starting daily job update $(date) ==="

# 1. Run the authoritative backend scraper.
# Do not call the archived job-dashboard-site scraper here: its output is a
# legacy JSON snapshot and the React app reads the modular backend's SQLite
# index through /api/jobs.
BACKEND=/home/s/.openclaw/workspace/job-dashboard-modular
SCRAPE_OUTPUT=$(mktemp --suffix=.json)
trap 'rm -f "$SCRAPE_OUTPUT"' EXIT
cd "$BACKEND"
mkdir -p /home/s/.openclaw/workspace/job-dashboard-react
exec >> /home/s/.openclaw/workspace/job-dashboard-react/cron.log 2>&1
echo "=== Scraper log started $(date -Is) ==="
echo "Running modular backend scraper..."
PYTHONPATH=src python3 -m job_dashboard.scrape \
    --source indeed --source seek --source adzuna --source remoteok \
    --days 14 --output "$SCRAPE_OUTPUT" \
    --seek-cache-path "$BACKEND/data/seek_cache.json" \
    --seek-cache-fallback

test -s "$SCRAPE_OUTPUT"

# 2. Copy the resulting json & upsert into SQLite jobs database
echo "Copying data to React app & updating SQLite database..."
cp "$SCRAPE_OUTPUT" /home/s/.openclaw/workspace/job-dashboard-react/public/jobs_combined.json
python3 -c '
import json, sys
from pathlib import Path
sys.path.insert(0, "/home/s/.openclaw/workspace/job-dashboard-modular/src")
from job_dashboard.repository import JobRepository

p = Path(sys.argv[1])
if p.exists():
    raw = json.loads(p.read_text(encoding="utf-8"))
    jobs = raw.get("jobs", raw) if isinstance(raw, dict) else raw
    db_path = "/home/s/.openclaw/workspace/job-dashboard-modular/data/jobs.sqlite3"
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    repo = JobRepository(db_path)
    print(f"Indexed {repo.upsert_scraped_jobs(jobs)} scraped jobs")
' "$SCRAPE_OUTPUT"

# 3. Commit and push
cd /home/s/.openclaw/workspace/job-dashboard-react
if git status --porcelain | grep -q "public/jobs_combined.json"; then
    echo "Changes detected, committing and pushing..."
    git add public/jobs_combined.json
    git -c user.email="sam.ludwig@gmail.com" -c user.name="Sam Ludwig" commit -m "chore(data): daily scraper update [skip ci]" || echo "No changes to commit"
    # Note: push without [skip ci] if we WANT GitHub Actions to build the site, which we DO!
    # Wait, if we push, GitHub Actions will trigger, build the site, and deploy it to Pages!
    git commit --amend -m "chore(data): daily scraper update" || echo ""
    git push "https://Ludwixix:$(gh auth token)@github.com/Ludwixix/job-dashboard-react.git" master
    echo "Push successful."
else
    echo "No changes in scraped data."
fi

echo "=== Update complete ==="
