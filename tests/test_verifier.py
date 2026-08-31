import pytest
from job_dashboard.verifier import verify_job_url, verify_job_urls

def test_verify_invalid_url():
    res = verify_job_url("")
    assert res["is_valid"] is False
    assert res["is_expired"] is True

def test_verify_non_http_url():
    res = verify_job_url("ftp://example.com/job")
    assert res["is_valid"] is False
    assert res["is_expired"] is True

def test_verify_batch():
    res = verify_job_urls(["https://invalid.domain.example.nonexistent/job/123", "not-a-url"])
    assert len(res) == 2
