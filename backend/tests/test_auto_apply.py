import io
import json
from unittest.mock import MagicMock
import pytest

from job_dashboard.repository import JobRepository
from job_dashboard.web import make_handler, DashboardApp


@pytest.fixture
def test_app_and_handler(tmp_path):
    repo = JobRepository(str(tmp_path / "test.db"))
    app = DashboardApp(profile={}, sources=[], data_dir=tmp_path)
    app.repository = repo
    app.db = repo
    handler_cls = make_handler(app)
    return app, handler_cls


def create_mock_handler(handler_cls, method, path, body=None, headers=None):
    handler = handler_cls.__new__(handler_cls)
    handler.path = path
    headers_dict = headers.copy() if headers else {}
    if body is not None:
        payload = json.dumps(body).encode("utf-8") if isinstance(body, dict) else body.encode("utf-8")
        headers_dict["Content-Length"] = str(len(payload))
        handler.rfile = io.BytesIO(payload)
    else:
        handler.rfile = io.BytesIO()
    handler.headers = headers_dict
    handler.client_address = ("127.0.0.1", 12345)
    handler.wfile = io.BytesIO()
    handler.send_response = MagicMock()
    handler.send_header = MagicMock()
    handler.end_headers = MagicMock()
    return handler


def parse_response(handler):
    handler.wfile.seek(0)
    data = handler.wfile.read()
    if not data:
        return {}
    return json.loads(data.decode("utf-8"))


def test_auto_apply_sync_endpoint(test_app_and_handler):
    _, handler_cls = test_app_and_handler
    payload = {
        "job": {
            "title": "Senior Cloud Engineer",
            "company": "Canva",
            "source": "SEEK",
            "portalLink": "https://seek.com.au/job/123"
        },
        "profile": {
            "name": "Sam Ludwig",
            "email": "sam.ludwig@gmail.com",
            "targetSalary": "$125,000"
        }
    }

    handler = create_mock_handler(handler_cls, "POST", "/api/auto-apply", body=payload)
    handler.do_POST()

    resp = parse_response(handler)
    assert resp.get("success") is True
    result = resp.get("pipeline_result", {})
    assert result.get("status") == "dispatched"
    assert result.get("job_title") == "Senior Cloud Engineer"
    assert result.get("company") == "Canva"
    assert result.get("submitted_fields", {}).get("Target Salary") == "$125,000"
    assert "dispatch_id" in result
