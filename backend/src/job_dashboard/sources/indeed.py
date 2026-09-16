from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from collections.abc import Iterable, Mapping
from typing import Any

from ..logging import get_logger
from ..models import JobRecord
from .base import (
    SearchQuery,
    canonical_posted_date,
    clean_description,
    estimate_salary_bracket,
    parse_salary_bracket,
    resolve_search_location,
    sanitize_html,
)
from .browser import BotBlockedError, create_stealth_browser, is_challenge_page, wait_for_challenge_clearance
from .proxy import ProxyRotator
from .resilience import (
    ADAPTIVE_BROWSER_EXTRACTOR_JS,
    extract_embedded_state_jobs,
    extract_from_json_ld,
)

logger = get_logger("job_dashboard.sources.indeed")


class IndeedJobSpySource:
    name = "Indeed"

    def __init__(
        self,
        results_wanted: int = 25,
        hours_old: int = 336,
        html_fallback: bool = True,
        browser_fallback: bool = False,
        multi_board: bool = False,
        timeout: float = 15.0,
        proxy: str | None = None,
    ):
        self.results_wanted = results_wanted
        self.hours_old = hours_old
        self.html_fallback = html_fallback
        self.browser_fallback = browser_fallback
        self.multi_board = multi_board
        self.timeout = timeout
        self.proxy_rotator = ProxyRotator([proxy] if proxy else None)

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        # Tier 1: JobSpy Scraper
        try:
            records = list(self._search_jobspy(query))
            if records:
                return iter(records)
        except Exception as error:
            logger.warning(f"Indeed JobSpy scraper failed for {query.term}: {error}")

        # Tier 2: Direct Mobile GraphQL Gateway (Resilient to Cloudflare & DOM changes)
        try:
            gql_records = list(self._search_graphql(query))
            if gql_records:
                logger.info(f"Indeed mobile GraphQL gateway recovered {len(gql_records)} jobs for {query.term}")
                return iter(gql_records)
        except Exception as gql_err:
            logger.warning(f"Indeed mobile GraphQL gateway failed for {query.term}: {gql_err}")

        # Tier 3: Public Embedded JSON & Adaptive Structured State
        if self.html_fallback:
            try:
                fallback = list(self._search_embedded_json(query))
                if fallback:
                    logger.info(f"Indeed structured JSON fallback recovered {len(fallback)} jobs for {query.term}")
                    return iter(fallback)
            except Exception as fallback_error:
                logger.warning(f"Indeed structured JSON fallback failed for {query.term}: {fallback_error}")

        # Tier 4: Stealth Playwright Browser Fallback with Adaptive DOM Extractor
        if self.browser_fallback:
            try:
                browser_jobs = list(self._search_browser(query))
                if browser_jobs:
                    logger.info(f"Indeed stealth browser fallback recovered {len(browser_jobs)} jobs for {query.term}")
                    return iter(browser_jobs)
            except Exception as browser_error:
                logger.warning(f"Indeed stealth browser fallback failed for {query.term}: {browser_error}")

        return iter(())

    def _search_graphql(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        """Direct Indeed Mobile GraphQL Gateway request with resilient error recovery.
        Uses Indeed's official mobile app GraphQL API which is immune to Cloudflare
        HTML turnstile challenges and DOM changes.
        """
        loc = resolve_search_location(query)
        is_rem = (
            "remote" in query.term.lower()
            or "remote" in query.location.lower()
            or loc.lower() in ("remote", "australia", "all australia")
            or str(getattr(query, "stream", "")).lower() == "remote"
        )

        escaped_term = query.term.replace('\\', '\\\\').replace('"', '\\"')
        escaped_loc = loc.replace('\\', '\\\\').replace('"', '\\"')
        limit_val = min(100, max(25, self.results_wanted))

        gql_query = (
            'query GetJobData {\n'
            '    jobSearch(\n'
            f'        what: "{escaped_term}"\n'
            f'        location: {{where: "{escaped_loc}", radius: 50, radiusUnit: MILES}}\n'
            f'        limit: {limit_val}\n'
            '        sort: RELEVANCE\n'
            '    ) {\n'
            '        results {\n'
            '            job {\n'
            '                key\n'
            '                title\n'
            '                datePublished\n'
            '                dateOnIndeed\n'
            '                description { html }\n'
            '                location {\n'
            '                    city\n'
            '                    admin1Code\n'
            '                    formatted { short long }\n'
            '                }\n'
            '                employer { name }\n'
            '                compensation {\n'
            '                    baseSalary {\n'
            '                        unitOfWork\n'
            '                        range {\n'
            '                            ... on Range { min max }\n'
            '                        }\n'
            '                    }\n'
            '                }\n'
            '                recruit { viewJobUrl }\n'
            '            }\n'
            '        }\n'
            '    }\n'
            '}'
        )

        headers = {
            "Host": "apis.indeed.com",
            "Content-Type": "application/json",
            "indeed-api-key": "161092c2017b5bbab13edb12461a62d5a833871e7cad6d9d475304573de67ac8",
            "accept": "application/json",
            "indeed-locale": "en-AU",
            "indeed-co": "AU",
            "accept-language": "en-AU,en;q=0.9",
            "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Indeed App 193.1",
            "indeed-app-info": "appv=193.1; appid=com.indeed.jobsearch; osv=16.6.1; os=ios; dtype=phone",
        }

        req = urllib.request.Request(
            "https://apis.indeed.com/graphql",
            data=json.dumps({"query": gql_query}).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        proxy_url = self.proxy_rotator.get_proxy()
        if proxy_url:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({"http": proxy_url, "https": proxy_url}))
            resp_ctx = opener.open(req, timeout=self.timeout)
        else:
            resp_ctx = urllib.request.urlopen(req, timeout=self.timeout)

        with resp_ctx as response:
            payload = json.loads(response.read().decode("utf-8"))

        card_results = payload.get("data", {}).get("jobSearch", {}).get("results", [])
        for item in card_results:
            job_node = item.get("job") if isinstance(item, dict) else None
            if not isinstance(job_node, dict):
                continue
            key = str(job_node.get("key") or "").strip()
            title = str(job_node.get("title") or "").strip()
            if not title:
                continue

            emp = job_node.get("employer") or {}
            comp = str(emp.get("name") or "Confidential").strip()

            loc_node = job_node.get("location") or {}
            formatted_loc = ""
            if isinstance(loc_node, dict):
                fmt = loc_node.get("formatted") or {}
                formatted_loc = str(fmt.get("long") or fmt.get("short") or loc_node.get("city") or "")
            job_loc = formatted_loc or loc

            desc_node = job_node.get("description") or {}
            desc_html = str(desc_node.get("html") or "")
            desc = clean_description(desc_html)
            if not desc:
                desc = f"{title} at {comp} in {job_loc}. Full position description and direct application available on Indeed Australia."

            min_salary, max_salary = None, None
            comp_node = job_node.get("compensation") or {}
            base_sal = comp_node.get("baseSalary") or {}
            rng = base_sal.get("range") or {}
            if isinstance(rng, dict):
                try:
                    if rng.get("min"):
                        min_salary = float(rng.get("min"))
                    if rng.get("max"):
                        max_salary = float(rng.get("max"))
                except (ValueError, TypeError):
                    pass
            bracket = parse_salary_bracket("", min_amount=min_salary, max_amount=max_salary)
            if bracket.min_amount is None and bracket.max_amount is None:
                bracket = estimate_salary_bracket(title, job_loc)

            raw_date = job_node.get("datePublished") or job_node.get("dateOnIndeed") or "today"
            url = f"https://au.indeed.com/viewjob?jk={key}" if key else ""

            is_job_remote = is_rem or "remote" in f"{job_loc} {title}".lower() or "wfh" in f"{job_loc} {title}".lower()

            if title and url:
                yield JobRecord(
                    id=f"indeed-{key}" if key else None,
                    provider_job_id=key or url,
                    provider="indeed",
                    title=title,
                    company=comp,
                    location=job_loc,
                    work_mode="remote" if is_job_remote else "onsite",
                    url=url,
                    raw_description=sanitize_html(desc),
                    key_requirements=[query.term, query.stream],
                    salary=bracket,
                    posted=canonical_posted_date(str(raw_date)),
                    remote=is_job_remote,
                )

    def _search_jobspy(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        try:
            from jobspy import scrape_jobs
        except ImportError as error:
            raise RuntimeError("Indeed requires the optional 'jobspy' dependency") from error

        proxy_url = self.proxy_rotator.get_proxy()
        proxies_arg = [proxy_url] if proxy_url else None
        sites = ["indeed"]
        if self.multi_board:
            sites.extend(["zip_recruiter", "glassdoor"])

        loc = resolve_search_location(query)
        is_rem = "remote" in query.term.lower() or "remote" in query.location.lower() or loc.lower() in ("remote", "australia", "all australia")
        results = scrape_jobs(
            site_name=sites,
            search_term=query.term,
            location=loc,
            country_indeed="australia",
            is_remote=is_rem,
            results_wanted=self.results_wanted,
            hours_old=self.hours_old,
            description_format="markdown",
            proxies=proxies_arg,
        )
        if results is not None and not results.empty:
            records = [_indeed_record(row, query) for _, row in results.iterrows()]
            valid = [r for r in records if r.get("url")]
            if valid:
                return iter(valid)
        return iter(())

    def _search_embedded_json(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        """Parse Indeed's public embedded job-card JSON without anti-bot bypasses."""
        loc = resolve_search_location(query)
        params = urllib.parse.urlencode({"q": query.term, "l": loc, "filter": 0, "start": 0})
        request = urllib.request.Request(
            f"https://au.indeed.com/jobs?{params}",
            headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-AU,en;q=0.8",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
            },
        )
        proxy_url = self.proxy_rotator.get_proxy()
        if proxy_url:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({"http": proxy_url, "https": proxy_url}))
            resp_ctx = opener.open(request, timeout=self.timeout)
        else:
            resp_ctx = urllib.request.urlopen(request, timeout=self.timeout)

        with resp_ctx as response:
            html = response.read(2_000_000).decode("utf-8", errors="replace")

        # 1. Resilient extraction from embedded state (mosaic, Redux, Next.js)
        state_jobs = extract_embedded_state_jobs(html)
        if state_jobs:
            for it in state_jobs[: self.results_wanted]:
                bracket = parse_salary_bracket(str(it.get("salary") or ""))
                if bracket.min_amount is None and bracket.max_amount is None:
                    bracket = estimate_salary_bracket(title=str(it.get("title", "")), location=str(it.get("location", "")))
                yield JobRecord(
                    id=it.get("id"),
                    provider_job_id=it.get("provider_job_id", ""),
                    provider="indeed",
                    title=str(it.get("title", "")),
                    company=str(it.get("company", "")),
                    location=str(it.get("location", "")),
                    work_mode="remote" if it.get("remote") else "onsite",
                    url=str(it.get("url", "")),
                    raw_description=sanitize_html(clean_description(str(it.get("description", "")))),
                    key_requirements=[query.term, query.stream],
                    salary=bracket,
                    posted=canonical_posted_date("today"),
                    remote=bool(it.get("remote")),
                )
            return

        # 2. Resilient extraction from standard Schema.org JSON-LD
        ld_jobs = extract_from_json_ld(html)
        if ld_jobs:
            for it in ld_jobs[: self.results_wanted]:
                bracket = parse_salary_bracket(str(it.get("salary") or ""))
                if bracket.min_amount is None and bracket.max_amount is None:
                    bracket = estimate_salary_bracket(title=str(it.get("title", "")), location=str(it.get("location", "")))
                yield JobRecord(
                    provider_job_id=str(it.get("url", "") or it.get("title", "")),
                    provider="indeed",
                    title=str(it.get("title", "")),
                    company=str(it.get("company", "")),
                    location=str(it.get("location", "")),
                    work_mode="remote" if it.get("remote") else "onsite",
                    url=str(it.get("url", "") or f"https://au.indeed.com/jobs?q={query.term}"),
                    raw_description=sanitize_html(clean_description(str(it.get("description", "")))),
                    key_requirements=[query.term, query.stream],
                    salary=bracket,
                    posted=canonical_posted_date(str(it.get("posted", "today"))),
                    remote=bool(it.get("remote")),
                )
            return

        # 3. Fallback: manual JSON marker search
        marker = 'window.mosaic.providerData["mosaic-provider-jobcards"]='
        start = html.find(marker)
        payload_text = ""
        if start >= 0:
            start += len(marker)
            payload_text = _extract_balanced_json(html, start)

        if payload_text:
            try:
                payload = json.loads(payload_text)
                model = payload.get("metaData", {}).get("mosaicProviderJobCardsModel", {})
                for item in model.get("results", [])[: self.results_wanted]:
                    if not isinstance(item, Mapping):
                        continue
                    job_key = str(item.get("jobkey") or item.get("jobKey") or "").strip()
                    url = f"https://au.indeed.com/viewjob?jk={job_key}" if job_key else str(item.get("viewJobLink") or "")
                    title = str(item.get("displayTitle") or item.get("title") or "").strip()
                    company = str(item.get("company") or item.get("truncatedCompany") or "").strip()
                    location = str(item.get("formattedLocation") or query.location).strip()
                    description = clean_description(item.get("snippet") or item.get("jobDescription") or "")
                    if not description:
                        description = f"{title} at {company} in {location}. Full position description and direct application available on Indeed Australia."
                    salary_raw = str(item.get("salarySnippet", {}).get("text") or "") if isinstance(item.get("salarySnippet"), Mapping) else ""
                    bracket = parse_salary_bracket(salary_raw)
                    if bracket.min_amount is None and bracket.max_amount is None:
                        bracket = estimate_salary_bracket(title=title, location=location)
                    is_remote = bool(item.get("remoteLocation")) or "remote" in f"{location} {title}".lower()
                    if title and url:
                        yield JobRecord(
                            id=f"indeed-{job_key}" if job_key else None,
                            provider_job_id=job_key or url or title,
                            provider="indeed",
                            title=title,
                            company=company,
                            location=location,
                            work_mode="remote" if is_remote else "onsite",
                            url=url,
                            raw_description=sanitize_html(description),
                            key_requirements=[query.term, query.stream],
                            salary=bracket,
                            posted=canonical_posted_date("today"),
                            remote=is_remote,
                        )
                return
            except Exception as e:
                logger.debug(f"Indeed structured payload parse failed: {e}")

    def _search_browser(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        """Stealth Playwright browser fallback for Indeed with adaptive DOM extraction."""
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as error:
            raise RuntimeError("Indeed browser fallback requires 'playwright'") from error

        playwright_proxy = self.proxy_rotator.get_playwright_proxy()
        with sync_playwright() as playwright:
            browser, context = create_stealth_browser(playwright, headless=True, proxy=playwright_proxy)
            page = context.new_page()
            try:
                loc = resolve_search_location(query)
                params = urllib.parse.urlencode({"q": query.term, "l": loc})
                url = f"https://au.indeed.com/jobs?{params}"
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                wait_for_challenge_clearance(page, max_wait_seconds=5.0)
                page.wait_for_timeout(2000)

                if is_challenge_page(page.title()):
                    raise BotBlockedError("Cloudflare challenge encountered on Indeed")

                # Strategy 1: Adaptive DOM Extractor (anchor discovery + container climbing)
                raw_jobs = page.evaluate(ADAPTIVE_BROWSER_EXTRACTOR_JS)
                # Strategy 2: Legacy class fallback if needed
                if not raw_jobs:
                    raw_jobs = page.evaluate(_INDEED_EXTRACTOR)

                for record in raw_jobs:
                    b_desc = clean_description(record.get("description", ""))
                    if not b_desc:
                        b_title = record.get("title", "")
                        b_comp = record.get("company", "")
                        b_loc = record.get("location", "")
                        b_desc = f"{b_title} at {b_comp} in {b_loc}. Full position description and direct application available on Indeed Australia."
                    sal_raw = str(record.get("salary") or "")
                    bracket = parse_salary_bracket(sal_raw)
                    rec_id = str(record.get("id") or "")
                    yield JobRecord(
                        id=rec_id if rec_id else None,
                        provider_job_id=rec_id.replace("indeed-", "") if rec_id else str(record.get("url", "")),
                        provider="indeed",
                        title=str(record.get("title", "")),
                        company=str(record.get("company", "")),
                        location=str(record.get("location", "")),
                        work_mode="remote" if record.get("remote") else "onsite",
                        url=str(record.get("url", "")),
                        raw_description=sanitize_html(b_desc),
                        key_requirements=[query.term, query.stream],
                        salary=bracket,
                        posted=canonical_posted_date(str(record.get("posted", "today"))),
                        remote=bool(record.get("remote")),
                    )
            finally:
                browser.close()


def _extract_balanced_json(text: str, start: int) -> str:
    """Extract a JSON object from an assignment without regex-truncating nested data."""
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
                return text[opening:index + 1]
    return ""


def _indeed_record(row: Any, query: SearchQuery) -> JobRecord:
    url = str(row.get("job_url", "") or "").strip()
    title = str(row.get("title", "") or "")
    company = str(row.get("company", "") or "")
    location = str(row.get("location", "") or query.location)
    desc = clean_description(row.get("description", ""))
    if not desc:
        desc = f"{title} at {company} in {location}. Full position description and direct application available on Indeed Australia."
    job_id = str(row.get("id", "") or "").strip()
    if not job_id and "jk=" in url:
        match = re.search(r"jk=([a-zA-Z0-9]+)", url)
        if match:
            job_id = f"indeed-{match.group(1)}"
    
    salary_raw = str(row.get("salary") or row.get("salary_source", "") or "")
    min_amount = None
    max_amount = None
    try:
        if row.get("min_amount"):
            min_amount = float(row.get("min_amount"))
        if row.get("max_amount"):
            max_amount = float(row.get("max_amount"))
    except (ValueError, TypeError):
        pass
    bracket = parse_salary_bracket(salary_raw, min_amount=min_amount, max_amount=max_amount)
    if bracket.min_amount is None and bracket.max_amount is None:
        bracket = estimate_salary_bracket(title=title, location=location)
    is_rem = bool(row.get("is_remote", False)) or "remote" in f"{location} {title}".lower() or "wfh" in f"{location} {title}".lower()
    raw_date = row.get("date_posted") or row.get("date") or ""

    return JobRecord(
        id=job_id if job_id else None,
        provider_job_id=job_id or url or title,
        provider="indeed",
        title=title,
        company=company,
        location=location,
        work_mode="remote" if is_rem else "onsite",
        url=url,
        raw_description=sanitize_html(desc),
        key_requirements=[query.term, query.stream],
        salary=bracket,
        posted=canonical_posted_date(raw_date) if raw_date else None,
        remote=is_rem,
    )


_INDEED_EXTRACTOR = """() => {
    const cards = Array.from(document.querySelectorAll('div.job_seen_beacon, td.resultContent, div.cardOutline'));
    return cards.map(card => {
        const titleEl = card.querySelector('h2.jobTitle span, a[data-jk] span, h2 a');
        const title = titleEl?.textContent.trim() || '';
        const linkEl = card.querySelector('h2.jobTitle a, a[data-jk], a[href*="/rc/clk"], a[href*="/viewjob"]');
        const rawUrl = linkEl?.getAttribute('href') || '';
        const jk = linkEl?.getAttribute('data-jk') || card.closest('[data-jk]')?.getAttribute('data-jk') || '';
        let url = '';
        if (jk) {
            url = 'https://au.indeed.com/viewjob?jk=' + jk;
        } else if (rawUrl.startsWith('http')) {
            url = rawUrl;
        } else if (rawUrl) {
            url = 'https://au.indeed.com' + rawUrl;
        }
        const company = card.querySelector('[data-testid="company-name"], span.companyName, .company_location .companyName')?.textContent.trim() || '';
        const location = card.querySelector('[data-testid="text-location"], div.companyLocation')?.textContent.trim() || '';
        const snippet = card.querySelector('.job-snippet, [data-testid="jobsnippet_footer"], .underShelfFooter')?.textContent.trim() || '';
        const salary = card.querySelector('[data-testid="attribute_snippet_testid"], .salary-snippet-container, .metadata')?.textContent.trim() || '';
        const rawDate = card.querySelector('[data-testid="myJobsStateDate"], span.date')?.textContent.trim() || '';
        return {
            id: jk ? ('indeed-' + jk) : '',
            title: title,
            company: company,
            location: location,
            description: snippet,
            url: url || '',
            salary: salary,
            posted: rawDate,
            remote: /remote|hybrid/i.test((title + ' ' + location + ' ' + snippet).toLowerCase())
        };
    }).filter(j => j.title && j.url);
}"""
