import re
from collections import defaultdict
from collections.abc import Iterable

from .models import Job

_STREAM_PATTERNS = {
    "core-it": (r"cloud|devops|systems?|network|infrastructure|azure|m365|entra|intune|powershell|service.?desk|help.?desk|software|data|security|engineer|developer|architect|analyst",),
    "bridge": (r"barista|waiter|chef|cleaner|warehouse|retail|cashier|courier|driver|casual|part.?time|general.?hand",),
    "traineeship": (r"trainee|traineeship|apprentice|cabling|fibre|telecom|data.?cent(re|er)|hvac|electrician|technician|nbn|racking",),
}
_BRIDGE_EXCLUSIONS = re.compile(r"officer|manager|senior|lead|director|engineer|analyst|architect|consultant", re.IGNORECASE)


def _matches(text: str, patterns: tuple[str, ...]) -> int:
    return sum(bool(re.search(pattern, text, re.IGNORECASE)) for pattern in patterns)


def classify_job(job: Job) -> str:
    """Assign a job to the dashboard's three employment streams."""
    text = job.text()
    scores = {stream: _matches(text, patterns) for stream, patterns in _STREAM_PATTERNS.items()}
    title = job.title
    if scores["traineeship"] and re.search(r"trainee|apprentice|cabling|fibre|hvac|nbn", title, re.IGNORECASE):
        return "traineeship"
    if scores["bridge"] and not _BRIDGE_EXCLUSIONS.search(title):
        return "bridge"
    if max(scores.values(), default=0) == 0:
        return "core-it"
    return max(scores, key=scores.get)


def classify_jobs(jobs: Iterable[Job]) -> dict[str, list[Job]]:
    streams: dict[str, list[Job]] = defaultdict(list)
    for job in jobs:
        streams[classify_job(job)].append(job)
    return {stream: streams[stream] for stream in _STREAM_PATTERNS}
