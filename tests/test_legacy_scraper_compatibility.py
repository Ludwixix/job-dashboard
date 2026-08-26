import json
from pathlib import Path

import pytest

from job_dashboard.normalize import normalize_job


LEGACY_SCRAPERS = Path("/home/s/.openclaw/workspace/job-dashboard-site/scrapers")
LEGACY_OUTPUTS = tuple(sorted(LEGACY_SCRAPERS.glob("jobs_*.json")))


@pytest.mark.parametrize("output_path", LEGACY_OUTPUTS, ids=lambda path: path.name)
def test_legacy_scraper_records_normalize_to_job(output_path: Path):
    payload = json.loads(output_path.read_text())
    records = payload.get("jobs", payload) if isinstance(payload, dict) else payload
    if not records:
        pytest.skip("legacy output contains no job records")

    job = normalize_job(records[0])

    assert job.id
    assert job.title
    assert job.company
    assert job.url
    assert job.source
    assert isinstance(job.tags, tuple)
    assert isinstance(job.remote, bool)


def test_legacy_scraper_directory_is_available():
    if not LEGACY_SCRAPERS.exists():
        pytest.skip("legacy scraper folder is not available in this environment")
    assert LEGACY_OUTPUTS
