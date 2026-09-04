from __future__ import annotations

import json
import urllib.request
from collections.abc import Iterable, Mapping
from typing import Any

from .base import SearchQuery, canonical_posted_date, clean_description


class RemoteOkApiSource:
    name = "RemoteOK"
    endpoint = "https://remoteok.com/api"

    def __init__(self, timeout: float = 20.0):
        self.timeout = timeout

    def search(self, query: SearchQuery) -> Iterable[Mapping[str, Any]]:
        request = urllib.request.Request(
            self.endpoint,
            headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))

        if isinstance(payload, dict):
            items = payload.get("jobs", []) or payload.get("results", [])
        else:
            items = payload

        for item in items:
            if not isinstance(item, Mapping):
                continue
            haystack = " ".join([
                str(item.get("position") or item.get("title") or ""),
                str(item.get("company") or ""),
                str(item.get("description") or ""),
                str(item.get("location") or ""),
            ]).lower()
            if query.term.lower() not in haystack.lower():
                continue
            yield _remoteok_record(item, query)


def _remoteok_record(job: Mapping[str, Any], query: SearchQuery) -> dict[str, Any]:
    title = str(job.get("position") or job.get("title") or "").strip()
    company = str(job.get("company") or "").strip()
    location = str(job.get("location") or "Remote").strip() or "Remote"
    url = str(job.get("url") or "").strip() or f"https://remoteok.com/remote-jobs/{job.get('slug', '')}"
    description = clean_description(job.get("description", ""))
    posted = str(job.get("published_at") or "").strip()
    remote_value = "remote" in location.lower() or "remote" in f"{title} {description}".lower()
    return {
        "id": str(job.get("id") or url or title),
        "title": title,
        "company": company,
        "location": location,
        "description": description,
        "url": url,
        "source": "RemoteOK",
        "posted": canonical_posted_date(posted),
        "remote": remote_value,
        "tags": [query.term, "remoteok", query.stream],
        "application_route": url,
        "salary": str(job.get("salary") or "").strip(),
    }
