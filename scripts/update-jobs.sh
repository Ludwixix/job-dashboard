#!/bin/bash
set -e

echo "=== Starting daily job update $(date) ==="

# 1. Run the scraper
cd /home/s/.openclaw/workspace/job-dashboard-site/scrapers
echo "Running Python scraper..."
python3 scrape_all.py

# 2. Copy the resulting json
echo "Copying data to React app..."
cp jobs_combined.json /home/s/.openclaw/workspace/job-dashboard-react/public/jobs_combined.json

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
