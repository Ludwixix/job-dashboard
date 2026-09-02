import json

from job_dashboard.seek_cache_ingest import ingest


def test_seek_cache_ingest_atomically_writes_only_verified_recent_listings(tmp_path):
    input_path = tmp_path / "export.json"
    output_path = tmp_path / "data" / "seek_cache.json"
    input_path.write_text(json.dumps({"jobs": [
        {"id": "fresh", "title": "Nurse", "company": "Health Co", "url": "https://seek.test/fresh", "description": "Patient care", "posted": "3d ago"},
        {"id": "featured", "title": "Nurse", "company": "Health Co", "url": "https://seek.test/featured", "description": "Patient care", "posted": "Featured"},
        {"id": "old", "title": "Nurse", "company": "Health Co", "url": "https://seek.test/old", "description": "Patient care", "posted": "20d ago"},
    ]}))

    assert ingest(input_path, output_path) == 1
    payload = json.loads(output_path.read_text())
    assert payload["count"] == 1
    assert payload["jobs"][0]["id"] == "fresh"