from __future__ import annotations

import json
import random
import re
import threading
import time
from typing import Any, Mapping
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

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

            results.append(
                {
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
                }
            )

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
        "window.mosaicProviderJobCardsModel=",
        '"mosaic-provider-jobcards":',
    ]
    for marker in markers:
        idx = html.find(marker)
        if idx >= 0:
            payload_text = extract_balanced_json(html, idx + len(marker))
            if payload_text:
                try:
                    payload = json.loads(payload_text)
                    model = payload.get("metaData", {}).get(
                        "mosaicProviderJobCardsModel", {}
                    )
                    card_results = model.get("results", []) or payload.get(
                        "results", []
                    )
                    for item in card_results:
                        if not isinstance(item, dict):
                            continue
                        job_key = str(
                            item.get("jobkey") or item.get("jobKey") or ""
                        ).strip()
                        url = (
                            f"https://au.indeed.com/viewjob?jk={job_key}"
                            if job_key
                            else str(item.get("viewJobLink") or "")
                        )
                        title = str(
                            item.get("displayTitle") or item.get("title") or ""
                        ).strip()
                        company = str(
                            item.get("company") or item.get("truncatedCompany") or ""
                        ).strip()
                        location = str(item.get("formattedLocation") or "").strip()
                        snippet = str(
                            item.get("snippet") or item.get("jobDescription") or ""
                        ).strip()
                        is_remote = (
                            bool(item.get("remoteLocation"))
                            or "remote" in f"{location} {title}".lower()
                        )
                        salary_text = ""
                        sal_snip = item.get("salarySnippet")
                        if isinstance(sal_snip, dict):
                            salary_text = str(sal_snip.get("text") or "")

                        if title and (url or job_key):
                            results.append(
                                {
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
                                }
                            )
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


class CloudflareChallengeError(Exception):
    """Raised when an HTTP request is blocked by Cloudflare Turnstile or WAF challenge (403/503)."""

    def __init__(self, domain: str, status_code: int = 403, detail: str = ""):
        self.domain = domain
        self.status_code = status_code
        self.detail = detail
        super().__init__(
            f"Cloudflare challenge or anti-bot block on {domain} (HTTP {status_code}): {detail}"
        )


class RateLimitBlockedError(Exception):
    """Raised when an HTTP request is rate-limited (HTTP 429)."""

    def __init__(self, domain: str, retry_after: int = 60):
        self.domain = domain
        self.retry_after = retry_after
        super().__init__(
            f"Rate limit exceeded on {domain} (HTTP 429). Retry after {retry_after}s"
        )


# Authentic desktop browser profiles with aligned Client Hints and User-Agents
BROWSER_PROFILES = [
    {
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "sec_ch_ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        "sec_ch_ua_mobile": "?0",
        "sec_ch_ua_platform": '"Windows"',
    },
    {
        "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "sec_ch_ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        "sec_ch_ua_mobile": "?0",
        "sec_ch_ua_platform": '"macOS"',
    },
    {
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        "sec_ch_ua": '"Chromium";v="127", "Not;A=Brand";v="24", "Google Chrome";v="127"',
        "sec_ch_ua_mobile": "?0",
        "sec_ch_ua_platform": '"Windows"',
    },
]


def get_stealth_headers(
    domain: str | None = None,
    as_xhr: bool = False,
    profile_index: int | None = None,
) -> dict[str, str]:
    """Generates authentic browser headers with Client Hints to bypass Cloudflare/WAF 403 blocks.

    Ensures that sec-ch-ua, sec-ch-ua-platform, and user-agent match 100% to defeat
    modern TLS/HTTP fingerprinting and WAF heuristics.
    """
    if profile_index is not None and 0 <= profile_index < len(BROWSER_PROFILES):
        profile = BROWSER_PROFILES[profile_index]
    else:
        profile = random.choice(BROWSER_PROFILES)

    headers = {
        "User-Agent": profile["user_agent"],
        "sec-ch-ua": profile["sec_ch_ua"],
        "sec-ch-ua-mobile": profile["sec_ch_ua_mobile"],
        "sec-ch-ua-platform": profile["sec_ch_ua_platform"],
        "Accept-Language": "en-AU,en-US;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "DNT": "1",
        "Connection": "keep-alive",
    }

    if as_xhr:
        headers.update(
            {
                "Accept": "application/json, text/plain, */*",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
            }
        )
    else:
        headers.update(
            {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "none",
                "sec-fetch-user": "?1",
                "Upgrade-Insecure-Requests": "1",
            }
        )

    if domain:
        clean_domain = (
            domain.lower().replace("https://", "").replace("http://", "").split("/")[0]
        )
        headers["Host"] = clean_domain
        headers["Referer"] = f"https://{clean_domain}/"

    return headers


class DomainCooldownTracker:
    """Thread-safe cooldown tracker for domains that returned 403 or challenge pages.

    Prevents hammering blocked domains, avoiding IP blacklisting while giving
    anti-bot systems time to reset rate-limit thresholds.
    """

    def __init__(self, default_cooldown_secs: float = 300.0):
        self.default_cooldown_secs = default_cooldown_secs
        self._cooldowns: dict[str, float] = {}
        self._lock = threading.Lock()

    def mark_blocked(self, domain: str, cooldown_secs: float | None = None) -> None:
        """Mark a domain as blocked with an expiry timestamp."""
        duration = (
            cooldown_secs if cooldown_secs is not None else self.default_cooldown_secs
        )
        expiry = time.time() + duration
        clean = domain.lower().split("/")[0]
        with self._lock:
            self._cooldowns[clean] = expiry
        logger.warning(
            f"Anti-403: domain '{clean}' placed on {duration:.0f}s cooldown until {time.strftime('%H:%M:%S', time.localtime(expiry))}"
        )

    def is_cooldown_active(self, domain: str) -> bool:
        """Check if a domain is currently in an active cooldown."""
        clean = domain.lower().split("/")[0]
        now = time.time()
        with self._lock:
            expiry = self._cooldowns.get(clean)
            if expiry is None:
                return False
            if now >= expiry:
                del self._cooldowns[clean]
                return False
            return True

    def get_remaining_cooldown(self, domain: str) -> float:
        """Return remaining seconds of cooldown for a domain, or 0.0 if not blocked."""
        clean = domain.lower().split("/")[0]
        now = time.time()
        with self._lock:
            expiry = self._cooldowns.get(clean)
            if expiry and expiry > now:
                return expiry - now
            return 0.0

    def clear(self) -> None:
        with self._lock:
            self._cooldowns.clear()


# Global singleton domain cooldown manager
domain_cooldown_tracker = DomainCooldownTracker()


class ResilientScrapeSession:
    """A resilient HTTP session designed to minimize 403 Forbidden errors.

    Features:
    1. Persistent cookie jar across requests (preserves Cloudflare/WAF session cookies).
    2. Automatic Client Hints and browser headers matching real Chromium.
    3. Randomized polite jitter delays to prevent burst rate-limit triggers.
    4. Cloudflare / Turnstile challenge page detection.
    5. Automatic domain cooldown marking on 403.
    """

    def __init__(
        self,
        domain: str | None = None,
        timeout: float = 15.0,
        min_jitter: float = 1.0,
        max_jitter: float = 2.5,
        proxy: str | None = None,
    ):
        self.domain = domain
        self.timeout = timeout
        self.min_jitter = min_jitter
        self.max_jitter = max_jitter
        self.proxy = proxy
        self.session = requests.Session()

        # Mount retrying adapter for transient network blips
        retries = Retry(
            total=2,
            backoff_factor=1.0,
            status_forcelist=[500, 502, 503, 504],
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retries, pool_connections=5, pool_maxsize=10)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

        if proxy:
            self.session.proxies = {"http": proxy, "https": proxy}

    def _apply_jitter(self) -> None:
        if self.min_jitter > 0 and self.max_jitter >= self.min_jitter:
            delay = random.uniform(self.min_jitter, self.max_jitter)
            time.sleep(delay)

    def get(
        self,
        url: str,
        params: dict[str, Any] | None = None,
        as_xhr: bool = False,
        headers: dict[str, str] | None = None,
        apply_jitter: bool = True,
    ) -> requests.Response:
        """Execute an HTTP GET request with anti-403 defenses."""
        parsed = urlparse(url)
        domain = parsed.netloc or self.domain or ""

        # Check cooldown
        if domain and domain_cooldown_tracker.is_cooldown_active(domain):
            remaining = domain_cooldown_tracker.get_remaining_cooldown(domain)
            raise CloudflareChallengeError(
                domain,
                403,
                f"Domain is on active cooldown ({remaining:.1f}s remaining)",
            )

        if apply_jitter:
            self._apply_jitter()

        req_headers = get_stealth_headers(domain=domain, as_xhr=as_xhr)
        if headers:
            req_headers.update(headers)

        try:
            resp = self.session.get(
                url,
                params=params,
                headers=req_headers,
                timeout=self.timeout,
                allow_redirects=True,
            )
        except requests.exceptions.RequestException as req_err:
            logger.warning(f"Resilient request error for {url}: {req_err}")
            raise

        # Anti-bot detection checks
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 60))
            if domain:
                domain_cooldown_tracker.mark_blocked(
                    domain, cooldown_secs=float(retry_after)
                )
            raise RateLimitBlockedError(domain, retry_after)

        text_lower = resp.text[:4000].lower() if resp.text else ""
        is_cf_challenge = (
            resp.status_code == 403
            or "just a moment..." in text_lower
            or "cf-turnstile" in text_lower
            or "challenges.cloudflare.com" in text_lower
            or "attention required! | cloudflare" in text_lower
        )

        if is_cf_challenge:
            if domain:
                domain_cooldown_tracker.mark_blocked(domain, cooldown_secs=300.0)
            raise CloudflareChallengeError(
                domain,
                resp.status_code,
                "Cloudflare anti-bot challenge or Turnstile verification intercepted request",
            )

        return resp
