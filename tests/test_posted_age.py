from datetime import datetime, timezone

from job_dashboard.sources import posted_age


def test_posted_age_labels():
    now = datetime(2026, 8, 25, tzinfo=timezone.utc)
    assert posted_age("2026-08-25", now) == "Posted today"
    assert posted_age("2026-08-24", now) == "Posted yesterday"
    assert posted_age("2026-08-20", now) == "Posted 5 days ago"
    assert posted_age("", now) == "Posting date unavailable"
