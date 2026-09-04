from pathlib import Path
from job_dashboard.openapi import generate_openapi_spec, save_openapi_spec


def test_openapi_spec_structure():
    spec = generate_openapi_spec()
    assert spec["openapi"] == "3.1.0"
    assert "paths" in spec
    assert "/api/jobs" in spec["paths"]
    assert "/api/metrics/hourly" in spec["paths"]
    assert "/api/refresh" in spec["paths"]
    assert "/health" in spec["paths"]
    assert "components" in spec
    assert "schemas" in spec["components"]
    assert "Job" in spec["components"]["schemas"]
    assert "HourlyMetrics" in spec["components"]["schemas"]


def test_save_openapi_spec(tmp_path):
    target = tmp_path / "openapi.json"
    saved_path = save_openapi_spec(target)
    assert saved_path.exists()
    assert saved_path.stat().st_size > 1000
