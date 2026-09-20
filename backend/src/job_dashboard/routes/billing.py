"""Billing, Stripe, and AI gateway proxy routes."""

from __future__ import annotations

from ..router import app_router, get_auth_user_id, get_json_body


@app_router.get("/api/billing/status")
def handle_billing_status(handler):
    """Retrieve billing status, subscription details, and token usage."""
    app = handler.app
    user_id = get_auth_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {"error": "Authentication required", "code": "UNAUTHORIZED"},
        )
        return

    from ..billing import get_billing_status_response

    res = get_billing_status_response(user_id, app.repository)
    handler.send_json(200, res)


@app_router.post("/api/ai/proxy")
def handle_ai_proxy(handler):
    """Secure proxy for server-side AI requests with subscription validation and token metering."""
    app = handler.app
    user_id = get_auth_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "error": "Authentication required for AI gateway proxy",
                "code": "UNAUTHORIZED",
            },
        )
        return

    payload = get_json_body(handler)
    from ..billing import process_ai_proxy_request

    status_code, result = process_ai_proxy_request(payload, user_id, app.repository)
    handler.send_json(status_code, result)


@app_router.post("/api/billing/create-checkout-session")
def handle_create_checkout_session(handler):
    """Create a Stripe Checkout Session for subscription upgrade."""
    app = handler.app
    user_id = get_auth_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "error": "Authentication required",
                "code": "UNAUTHORIZED",
            },
        )
        return

    payload = get_json_body(handler)
    plan_tier = payload.get("plan_id") or payload.get("plan_tier") or "pro_monthly"
    origin = handler.headers.get("Origin") or "http://localhost:5173"
    success_url = payload.get("success_url") or f"{origin}/dashboard?payment=success"
    cancel_url = payload.get("cancel_url") or f"{origin}/dashboard?payment=cancelled"

    user = app.repository.get_user_by_id(user_id) or {}
    from ..billing import create_checkout_session

    res = create_checkout_session(
        user_id=user_id,
        email=user.get("email", ""),
        name=user.get("name", ""),
        plan_tier=plan_tier,
        success_url=success_url,
        cancel_url=cancel_url,
        repository=app.repository,
    )
    handler.send_json(200 if res.get("success") else 400, res)


@app_router.post("/api/billing/webhook")
def handle_billing_webhook(handler):
    """Process Stripe webhook events for subscription updates."""
    app = handler.app
    content_len = int(handler.headers.get("Content-Length", "0"))
    raw_body = handler.rfile.read(content_len) if content_len > 0 else b""
    sig_header = handler.headers.get("Stripe-Signature", "")

    from ..billing import process_stripe_webhook

    res = process_stripe_webhook(raw_body, sig_header, app.repository)
    handler.send_json(200 if res.get("success") else 400, res)


@app_router.post("/api/billing/customer-portal")
def handle_customer_portal(handler):
    """Generate a Stripe Billing Customer Portal session."""
    app = handler.app
    user_id = get_auth_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "error": "Authentication required",
                "code": "UNAUTHORIZED",
            },
        )
        return

    origin = handler.headers.get("Origin") or "http://localhost:5173"
    payload = get_json_body(handler)
    return_url = payload.get("return_url") or f"{origin}/dashboard"

    from ..billing import create_customer_portal_session

    res = create_customer_portal_session(user_id, return_url, app.repository)
    handler.send_json(200 if res.get("success") else 400, res)
