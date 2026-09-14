from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urljoin

from ..logging import get_logger

logger = get_logger("job_dashboard.sources.resilience")


def extract_from_json_ld(html: str) -> list[dict[str, Any]]:
    """Extract standard Schema.org JobPosting records from any HTML document.
    Works universally across Indeed, Seek, LinkedIn, and company career portals.
    """
    results: list[dict[str, Any]] = []
    if not html:
        return results

    ld_blocks = re.findall(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.DOTALL | re.IGNORECASE,
    )
    for raw in ld_blocks:
        raw_clean = raw.strip()
        if not raw_clean:
            continue
        try:
            parsed = json.loads(raw_clean)
        except Exception:
            continue

        items = []
        if isinstance(parsed, list):
            items = parsed
        elif isinstance(parsed, dict):
            if "@graph" in parsed and isinstance(parsed["@graph"], list):
                items = parsed["@graph"]
            else:
                items = [parsed]

        for it in items:
            if not isinstance(it, dict):
                continue
            item_type = str(it.get("@type", "")).strip()
            if item_type.lower() != "jobposting":
                continue

            title = str(it.get("title", "")).strip()
            if not title:
                continue

            # Company extraction
            hiring_org = it.get("hiringOrganization")
            company = ""
            if isinstance(hiring_org, dict):
                company = str(hiring_org.get("name", "")).strip()
            elif isinstance(hiring_org, str):
                company = hiring_org.strip()

            # Location extraction
            job_loc = it.get("jobLocation")
            location = ""
            if isinstance(job_loc, dict):
                addr = job_loc.get("address")
                if isinstance(addr, dict):
                    loc_parts = [
                        addr.get("addressLocality"),
                        addr.get("addressRegion"),
                        addr.get("addressCountry"),
                    ]
                    location = ", ".join(str(p).strip() for p in loc_parts if p)
                elif isinstance(addr, str):
                    location = addr.strip()
            elif isinstance(job_loc, list) and job_loc:
                first = job_loc[0]
                if isinstance(first, dict):
                    addr = first.get("address")
                    if isinstance(addr, dict):
                        loc_parts = [
                            addr.get("addressLocality"),
                            addr.get("addressRegion"),
                        ]
                        location = ", ".join(str(p).strip() for p in loc_parts if p)

            # Description
            description = str(it.get("description", "")).strip()
            url = str(it.get("url", "")).strip()
            date_posted = str(it.get("datePosted", "")).strip()

            # Remote / employment type
            work_mode = "onsite"
            applicant_loc_req = it.get("applicantLocationRequirements")
            job_loc_type = str(it.get("jobLocationType", "")).upper()
            if job_loc_type == "TELECOMMUTE" or "remote" in location.lower():
                work_mode = "remote"

            # Salary estimation / extraction
            base_salary = it.get("baseSalary")
            salary_text = ""
            if isinstance(base_salary, dict):
                val = base_salary.get("value")
                currency = base_salary.get("currency", "AUD")
                if isinstance(val, dict):
                    min_val = val.get("minValue")
                    max_val = val.get("maxValue")
                    if min_val and max_val:
                        salary_text = f"${min_val:,.0f} - ${max_val:,.0f} {currency}"
                    elif min_val:
                        salary_text = f"${min_val:,.0f}+ {currency}"
                elif isinstance(val, (int, float)):
                    salary_text = f"${val:,.0f} {currency}"

            results.append({
                "title": title,
                "company": company or "Confidential",
                "location": location or "Australia",
                "description": description,
                "url": url,
                "posted": date_posted,
                "salary": salary_text,
                "remote": work_mode == "remote",
                "work_mode": work_mode,
                "source": "Structured JSON-LD",
            })

    return results


def extract_balanced_json(text: str, start: int) -> str:
    """Extract a complete JSON object from an arbitrary script assignment."""
    opening = text.find("{", start)
    if opening < 0:
        return ""
    depth = 0
    in_string = False
    escaped = False
    for index in range(opening, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[opening : index + 1]
    return ""


def extract_embedded_state_jobs(html: str) -> list[dict[str, Any]]:
    """Scan HTML for common SPA state dumps (mosaic-provider-jobcards,
    __NEXT_DATA__, window._initialData, SEEK_REDUX_DATA, etc.).
    """
    results: list[dict[str, Any]] = []
    if not html:
        return results

    # 1. Indeed mosaic-provider-jobcards
    markers = [
        'window.mosaic.providerData["mosaic-provider-jobcards"]=',
        'window.mosaicProviderJobCardsModel=',
        '"mosaic-provider-jobcards":',
    ]
    for marker in markers:
        idx = html.find(marker)
        if idx >= 0:
            payload_text = extract_balanced_json(html, idx + len(marker))
            if payload_text:
                try:
                    payload = json.loads(payload_text)
                    model = payload.get("metaData", {}).get("mosaicProviderJobCardsModel", {})
                    card_results = model.get("results", []) or payload.get("results", [])
                    for item in card_results:
                        if not isinstance(item, dict):
                            continue
                        job_key = str(item.get("jobkey") or item.get("jobKey") or "").strip()
                        url = f"https://au.indeed.com/viewjob?jk={job_key}" if job_key else str(item.get("viewJobLink") or "")
                        title = str(item.get("displayTitle") or item.get("title") or "").strip()
                        company = str(item.get("company") or item.get("truncatedCompany") or "").strip()
                        location = str(item.get("formattedLocation") or "").strip()
                        snippet = str(item.get("snippet") or item.get("jobDescription") or "").strip()
                        is_remote = bool(item.get("remoteLocation")) or "remote" in f"{location} {title}".lower()
                        salary_text = ""
                        sal_snip = item.get("salarySnippet")
                        if isinstance(sal_snip, dict):
                            salary_text = str(sal_snip.get("text") or "")

                        if title and (url or job_key):
                            results.append({
                                "id": f"indeed-{job_key}" if job_key else None,
                                "provider_job_id": job_key or url,
                                "title": title,
                                "company": company or "Confidential",
                                "location": location or "Australia",
                                "description": snippet,
                                "url": url,
                                "salary": salary_text,
                                "remote": is_remote,
                                "posted": "today",
                                "source": "Indeed",
                            })
                    if results:
                        return results
                except Exception:
                    pass

    return results


# Browser-side resilient extraction JavaScript that inspects anchors,
# traverses up to find card containers, and extracts fields without
# relying on brittle CSS classes that websites change.
ADAPTIVE_BROWSER_EXTRACTOR_JS = """() => {
    const results = [];
    const seenUrls = new Set();
    const seenKeys = new Set();

    // Strategy 1: Find all candidate job links using URL patterns
    const linkSelectors = [
        'a[href*="/viewjob"]',
        'a[href*="/rc/clk"]',
        'a[data-jk]',
        'a[href*="/job/"]',
        'a[href*="/jobs/view/"]',
        'a[href*="/careers/"]',
        'a[data-automation="jobTitle"]',
        'a[data-testid*="job-title"]'
    ];

    const links = Array.from(document.querySelectorAll(linkSelectors.join(',')));

    for (const link of links) {
        const href = link.getAttribute('href') || '';
        const dataJk = link.getAttribute('data-jk') || link.closest('[data-jk]')?.getAttribute('data-jk') || '';
        
        let fullUrl = '';
        if (dataJk) {
            fullUrl = 'https://au.indeed.com/viewjob?jk=' + dataJk;
        } else if (href.startsWith('http')) {
            fullUrl = href;
        } else if (href.startsWith('/')) {
            fullUrl = window.location.origin + href;
        }
        
        if (!fullUrl || seenUrls.has(fullUrl)) continue;

        // Climb up to find the closest card container
        let card = link.parentElement;
        let depth = 0;
        while (card && card !== document.body && depth < 7) {
            const tag = card.tagName.toLowerCase();
            const cls = (card.className || '').toString().toLowerCase();
            const role = card.getAttribute('role') || '';
            
            if (
                tag === 'article' ||
                tag === 'li' ||
                card.getAttribute('data-jk') ||
                card.getAttribute('data-job-id') ||
                role === 'presentation' ||
                /card|job|result|beacon|tapitem/i.test(cls)
            ) {
                // Good container candidate
                if (card.innerText && card.innerText.length > 30 && card.offsetHeight < 2000) {
                    break;
                }
            }
            card = card.parentElement;
            depth++;
        }
        if (!card) card = link.parentElement;

        // Title
        let title = link.textContent.trim();
        if (!title || title.length < 3) {
            const h = card.querySelector('h1, h2, h3, [data-testid*="title"]');
            title = h?.textContent.trim() || '';
        }
        if (!title || title.length < 2) continue;

        // Company
        let company = '';
        const compEl = card.querySelector(
            '[data-testid*="company"], [class*="company"], [class*="employer"], [data-automation="jobCompany"], span.companyName'
        );
        if (compEl) {
            company = compEl.textContent.trim();
        }

        // Location
        let location = '';
        const locEl = card.querySelector(
            '[data-testid*="location"], [class*="location"], [data-automation="jobLocation"], .companyLocation'
        );
        if (locEl) {
            location = locEl.textContent.trim();
        }

        // Salary
        let salary = '';
        const salEl = card.querySelector(
            '[data-testid*="salary"], [class*="salary"], [data-automation="jobSalary"], .metadata'
        );
        if (salEl) {
            salary = salEl.textContent.trim();
        } else {
            // Text regex for salary in card
            const match = card.innerText.match(/\\$[\\d,]+(?:\\s*[-–]\\s*\\$?[\\d,]+)?(?:\\s*(?:per|a|\\/)?\\s*(?:year|annum|hr|hour|day))?/i);
            if (match) salary = match[0];
        }

        // Snippet / description
        let snippet = '';
        const snipEl = card.querySelector(
            '.job-snippet, [data-testid*="snippet"], [data-automation="jobSnippet"], ul'
        );
        if (snipEl) {
            snippet = snipEl.textContent.trim();
        }

        // Date
        let posted = '';
        const dateEl = card.querySelector(
            '[data-testid*="date"], [class*="date"], time, .date'
        );
        if (dateEl) {
            posted = dateEl.textContent.trim();
        }

        const normKey = (company + '__' + title).toLowerCase();
        if (seenKeys.has(normKey)) continue;
        seenKeys.add(normKey);
        seenUrls.add(fullUrl);

        const cardText = (card.innerText || '').toLowerCase();
        const isRemote = /remote|work from home|wfh|anywhere in australia/i.test(cardText) || /remote/i.test(location);

        results.push({
            id: dataJk ? ('indeed-' + dataJk) : '',
            provider_job_id: dataJk || fullUrl,
            title: title,
            company: company || 'Confidential',
            location: location || 'Australia',
            description: snippet,
            url: fullUrl,
            salary: salary,
            posted: posted || 'today',
            remote: isRemote
        });
    }

    return results;
};
"""
