import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any


def load_profile(path: str | Path) -> dict[str, Any]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    profile = data.get("profile", data)
    skills: dict[str, str] = {}
    for values in profile.get("technical_expertise", {}).values():
        for skill in values:
            skills[str(skill).lower()] = "intermediate"
    skills.update({str(skill).lower(): "expert" for skill in profile.get("skills", [])})
    return {**profile, "skills": skills}


def profile_name(profile: Mapping[str, Any]) -> str:
    return str(profile.get("personal", {}).get("full_name", "Candidate"))
