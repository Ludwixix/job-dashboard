from datetime import datetime, timezone
from job_dashboard.sources import ScrapePipeline, SearchQuery


class BrokenSource:
    name = "Broken"

    def search(self, query):
        raise RuntimeError("provider unavailable")


def test_one_provider_failure_does_not_abort_pipeline():
    pipeline = ScrapePipeline([BrokenSource()], days=14)
    assert pipeline.run([SearchQuery("cloud")]) == []
    assert pipeline.errors == ["Broken / cloud: provider unavailable"]


def test_public_jobs_hides_non_new_jobs_by_default(tmp_path):
    from job_dashboard.web import DashboardApp

    app = DashboardApp({}, [], tmp_path)
    app.sync_tracker = lambda: None
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    app.jobs = [
        {
            "id": "new",
            "title": "New Role",
            "company": "Acme",
            "description": "Cloud",
            "posted": today,
            "url": "https://example.test/new",
        },
        {
            "id": "applied",
            "title": "Applied Role",
            "company": "Acme",
            "description": "Cloud",
            "posted": today,
            "url": "https://example.test/applied",
        },
    ]
    app.jobs = app.materialize_jobs(app.jobs)
    app.repository.replace_jobs(app.jobs)
    app.repository.update_status("applied", "applied")

    assert [job["id"] for job in app.public_jobs()] == ["new"]
    assert [job["id"] for job in app.public_jobs({"status": "applied"})] == ["applied"]


def test_refresh_handles_empty_body_cleanly(tmp_path):
    from io import BytesIO
    from job_dashboard.web import DashboardApp, make_handler

    app = DashboardApp({}, [], tmp_path)
    app.sync_tracker = lambda: None
    handler_class = make_handler(app)

    # Mock request handler
    handler = handler_class.__new__(handler_class)
    handler.path = "/api/refresh"
    handler.headers = {"Content-Length": "0"}
    handler.rfile = BytesIO(b"")

    sent_response = {}

    def mock_send_json(status, data):
        sent_response["status"] = status
        sent_response["data"] = data

    handler.send_json = mock_send_json

    # Should not raise JSONDecodeError
    handler.do_POST()
    assert sent_response["status"] == 200
    assert sent_response["data"]["success"] is True


def test_head_request_health_and_root(tmp_path):
    from job_dashboard.web import DashboardApp, make_handler

    app = DashboardApp({}, [], tmp_path)
    handler_class = make_handler(app)
    handler = handler_class.__new__(handler_class)
    handler.path = "/health"
    handler.headers = {}

    responses = []
    headers = {}
    handler.send_response = lambda code: responses.append(code)
    handler.send_header = lambda k, v: headers.update({k: v})
    handler._send_cors_headers = lambda: None
    handler.end_headers = lambda: None

    handler.do_HEAD()
    assert responses == [200]
    assert headers.get("Content-Type") == "application/json"


def test_refresh_with_profile_queries_and_force(tmp_path, monkeypatch):
    import json
    from io import BytesIO
    from job_dashboard.web import DashboardApp, make_handler

    monkeypatch.setenv("MOCK_SCRAPERS", "true")

    app = DashboardApp({}, [], tmp_path)
    app.sync_tracker = lambda: None
    handler_class = make_handler(app)

    handler = handler_class.__new__(handler_class)
    handler.path = "/api/refresh"

    payload = {
        "queries": [
            {
                "term": "Cloud Systems Engineer",
                "location": "Balaclava, VIC",
                "stream": "core",
                "weight": 1.5,
            }
        ],
        "force": True,
        "ttl_hours": 0.0,
    }
    raw_body = json.dumps(payload).encode("utf-8")
    handler.headers = {"Content-Length": str(len(raw_body))}
    handler.rfile = BytesIO(raw_body)

    sent_response = {}

    def mock_send_json(status, data):
        sent_response["status"] = status
        sent_response["data"] = data

    handler.send_json = mock_send_json

    handler.do_POST()
    assert sent_response["status"] == 200
    assert "jobs" in sent_response["data"]
    assert "cache_stats" in sent_response["data"]
    assert sent_response["data"]["cache_stats"]["cache_hit"] is False
    assert len(sent_response["data"]["jobs"]) > 0
