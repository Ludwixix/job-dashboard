import json
from pathlib import Path
from typing import Any

from .models import ApplicationRecord


def split_documents(content: str) -> tuple[str, str, str]:
    """Split generated output into resume, cover letter, and embedded description."""
    marker = "===COVER_LETTER==="
    resume, separator, cover = content.partition(marker)
    if not separator:
        return content.strip(), "", ""
    description_marker = "===JOB_DESCRIPTION==="
    cover, description_separator, description = cover.partition(description_marker)
    return resume.strip(), cover.strip(), description.strip() if description_separator else ""


class ApplicationIndex:
    """Small JSON-backed repository for application-pack metadata."""

    def __init__(self, path: str | Path):
        self.path = Path(path)

    def load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"roles": []}
        return json.loads(self.path.read_text(encoding="utf-8"))

    def upsert(self, record: ApplicationRecord) -> dict[str, Any]:
        index = self.load()
        roles = index.setdefault("roles", [])
        entry = record.as_dict()
        for position, current in enumerate(roles):
            if current.get("application_id") == record.application_id:
                roles[position] = entry
                break
        else:
            roles.append(entry)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        return entry
