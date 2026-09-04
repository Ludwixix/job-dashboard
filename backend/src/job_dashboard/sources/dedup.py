from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from typing import Any

_TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "msclkid", "ref", "source", "spm", "from", "xptdk",
    "cmpid", "fromage", "pub", "vsk",
}


def _normalize_company_name(name: Any) -> str:
    s = str(name or "").lower().strip()
    s = re.sub(r"\b(pty|ltd|limited|inc|corporation|corp|australia|group|services|technologies|solutions|holdings)\b", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


def _normalize_job_title(title: Any) -> str:
    s = str(title or "").lower().strip()
    s = re.sub(r"[\(\[\{][^\)\]\}]*[\)\]\}]", "", s)
    s = re.sub(r"\b(immediate start|urgent|urgent:?|contract|permanent|full time|part time|temp|hybrid|remote)\b", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


def _clean_job_url(url: Any) -> str:
    s = str(url or "").strip().rstrip("/")
    if "#" in s:
        s = s.split("#")[0]
    if "?" in s:
        base, _, qs = s.partition("?")
        kept = [kv for kv in qs.split("&") if kv and kv.split("=")[0].lower() not in _TRACKING_PARAMS]
        s = base + ("?" + "&".join(kept) if kept else "")
    return s.rstrip("/?")


def deduplicate_jobs(jobs: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Deduplicate by clean URL and normalized company/title."""
    priority = {"LinkedIn": 0, "Seek": 1, "Indeed": 2, "Adzuna": 3}
    ordered = sorted(jobs, key=lambda job: priority.get(str(job.get("source", "")), 99))
    seen_urls: set[str] = set()
    seen_keys: dict[tuple[str, str, str], dict[str, Any]] = {}
    result: list[dict[str, Any]] = []
    
    for raw in ordered:
        job = dict(raw)
        raw_url = str(job.get("url") or job.get("application_route") or "")
        url = _clean_job_url(raw_url)
        
        comp_norm = _normalize_company_name(job.get("company", ""))
        title_norm = _normalize_job_title(job.get("title", ""))
        loc_norm = re.sub(r"[^a-z0-9]", "", str(job.get("location", "")).lower().strip())
        key = (comp_norm, title_norm, loc_norm)
        
        duplicate_key = comp_norm != "" and title_norm != "" and key in seen_keys
        duplicate_url = bool(url and url in seen_urls)
        
        if duplicate_url or duplicate_key:
            existing = seen_keys.get(key)
            if existing is not None:
                existing["tags"] = sorted(set(existing.get("tags", [])) | set(job.get("tags", [])))
                # Prefer longer and cleaner description
                if len(str(job.get("description", ""))) > len(str(existing.get("description", ""))):
                    existing["description"] = job.get("description", "")
            continue
            
        if url:
            seen_urls.add(url)
        if comp_norm and title_norm:
            seen_keys[key] = job
        result.append(job)
        
    return result
