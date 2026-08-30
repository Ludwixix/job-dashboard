"""
scrape_daily.py — Daily job scrape with rate limiting, retries, and optional proxy support.

Usage:
    python scrape_daily.py                    # Use defaults from scrape-config.json
    python scrape_daily.py --proxy free       # Enable free proxy rotation
    python scrape_daily.py --proxy none       # Direct connection (default, fastest)
    python scrape_daily.py --proxy static     # Use static proxy list from config
"""

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from jobspy_scraper import EnhancedScraper

ROOT = Path(r"C:\Users\samlu\.openclaw\workspace")
DATA_PATH = ROOT / "jobs_nonlinkedin_2026-08-08.json"
CONFIG_PATH = ROOT / "scrape-config.json"
NOW = datetime.now(timezone(timedelta(hours=10)))
CUTOFF = NOW - timedelta(days=14)
TODAY = NOW.strftime("%Y-%m-%d")

# ── Search terms ─────────────────────────────────────────────────────

INDEED = [
    ("systems administrator", "Melbourne VIC"), ("systems administrator", "Remote"),
    ("infrastructure engineer", "Melbourne VIC"), ("infrastructure engineer", "Remote"),
    ("network engineer", "Melbourne VIC"), ("network engineer", "Remote"),
    ("cloud engineer", "Melbourne VIC"), ("cloud engineer", "Remote"),
    ("devops engineer", "Melbourne VIC"), ("devops engineer", "Remote"),
    ("azure engineer", "Melbourne VIC"), ("azure engineer", "Remote"),
    ("platform engineer", "Melbourne VIC"), ("platform engineer", "Remote"),
    ("security analyst", "Melbourne VIC"), ("soc analyst", "Melbourne VIC"),
    ("cyber security", "Melbourne VIC"),
    ("service desk analyst", "Melbourne VIC"), ("help desk", "Melbourne VIC"),
    ("desktop support", "Melbourne VIC"), ("IT support", "Melbourne VIC"),
    ("IT project manager", "Melbourne VIC"), ("business analyst", "Melbourne VIC"),
    ("software developer", "Melbourne VIC"), ("software engineer", "Melbourne VIC"),
    ("data analyst", "Melbourne VIC"), ("telecom engineer", "Melbourne VIC"),
    ("endpoint engineer", "Melbourne VIC"), ("intune", "Melbourne VIC"),
    ("microsoft 365", "Melbourne VIC"), ("entra ID", "Melbourne VIC"),
    ("windows server", "Melbourne VIC"),
]
LINKEDIN = [
    "systems administrator", "infrastructure engineer", "network engineer",
    "cloud engineer", "devops engineer", "azure engineer",
    "security analyst", "service desk analyst", "desktop support",
    "IT project manager", "business analyst", "software developer",
    "data analyst", "endpoint engineer", "intune", "microsoft 365",
    "telecom engineer",
]

# Non-IT searches: outdoors, hands-on, trades, local jobs
NON_IT_INDEED = [
    # Hands-on / Trades
    ("handyman", "Melbourne VIC"), ("handyman", "Balaclava VIC"),
    ("maintenance worker", "Melbourne VIC"), ("maintenance worker", "Balaclava VIC"),
    ("facilities assistant", "Melbourne VIC"), ("facilities coordinator", "Melbourne VIC"),
    ("warehouse worker", "Melbourne VIC"), ("warehouse assistant", "Balaclava VIC"),
    ("delivery driver", "Melbourne VIC"), ("delivery driver", "Balaclava VIC"),
    ("removalist", "Melbourne VIC"), ("removalist", "Balaclava VIC"),
    ("cleaning supervisor", "Melbourne VIC"), ("cleaning team leader", "Balaclava VIC"),
    # Outdoors
    ("groundskeeper", "Melbourne VIC"), ("gardener", "Melbourne VIC"),
    ("parks worker", "Melbourne VIC"), ("outdoor worker", "Melbourne VIC"),
    ("tree lopper", "Melbourne VIC"), ("arborist", "Melbourne VIC"),
    ("fencer", "Melbourne VIC"), ("concreter", "Melbourne VIC"),
    ("landscaper", "Melbourne VIC"), ("landscaping", "Balaclava VIC"),
    # On the tools
    ("printer technician", "Melbourne VIC"), ("field technician", "Melbourne VIC"),
    ("network technician", "Melbourne VIC"), ("cable technician", "Melbourne VIC"),
    ("AV technician", "Melbourne VIC"), ("installations technician", "Melbourne VIC"),
    ("electrician", "Melbourne VIC"), ("plumber", "Melbourne VIC"),
    ("painter", "Melbourne VIC"), ("tiler", "Melbourne VIC"),
    # Local Balaclava
    ("general labourer", "Balaclava VIC"), ("store person", "Balaclava VIC"),
    ("receptionist", "Balaclava VIC"), ("retail assistant", "Balaclava VIC"),
    ("barista", "Balaclava VIC"), ("cafe", "Balaclava VIC"),
    ("packer", "Balaclava VIC"), ("pick packer", "Balaclava VIC"),
]

NON_IT_CATEGORIES = {
    "handyman": "Trades / Handyman", "maintenance": "Facilities / Maintenance",
    "facilities": "Facilities / Maintenance", "warehouse": "Warehouse / Logistics",
    "delivery": "Transport / Delivery", "removalist": "Transport / Removalist",
    "cleaning": "Cleaning / Facilities", "groundskeeper": "Outdoor / Grounds",
    "gardener": "Outdoor / Grounds", "parks": "Outdoor / Grounds",
    "outdoor": "Outdoor / Grounds", "tree": "Outdoor / Grounds",
    "arborist": "Outdoor / Grounds", "fencer": "Trades / Outdoor",
    "concreter": "Trades / Outdoor", "landscap": "Outdoor / Grounds",
    "printer technician": "Technician / Field", "field technician": "Technician / Field",
    "network technician": "Technician / Field", "cable": "Technician / Field",
    "AV": "Technician / Field", "installation": "Technician / Field",
    "electrician": "Trades / Electrical", "plumber": "Trades / Plumbing",
    "painter": "Trades / Painting", "tiler": "Trades / Tiling",
    "general labour": "Labour / General", "store person": "Warehouse / Logistics",
    "receptionist": "Admin / Front Desk", "retail": "Retail / Customer Service",
    "barista": "Hospitality / Cafe", "cafe": "Hospitality / Cafe",
    "packer": "Warehouse / Logistics", "pick packer": "Warehouse / Logistics",
}

CAT = {
    "systems administrator": "IT / SysAdmin", "infrastructure engineer": "IT / SysAdmin",
    "windows server": "IT / SysAdmin", "network engineer": "Network Engineer",
    "cloud engineer": "Cloud / DevOps", "devops engineer": "Cloud / DevOps",
    "azure engineer": "Cloud / DevOps", "platform engineer": "Cloud / DevOps",
    "security analyst": "Security / SOC", "soc analyst": "Security / SOC",
    "cyber security": "Security / SOC", "service desk": "Service Desk",
    "help desk": "Service Desk", "desktop support": "Service Desk",
    "IT support": "Service Desk", "IT project manager": "PM / BA",
    "business analyst": "PM / BA", "software developer": "Software Dev",
    "software engineer": "Software Dev", "data analyst": "Data / Analytics",
    "telecom": "Telecom / NBN", "endpoint": "Endpoint / MDM",
    "intune": "Endpoint / MDM", "microsoft 365": "M365 / Entra",
    "entra": "M365 / Entra",
}


def cat(t):
    tl = t.lower()
    for k, v in CAT.items():
        if k in tl:
            return v
    return "IT / General"


def ok_date(d):
    if not d:
        return False
    try:
        return datetime.strptime(str(d)[:10], "%Y-%m-%d").date() >= CUTOFF.date()
    except Exception:
        return False


def main():
    parser = argparse.ArgumentParser(description="Daily job scrape with proxy/retry support")
    parser.add_argument("--proxy", choices=["none", "free", "static", "paid"], default="none",
                        help="Proxy mode: none (default), free (free-rotate), static, paid")
    args = parser.parse_args()

    # Override config proxy mode if specified
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8")) if CONFIG_PATH.exists() else {}
    if args.proxy != "none":
        config.setdefault("proxy", {})["enabled"] = True
        config["proxy"]["mode"] = {"free": "free-rotate", "static": "static-list", "paid": "paid-api"}.get(args.proxy, "none")
        # Write temp config override
        tmp_config = ROOT / "scrape-config-tmp.json"
        tmp_config.write_text(json.dumps(config, indent=2), encoding="utf-8")
        scraper = EnhancedScraper(str(tmp_config))
        tmp_config.unlink(missing_ok=True)
    else:
        scraper = EnhancedScraper(str(CONFIG_PATH))

    print(f"Proxy mode: {scraper.config['proxy']['mode']}")
    print(f"Loaded {len(scraper.proxies)} proxies")
    print(f"Rate limit: {scraper.config['rate_limit']['delay_between_searches_seconds']}s between searches")
    print(f"Max retries: {scraper.config['retry']['max_retries']}")

    # Load existing data
    ex = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    done = set()
    for j in ex.get("jobs", []):
        u = (j.get("application_route") or j.get("url", "")).strip().rstrip("/")
        if u:
            done.add(u)
    for sj in ex.get("sections", {}).values():
        for j in sj:
            u = (j.get("application_route") or j.get("url", "")).strip().rstrip("/")
            if u:
                done.add(u)
    print(f"\nExisting: {len(ex.get('jobs', []))} core, {len(done)} URLs")

    new_all = []; seen = set(); cc = {}; sc = {"indeed": 0, "linkedin": 0}

    # ── Indeed searches ──────────────────────────────────────────────
    print("\n=== Indeed + Google ===")
    for term, loc in INDEED:
        try:
            df = scraper.search(
                site_name=["indeed"], search_term=term, location=loc,
                results_wanted=20, hours_old=336, country_indeed="australia",
            )
            if df is None or df.empty:
                continue
            n = 0
            for _, row in df.iterrows():
                url = str(row.get("job_url", "")).strip().rstrip("/")
                if not url or url in seen or url in done:
                    continue
                if not ok_date(row.get("date_posted")):
                    continue
                s = str(row.get("site", "")).lower()
                sl = "Indeed" if "indeed" in s else "Google Jobs"
                c = cat(term)
                j = {
                    "rank": 0, "score": 75, "company": str(row.get("company", "Unknown")),
                    "title": str(row.get("title", "Unknown")),
                    "location": str(row.get("location", loc)),
                    "posted": str(row.get("date_posted", ""))[:10] if row.get("date_posted") else "",
                    "source": sl, "url": url,
                    "remote": "remote" in str(row.get("location", "")).lower(),
                    "why": f"Fresh {sl} listing matching '{term}'. Category: {c}.",
                    "tags": [t for t in term.split() if len(t) > 2][:5],
                    "status": "Fresh individual listing",
                    "application_route": url, "application_route_type": f"{sl} listing",
                    "listing_verification": f"Captured from {sl} on {TODAY}. Confirm availability before applying.",
                    "_cat": c, "_li": False,
                }
                new_all.append(j); seen.add(url); n += 1; sc["indeed"] += 1
            if n:
                cc[cat(term)] = cc.get(cat(term), 0) + n
                print(f"  {term}/{loc}: +{n}")
        except Exception as e:
            print(f"  ERR {term}/{loc}: {e}")

    # ── LinkedIn searches ────────────────────────────────────────────
    print("\n=== LinkedIn ===")
    for term in LINKEDIN:
        try:
            df = scraper.search(
                site_name=["linkedin"], search_term=term, location="Melbourne VIC",
                results_wanted=20, hours_old=336, country_indeed="australia",
            )
            if df is None or df.empty:
                continue
            n = 0
            for _, row in df.iterrows():
                url = str(row.get("job_url", "")).strip().rstrip("/")
                if not url or url in seen or url in done:
                    continue
                if not ok_date(row.get("date_posted")):
                    continue
                c = cat(term)
                j = {
                    "rank": 0, "score": 70, "company": str(row.get("company", "Unknown")),
                    "title": str(row.get("title", "Unknown")),
                    "location": str(row.get("location", "Melbourne VIC")),
                    "posted": str(row.get("date_posted", ""))[:10] if row.get("date_posted") else "",
                    "source": "LinkedIn", "url": url,
                    "remote": "remote" in str(row.get("location", "")).lower(),
                    "why": f"LinkedIn listing matching '{term}'. Category: {c}. Verify before applying.",
                    "tags": [t for t in term.split() if len(t) > 2][:5],
                    "status": "LinkedIn listing - verify",
                    "application_route": url, "application_route_type": "LinkedIn listing",
                    "listing_verification": f"LinkedIn listing captured on {TODAY}. Requires manual verification before applying.",
                    "_cat": c, "_li": True,
                }
                new_all.append(j); seen.add(url); n += 1; sc["linkedin"] += 1
            if n:
                cc[cat(term)] = cc.get(cat(term), 0) + n
                print(f"  {term}: +{n}")
        except Exception as e:
            print(f"  ERR {term}: {e}")

    # ── Non-IT searches ──────────────────────────────────────────────
    print("\n=== Non-IT / Hands-On ===")
    new_non_it = []; seen_non_it = set()
    for term, loc in NON_IT_INDEED:
        try:
            df = scraper.search(
                site_name=["indeed"], search_term=term, location=loc,
                results_wanted=20, hours_old=336, country_indeed="australia",
            )
            if df is None or df.empty:
                continue
            n = 0
            for _, row in df.iterrows():
                url = str(row.get("job_url", "")).strip().rstrip("/")
                if not url or url in seen or url in done or url in seen_non_it:
                    continue
                if not ok_date(row.get("date_posted")):
                    continue
                c = cat(term)
                j = {
                    "rank": 0, "score": 75, "company": str(row.get("company", "Unknown")),
                    "title": str(row.get("title", "Unknown")),
                    "location": str(row.get("location", loc)),
                    "posted": str(row.get("date_posted", ""))[:10] if row.get("date_posted") else "",
                    "source": "Indeed", "url": url,
                    "remote": "remote" in str(row.get("location", "")).lower(),
                    "why": f"Hands-on/outdoor listing matching '{term}'. Category: {c}.",
                    "tags": [t for t in term.split() if len(t) > 2][:5],
                    "status": "Fresh non-IT listing",
                    "application_route": url, "application_route_type": "Indeed listing",
                    "listing_verification": f"Captured from Indeed on {TODAY}. Confirm availability before applying.",
                    "_cat": c, "_section": "other",
                }
                new_non_it.append(j); seen_non_it.add(url); n += 1
            if n:
                print(f"  {term}/{loc}: +{n}")
        except Exception as e:
            print(f"  ERR {term}/{loc}: {e}")

    # Score non-IT jobs
    for j in new_non_it:
        s = 70
        if j["source"] == "Indeed":
            s += 5
        tl = j["title"].lower()
        # Boost for crossover skills (tech background useful)
        if any(k in tl for k in ["technician", "field", "network", "cable", "printer", "AV"]):
            s += 10  # Tech crossover — Sam's IT background is directly relevant
        if any(k in tl for k in ["maintenance", "facilities", "handyman"]):
            s += 5
        if "balaclava" in j["location"].lower():
            s += 8  # Local boost
        j["score"] = min(s, 99)
    new_non_it.sort(key=lambda j: (-j["score"], j.get("posted", ""), j.get("company", "")))
    for i, j in enumerate(new_non_it, 1):
        j["rank"] = i

    # ── Scoring (IT) ─────────────────────────────────────────────────
    for j in new_all:
        s = 70
        if j["source"] == "Indeed":
            s += 5
        if not j.get("_li"):
            s += 5
        tl = j["title"].lower()
        if any(k in tl for k in ["senior", "lead", "principal"]):
            s += 3
        if any(k in tl for k in ["engineer", "architect"]):
            s += 2
        if "remote" in j["location"].lower():
            s += 2
        if "balaclava" in j["location"].lower():
            s += 5
        j["score"] = min(s, 99)
    new_all.sort(key=lambda j: (-j["score"], j.get("posted", ""), j.get("company", "")))
    for i, j in enumerate(new_all, 1):
        j["rank"] = i

    # ── Merge ────────────────────────────────────────────────────────
    non_li = [j for j in new_all if not j.get("_li")]
    li = [j for j in new_all if j.get("_li")]

    # IT jobs → core jobs (non-LinkedIn)
    for j in non_li:
        ex["jobs"].append({k: v for k, v in j.items() if not k.startswith("_")})

    sec = ex.get("sections", {})

    # LinkedIn jobs
    if "linkedin" not in sec:
        sec["linkedin"] = []
    for j in li:
        sec["linkedin"].append({k: v for k, v in j.items() if not k.startswith("_")})

    # Non-IT / Hands-on jobs → new section
    if "other" not in sec:
        sec["other"] = []
    for j in new_non_it:
        sec["other"].append({k: v for k, v in j.items() if not k.startswith("_")})

    ex["sections"] = sec

    # Sort all sections
    ex["jobs"].sort(key=lambda j: (-int(j.get("score", 0)), str(j.get("posted", "")), str(j.get("company", ""))))
    for i, j in enumerate(ex["jobs"], 1):
        j["rank"] = i
    sec["linkedin"].sort(key=lambda j: (-int(j.get("score", 0)), str(j.get("posted", ""))))
    for i, j in enumerate(sec["linkedin"], 1):
        j["rank"] = i
    sec["other"].sort(key=lambda j: (-int(j.get("score", 0)), str(j.get("posted", ""))))
    for i, j in enumerate(sec["other"], 1):
        j["rank"] = i

    total = len(ex["jobs"]) + sum(len(v) for v in sec.values())
    ex["updated"] = NOW.isoformat()
    ex["count"] = total
    ex["filtered_at"] = NOW.isoformat()
    ex["filtered_cutoff"] = CUTOFF.isoformat()
    ex["filtered_end"] = NOW.isoformat()
    ex["policy"] = "Fresh scrape Indeed+LinkedIn with proxy rotation and rate limiting. LinkedIn tagged verify. 14-day filter."
    ex["source_searches"] = [
        {"name": "Indeed AU", "type": "job board", "url": "https://au.indeed.com", "status": "Fresh listings"},
        {"name": "Google Jobs", "type": "job search", "url": "https://www.google.com/search?q=IT+jobs+Melbourne", "status": "Via JobSpy"},
        {"name": "LinkedIn", "type": "professional network", "url": "https://www.linkedin.com/jobs", "status": "Verify before applying"},
    ]
    DATA_PATH.write_text(json.dumps(ex, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    dashboard_path = ROOT / "job-dashboard-site" / "jobs_nonlinkedin_2026-08-08.json"
    if dashboard_path.exists():
        dashboard_path.write_text(json.dumps(ex, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"\n{'=' * 50}")
    print(f"SCRAPE DONE — {TODAY}")
    print(f"{'=' * 50}")
    print(f"Total: {total}  Core: {len(ex['jobs'])}  LinkedIn: {len(sec['linkedin'])}")
    print(f"New: {len(new_all)} (non-LI: {len(non_li)}, LI: {len(li)})")
    print("Categories:")
    for c, n in sorted(cc.items(), key=lambda x: -x[1]):
        print(f"  {c}: {n}")
    print(f"Sources: {sc}")


if __name__ == "__main__":
    main()
