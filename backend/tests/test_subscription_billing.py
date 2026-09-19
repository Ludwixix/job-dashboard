"""
Tests for user subscriptions, server-side AI proxy, token metering, and Stripe billing.
"""

import io
import json
import pytest
from unittest.mock import patch, MagicMock
from job_dashboard.repository import JobRepository
from job_dashboard.security import create_access_token


def test_repository_subscription_and_token_ledger(tmp_path):
    """Test repository methods for user subscriptions and token metering."""
    repo = JobRepository(tmp_path / "jobs.sqlite3")
    user_id = "user_test_123"

    # Default subscription for new user should be free with trial credits
    sub = repo.get_subscription(user_id)
    assert sub["user_id"] == user_id
    assert sub["plan_tier"] == "free"
    assert sub["status"] == "inactive"
    assert sub["trial_generations_remaining"] >= 3

    # Update to Pro subscription
    repo.save_subscription(
        user_id=user_id,
        plan_tier="pro_monthly",
        status="active",
        stripe_customer_id="cus_test_abc",
        stripe_subscription_id="sub_test_xyz",
        current_period_start="2026-09-01T00:00:00Z",
        current_period_end="2026-10-01T00:00:00Z",
        monthly_token_allowance=500000,
    )

    updated_sub = repo.get_subscription(user_id)
    assert updated_sub["plan_tier"] == "pro_monthly"
    assert updated_sub["status"] == "active"
    assert updated_sub["stripe_customer_id"] == "cus_test_abc"
    assert updated_sub["monthly_token_allowance"] == 500000

    # Record token usage
    repo.record_token_usage(
        user_id=user_id,
        prompt_tokens=3500,
        completion_tokens=1500,
        cost_usd=0.025,
    )

    usage = repo.get_token_usage(user_id)
    assert usage["total_tokens"] == 5000
    assert usage["prompt_tokens"] == 3500
    assert usage["completion_tokens"] == 1500
    assert usage["call_count"] == 1
    assert usage["allowance"] == 500000
    assert usage["remaining_tokens"] == 495000


def test_ai_proxy_requires_auth(tmp_path):
    """Test POST /api/ai/proxy rejects unauthenticated requests."""
    from job_dashboard.web import DashboardApp, make_handler

    app = DashboardApp(profile={}, sources=[], data_dir=tmp_path)
    handler_cls = make_handler(app)

    body = json.dumps({"messages": [{"role": "user", "content": "hi"}]}).encode("utf-8")
    handler = handler_cls.__new__(handler_cls)
    handler.path = "/api/ai/proxy"
    handler.headers = {"Content-Length": str(len(body))}
    handler.rfile = io.BytesIO(body)
    handler.wfile = io.BytesIO()
    handler.client_address = ("127.0.0.1", 12345)
    handler.requestline = "POST /api/ai/proxy HTTP/1.1"
    handler.request_version = "HTTP/1.1"
    handler.command = "POST"
    handler.send_response = MagicMock()
    handler.send_header = MagicMock()
    handler.end_headers = MagicMock()

    handler.do_POST()
    assert handler.send_response.call_args[0][0] in (401, 403)
    res = json.loads(handler.wfile.getvalue().decode("utf-8"))
    assert "error" in res


def test_ai_proxy_success_with_active_subscription(tmp_path):
    """Test POST /api/ai/proxy succeeds for active subscriber and records usage."""
    from job_dashboard.web import DashboardApp, make_handler

    app = DashboardApp(profile={}, sources=[], data_dir=tmp_path)
    user_id = "user_pro_subscriber"
    app.repository.save_subscription(
        user_id=user_id,
        plan_tier="pro_monthly",
        status="active",
        current_period_start="2026-09-01T00:00:00Z",
        current_period_end="2026-10-01T00:00:00Z",
        monthly_token_allowance=500000,
    )

    token = create_access_token({"sub": user_id, "email": "pro@example.com"})
    handler_cls = make_handler(app)

    payload = {
        "model": "anthropic/claude-3.7-sonnet",
        "messages": [
            {"role": "system", "content": "You are a career assistant."},
            {"role": "user", "content": "Draft intro."},
        ],
    }
    body = json.dumps(payload).encode("utf-8")

    mock_openrouter_response = {
        "id": "gen-123",
        "choices": [{"message": {"role": "assistant", "content": "Tailored intro."}}],
        "usage": {"prompt_tokens": 120, "completion_tokens": 60, "total_tokens": 180},
    }

    with (
        patch(
            "job_dashboard.billing.get_server_openrouter_key",
            return_value="test_master_key",
        ),
        patch(
            "job_dashboard.billing.forward_to_openrouter",
            return_value=mock_openrouter_response,
        ),
    ):
        handler = handler_cls.__new__(handler_cls)
        handler.path = "/api/ai/proxy"
        handler.headers = {
            "Content-Length": str(len(body)),
            "Authorization": f"Bearer {token}",
        }
        handler.rfile = io.BytesIO(body)
        handler.wfile = io.BytesIO()
        handler.client_address = ("127.0.0.1", 12345)
        handler.requestline = "POST /api/ai/proxy HTTP/1.1"
        handler.request_version = "HTTP/1.1"
        handler.command = "POST"
        handler.send_response = MagicMock()
        handler.send_header = MagicMock()
        handler.end_headers = MagicMock()

        handler.do_POST()
        assert handler.send_response.call_args[0][0] == 200
        res = json.loads(handler.wfile.getvalue().decode("utf-8"))
        assert res["choices"][0]["message"]["content"] == "Tailored intro."

        # Verify token ledger updated
        usage = app.repository.get_token_usage(user_id)
        assert usage["total_tokens"] == 180
        assert usage["call_count"] == 1


def test_billing_status_endpoint(tmp_path):
    """Test GET /api/billing/status returns subscription and usage metrics."""
    from job_dashboard.web import DashboardApp, make_handler

    app = DashboardApp(profile={}, sources=[], data_dir=tmp_path)
    user_id = "user_billing_check"
    token = create_access_token({"sub": user_id, "email": "billing@example.com"})
    handler_cls = make_handler(app)

    handler = handler_cls.__new__(handler_cls)
    handler.path = "/api/billing/status"
    handler.headers = {"Authorization": f"Bearer {token}"}
    handler.rfile = io.BytesIO()
    handler.wfile = io.BytesIO()
    handler.client_address = ("127.0.0.1", 12345)
    handler.requestline = "GET /api/billing/status HTTP/1.1"
    handler.request_version = "HTTP/1.1"
    handler.command = "GET"
    handler.send_response = MagicMock()
    handler.send_header = MagicMock()
    handler.end_headers = MagicMock()

    handler.do_GET()
    assert handler.send_response.call_args[0][0] == 200
    res = json.loads(handler.wfile.getvalue().decode("utf-8"))
    assert res["success"] is True
    assert res["plan_tier"] == "free"
    assert res["trial_generations_remaining"] >= 3


def test_ai_proxy_free_trial_and_exhaustion(tmp_path):
    """Test new user gets free trial generations, and gets 402 once exhausted."""
    from job_dashboard.web import DashboardApp, make_handler

    app = DashboardApp(profile={}, sources=[], data_dir=tmp_path)
    user_id = "user_trial_test"
    token = create_access_token({"sub": user_id, "email": "trial@example.com"})
    handler_cls = make_handler(app)

    # Set user to have exactly 1 trial generation remaining
    app.repository.save_subscription(
        user_id=user_id,
        plan_tier="free",
        status="inactive",
        monthly_token_allowance=0,
        trial_generations_remaining=1,
    )

    mock_res = {
        "id": "gen-trial-1",
        "choices": [{"message": {"role": "assistant", "content": "Trial synthesis."}}],
        "usage": {"prompt_tokens": 100, "completion_tokens": 50},
    }

    with (
        patch(
            "job_dashboard.billing.get_server_openrouter_key", return_value="test_key"
        ),
        patch("job_dashboard.billing.forward_to_openrouter", return_value=mock_res),
    ):
        # 1st call: should succeed under trial
        payload = {
            "model": "google/gemini-2.0-flash",
            "messages": [{"role": "user", "content": "test"}],
        }
        body = json.dumps(payload).encode("utf-8")
        handler = handler_cls.__new__(handler_cls)
        handler.path = "/api/ai/proxy"
        handler.headers = {
            "Content-Length": str(len(body)),
            "Authorization": f"Bearer {token}",
        }
        handler.rfile = io.BytesIO(body)
        handler.wfile = io.BytesIO()
        handler.client_address = ("127.0.0.1", 12345)
        handler.requestline = "POST /api/ai/proxy HTTP/1.1"
        handler.request_version = "HTTP/1.1"
        handler.command = "POST"
        handler.send_response = MagicMock()
        handler.send_header = MagicMock()
        handler.end_headers = MagicMock()

        handler.do_POST()
        assert handler.send_response.call_args[0][0] == 200
        data1 = json.loads(handler.wfile.getvalue().decode("utf-8"))
        assert data1["trial_info"]["trial_generations_remaining"] == 0

        # 2nd call: trial exhausted, should return 402 Payment Required
        handler2 = handler_cls.__new__(handler_cls)
        handler2.path = "/api/ai/proxy"
        handler2.headers = {
            "Content-Length": str(len(body)),
            "Authorization": f"Bearer {token}",
        }
        handler2.rfile = io.BytesIO(body)
        handler2.wfile = io.BytesIO()
        handler2.client_address = ("127.0.0.1", 12345)
        handler2.requestline = "POST /api/ai/proxy HTTP/1.1"
        handler2.request_version = "HTTP/1.1"
        handler2.command = "POST"
        handler2.send_response = MagicMock()
        handler2.send_header = MagicMock()
        handler2.end_headers = MagicMock()

        handler2.do_POST()
        assert handler2.send_response.call_args[0][0] == 402
        data2 = json.loads(handler2.wfile.getvalue().decode("utf-8"))
        assert data2["trial_exhausted"] is True


def test_stripe_webhook_activates_subscription(tmp_path):
    """Test Stripe webhook activates user subscription upon checkout completion."""
    from job_dashboard.web import DashboardApp, make_handler

    app = DashboardApp(profile={}, sources=[], data_dir=tmp_path)
    user_id = "user_webhook_customer"
    handler_cls = make_handler(app)

    webhook_event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "client_reference_id": user_id,
                "customer": "cus_stripe_real_123",
                "subscription": "sub_stripe_real_456",
                "metadata": {"user_id": user_id, "plan_tier": "pro_monthly"},
            }
        },
    }
    body = json.dumps(webhook_event).encode("utf-8")

    with patch.dict("os.environ", {"STRIPE_SECRET_KEY": "sk_test_mock"}):
        handler = handler_cls.__new__(handler_cls)
        handler.path = "/api/billing/webhook"
        handler.headers = {"Content-Length": str(len(body))}
        handler.rfile = io.BytesIO(body)
        handler.wfile = io.BytesIO()
        handler.client_address = ("127.0.0.1", 12345)
        handler.requestline = "POST /api/billing/webhook HTTP/1.1"
        handler.request_version = "HTTP/1.1"
        handler.command = "POST"
        handler.send_response = MagicMock()
        handler.send_header = MagicMock()
        handler.end_headers = MagicMock()

        handler.do_POST()
        assert handler.send_response.call_args[0][0] == 200

        # Verify subscription was activated in database
        sub = app.repository.get_subscription(user_id)
        assert sub["status"] == "active"
        assert sub["plan_tier"] == "pro_monthly"
        assert sub["stripe_customer_id"] == "cus_stripe_real_123"
        assert sub["monthly_token_allowance"] == 500000
