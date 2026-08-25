import hashlib
import json
from collections.abc import Mapping
from typing import Any

from .models import Job


def normalize_job(raw: Mapping[str, Any]) -> Job:
    """Convert a source listing into the stable internal job contract."""
    title = str(raw.get("title") or "").strip()
    company = str(raw.get("company") or "").strip()
    location = str(raw.get("location") or "").strip()
    tags = raw.get("tags") or ()
    if isinstance(tags, str):
        tags = (tags,)
    else:
        tags = tuple(str(tag).strip() for tag in tags if str(tag).strip())

    source_id = raw.get("id") or raw.get("job_id")
    if source_id:
        job_id = str(source_id)
    else:
        identity = json.dumps([title, company, location, raw.get("url", "")], sort_keys=True)
        job_id = hashlib.sha256(identity.encode()).hexdigest()[:16]

    return Job(
        id=job_id,
        title=title,
        company=company,
        location=location,
        description=str(raw.get("description") or "").strip(),
        why=str(raw.get("why") or "").strip(),
        tags=tags,
        remote=bool(raw.get("remote", False)),
        source=str(raw.get("source") or "").strip(),
        url=str(raw.get("url") or raw.get("application_url") or "").strip(),
        subcategory=str(raw.get("subcategory") or "").strip(),
    )
