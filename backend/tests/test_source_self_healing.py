"""Unit tests for Scraper Source Health Diagnostic & Autonomous Self-Healing."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from job_dashboard.sources.base import SearchQuery
from job_dashboard.sources.self_healing import (
    apply_and_verify_patch,
    diagnose_source,
    get_source_code_context,
    remediate_runtime,
)


class MockApp:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.sources = []
        self.health_check = MagicMock()
        self.repository = MagicMock()
        self.repository.get_provider_cookies.return_value = {}
        self.source_health = {
            "Seek": {
                "jobs": 15,
                "queries": 2,
                "success": True,
                "last_success": "2026-09-18T00:00:00Z",
                "last_error": "",
            },
            "Indeed": {
                "jobs": 0,
                "queries": 1,
                "success": False,
                "last_error": "Cloudflare 403 Forbidden: Turnstile challenge",
            },
            "Adzuna": {
                "jobs": 8,
                "queries": 1,
                "success": True,
                "last_success": "2026-09-18T00:00:00Z",
                "last_error": "",
            },
            "RemoteOK": {
                "jobs": 5,
                "queries": 1,
                "success": True,
                "last_success": "2026-09-18T00:00:00Z",
                "last_error": "",
            },
        }


def test_diagnose_source_healthy_probe(tmp_path):
    app = MockApp(tmp_path)
    mock_source = MagicMock()
    mock_source.name = "Seek"
    mock_source.search.return_value = [
        {"title": "Software Engineer", "company": "Tech Corp"}
    ]
    app.sources = [mock_source]

    diagnosis = diagnose_source("Seek", app, probe_query="Software Engineer")

    assert diagnosis["success"] is True
    assert diagnosis["status"] == "healthy"
    assert diagnosis["jobs_found"] == 1
    assert diagnosis["duration_ms"] >= 0
    assert diagnosis["error"] == ""
    assert diagnosis["error_category"] == "NONE"


def test_diagnose_source_unhealthy_categorization(tmp_path):
    app = MockApp(tmp_path)
    mock_source = MagicMock()
    mock_source.name = "Indeed"
    mock_source.search.side_effect = Exception(
        "HTTP 403 Forbidden: Cloudflare anti-bot verification challenge"
    )
    app.sources = [mock_source]

    diagnosis = diagnose_source("Indeed", app, probe_query="Engineer")

    assert diagnosis["success"] is False
    assert diagnosis["status"] == "unhealthy"
    assert diagnosis["jobs_found"] == 0
    assert "403 Forbidden" in diagnosis["error"]
    assert diagnosis["error_category"] == "BOT_BLOCKED"
    assert diagnosis["recommended_action"] == "ACTIVATE_STEALTH_BROWSER_OR_FALLBACK"


def test_remediate_runtime_seek_tier_escalation(tmp_path):
    app = MockApp(tmp_path)
    mock_seek = MagicMock()
    mock_seek.name = "Seek"
    mock_seek.allow_browser_fallback = False
    mock_seek.allow_cache_fallback = False
    # Post-remediation probe recovers jobs after tiers are escalated
    mock_seek.search.return_value = [{"title": "Recovered Job via Browser Fallback"}]
    app.sources = [mock_seek]

    diagnosis = {
        "status": "unhealthy",
        "error": "Chalice API 403",
        "error_category": "BOT_BLOCKED",
    }

    remediation = remediate_runtime("Seek", app, diagnosis)

    assert remediation["success"] is True
    assert remediation["remedied"] is True
    assert remediation["action_taken"] == "ESCALATED_FALLBACK_TIERS"
    assert mock_seek.allow_browser_fallback is True
    assert mock_seek.allow_cache_fallback is True
    assert remediation["post_health"]["status"] == "healthy"


def test_get_source_code_context():
    context = get_source_code_context("Seek")

    assert context["success"] is True
    assert context["source_name"] == "Seek"
    assert "seek.py" in context["file_path"]
    assert len(context["code_snippet"]) > 100
    assert "LLM Repair Prompt" in context["llm_prompt"]
    assert (
        "Chalice" in context["code_snippet"]
        or "SeekApiSource" in context["code_snippet"]
    )


def test_apply_and_verify_patch_syntax_validation(tmp_path):
    dummy_source = tmp_path / "dummy_source.py"
    dummy_source.write_text("def test_func():\n    return 42\n", encoding="utf-8")

    # Invalid Python syntax (missing colon)
    invalid_patch = "def broken_func(\n    return 0\n"

    result = apply_and_verify_patch(
        source_name="Dummy",
        target_file_path=dummy_source,
        patch_code=invalid_patch,
        test_command="echo 'skip'",
    )

    assert result["success"] is False
    assert "SyntaxError" in result["error"]
    # Ensure original file was untouched
    assert (
        dummy_source.read_text(encoding="utf-8") == "def test_func():\n    return 42\n"
    )


def test_apply_and_verify_patch_test_failure_triggers_rollback(tmp_path):
    dummy_source = tmp_path / "dummy_source.py"
    original_code = "def calc():\n    return 100\n"
    dummy_source.write_text(original_code, encoding="utf-8")

    # Syntactically valid code that causes tests to fail
    modified_code = "def calc():\n    return 200\n"

    # Command that exits with non-zero code to simulate failed pytest
    failing_test_cmd = "python3 -c 'import sys; sys.exit(1)'"

    result = apply_and_verify_patch(
        source_name="Dummy",
        target_file_path=dummy_source,
        patch_code=modified_code,
        test_command=failing_test_cmd,
    )

    assert result["success"] is False
    assert result["rolled_back"] is True
    assert "Tests failed" in result["error"]
    # Original file must be restored
    assert dummy_source.read_text(encoding="utf-8") == original_code


def test_web_api_source_health_endpoints(tmp_path):
    from io import BytesIO
    from job_dashboard.web import DashboardApp, make_handler

    mock_source = MagicMock()
    mock_source.name = "Seek"
    mock_source.search.return_value = [
        {"title": "Cloud Engineer", "company": "Atlassian"}
    ]

    app = DashboardApp({}, [mock_source], tmp_path)
    app.sync_tracker = lambda: None
    handler_class = make_handler(app)

    # 1. Test GET /api/sources/health
    handler = handler_class.__new__(handler_class)
    handler.path = "/api/sources/health"
    sent_data = {}

    def mock_send_json(status, payload):
        sent_data["status"] = status
        sent_data["payload"] = payload

    handler.send_json = mock_send_json
    handler.do_GET()

    assert sent_data["status"] == 200
    assert sent_data["payload"]["success"] is True
    assert len(sent_data["payload"]["sources"]) >= 1
    assert sent_data["payload"]["sources"][0]["name"] == "Seek"

    # 2. Test POST /api/sources/diagnose
    handler.path = "/api/sources/diagnose"
    body = json.dumps({"source": "Seek", "query": "Cloud Engineer"}).encode("utf-8")
    handler.headers = {"Content-Length": str(len(body))}
    handler.rfile = BytesIO(body)

    handler.do_POST()

    assert sent_data["status"] == 200
    assert sent_data["payload"]["success"] is True
    assert sent_data["payload"]["jobs_found"] == 1
    assert sent_data["payload"]["status"] == "healthy"

    # 3. Test POST /api/sources/llm-repair-context
    handler.path = "/api/sources/llm-repair-context"
    body = json.dumps({"source": "Seek", "error": "Chalice API 403"}).encode("utf-8")
    handler.headers = {"Content-Length": str(len(body))}
    handler.rfile = BytesIO(body)

    handler.do_POST()

    assert sent_data["status"] == 200
    assert sent_data["payload"]["success"] is True
    assert "LLM Repair Prompt" in sent_data["payload"]["llm_prompt"]
