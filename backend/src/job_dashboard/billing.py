"""
Billing, Subscriptions, and Server-Side AI Proxy Module.

Provides:
- Authenticated OpenRouter AI Gateway Proxy for subscribers and trial users (Zero Secret Exposure).
- Token metering and quota enforcement per billing cycle in SQLite WAL.
- Stripe Checkout, Customer Portal, and Webhook lifecycle management.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta
from typing import Any, TYPE_CHECKING

from .logging import get_logger

if TYPE_CHECKING:
    from .repository import JobRepository

logger = get_logger("job_dashboard.billing")

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"

# Model pricing rates in USD per 1M tokens (prompt, completion)
MODEL_PRICING_PER_MILLION = {
    "anthropic/claude-3.7-sonnet": (3.00, 15.00),
    "claude-3-7-sonnet-20250219": (3.00, 15.00),
    "anthropic/claude-3.5-sonnet": (3.00, 15.00),
    "openai/gpt-4o": (2.50, 10.00),
    "openai/gpt-4o-mini": (0.15, 0.60),
    "google/gemini-2.5-pro": (1.25, 5.00),
    "google/gemini-2.0-flash": (0.10, 0.40),
    "google/gemini-2.0-flash-001": (0.10, 0.40),
    "deepseek/deepseek-chat": (0.27, 1.10),
    "deepseek/deepseek-r1": (0.55, 2.19),
    "qwen/qwen-2.5-coder-32b-instruct": (0.20, 0.20),
    "z-ai/glm-5.3-flash": (0.10, 0.10),
}


def calculate_cost_usd(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Calculate approximate USD inference cost based on token counts and model pricing."""
    if ":free" in model or "free" in model.lower():
        return 0.0
    rates = MODEL_PRICING_PER_MILLION.get(model, (0.50, 1.50))
    prompt_cost = (prompt_tokens / 1_000_000.0) * rates[0]
    completion_cost = (completion_tokens / 1_000_000.0) * rates[1]
    return round(prompt_cost + completion_cost, 6)


def get_server_openrouter_key() -> str:
    """Safely fetch server-side master OpenRouter API key without exposing to client."""
    return (
        os.getenv("JOB_DASHBOARD_OPENROUTER_API_KEY", "")
        or os.getenv("OPENROUTER_API_KEY", "")
    ).strip()


def forward_to_openrouter(
    payload: dict[str, Any], api_key: str, stream: bool = False
) -> dict[str, Any]:
    """Forward inference payload upstream to OpenRouter using backend master credentials."""
    if not api_key:
        raise ValueError("Server OpenRouter master API key is not configured.")

    req_data = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://job-dashboard.app",
        "X-Title": "Job Dashboard Platform AI Gateway",
    }

    req = urllib.request.Request(
        OPENROUTER_CHAT_URL, data=req_data, headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw_res = resp.read().decode("utf-8")
            return json.loads(raw_res)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else str(e)
        logger.error(f"OpenRouter upstream HTTP error {e.code}: {error_body}")
        raise RuntimeError(
            f"OpenRouter gateway returned HTTP {e.code}: {error_body}"
        ) from e
    except Exception as e:
        logger.error(f"Failed connecting to OpenRouter gateway: {e}")
        raise RuntimeError(f"Failed to communicate with AI gateway: {e}") from e


def process_ai_proxy_request(
    payload: dict[str, Any],
    user_id: str,
    repository: JobRepository,
) -> tuple[int, dict[str, Any]]:
    """
    Authenticate user entitlement, check monthly token quotas or trial balance,
    and proxy inference request through the server-side master OpenRouter key.
    """
    server_key = get_server_openrouter_key()
    sub = repository.get_subscription(user_id)
    is_active_sub = sub.get("status") == "active"
    trial_generations = sub.get("trial_generations_remaining", 0)

    # Validate entitlement: active subscriber or free trial credits available
    if not is_active_sub and trial_generations <= 0:
        return 402, {
            "error": "Subscription or active trial required for built-in AI generation.",
            "code": "PAYMENT_REQUIRED",
            "trial_exhausted": True,
            "upgrade_url": "/pricing",
        }

    # Check monthly quota for active subscribers
    if is_active_sub:
        usage = repository.get_token_usage(user_id)
        if usage.get("remaining_tokens", 0) <= 0 and usage.get("allowance", 0) > 0:
            return 429, {
                "error": "Monthly AI token allowance reached. Resets at start of next billing period.",
                "code": "QUOTA_EXCEEDED",
                "usage": usage,
            }

    model = payload.get("model", "google/gemini-2.0-flash")

    # If server key is not configured in environment, provide high-quality fallback or helpful error
    if not server_key:
        logger.warning("Server OPENROUTER_API_KEY is not configured on this host.")
        return 503, {
            "error": "AI Gateway is temporarily unconfigured by administrator (missing OPENROUTER_API_KEY).",
            "code": "GATEWAY_UNAVAILABLE",
        }

    try:
        result = forward_to_openrouter(payload, server_key)
    except Exception as e:
        return 502, {"error": str(e), "code": "UPSTREAM_ERROR"}

    # Extract token usage and record in database ledger
    usage_info = result.get("usage", {})
    prompt_tokens = int(usage_info.get("prompt_tokens") or 1000)
    completion_tokens = int(usage_info.get("completion_tokens") or 500)
    cost_usd = calculate_cost_usd(model, prompt_tokens, completion_tokens)

    repository.record_token_usage(
        user_id=user_id,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cost_usd=cost_usd,
        model=model,
    )

    # Decrement trial count if this was an unsubscribed user
    if not is_active_sub:
        remaining_trial = repository.decrement_trial_generations(user_id)
        result["trial_info"] = {
            "is_trial": True,
            "trial_generations_remaining": remaining_trial,
        }

    return 200, result


def create_checkout_session(
    user_id: str,
    email: str,
    name: str,
    plan_tier: str,
    success_url: str,
    cancel_url: str,
    repository: JobRepository,
) -> dict[str, Any]:
    """
    Create a Stripe Checkout Session for subscription or 3-month pass.
    Falls back gracefully if stripe library or API keys are unconfigured.
    """
    stripe_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    if not stripe_key:
        # Mock checkout URL for development/testing when live Stripe keys are not yet deployed
        mock_session_id = (
            f"cs_test_{user_id}_{int(datetime.now(timezone.utc).timestamp())}"
        )
        return {
            "success": True,
            "checkout_url": f"{success_url}?session_id={mock_session_id}&simulated=true",
            "simulated": True,
        }

    try:
        import stripe

        stripe.api_key = stripe_key

        sub = repository.get_subscription(user_id)
        cust_id = sub.get("stripe_customer_id")
        if not cust_id:
            customer = stripe.Customer.create(
                email=email,
                name=name or email,
                metadata={"user_id": user_id},
            )
            cust_id = customer.id

        is_one_off = plan_tier == "pass_3mo"
        mode = "payment" if is_one_off else "subscription"

        price_id = os.getenv(
            "STRIPE_PRICE_PASS_3MO" if is_one_off else "STRIPE_PRICE_PRO_MONTHLY", ""
        )

        line_items = []
        if price_id:
            line_items.append({"price": price_id, "quantity": 1})
        else:
            # Inline price creation if price IDs are not pre-configured
            amount_cents = 4900 if is_one_off else 1900
            currency = "aud"
            product_data = {
                "name": "3-Month Job Hunt Career Pass"
                if is_one_off
                else "Pro Job Hunter Subscription",
                "description": "Built-in Claude 3.7 / GPT-4o AI applications, zero API keys, interview cockpit.",
            }
            if is_one_off:
                price_data = {
                    "currency": currency,
                    "unit_amount": amount_cents,
                    "product_data": product_data,
                }
            else:
                price_data = {
                    "currency": currency,
                    "unit_amount": amount_cents,
                    "recurring": {"interval": "month"},
                    "product_data": product_data,
                }
            line_items.append({"price_data": price_data, "quantity": 1})

        session = stripe.checkout.Session.create(
            customer=cust_id,
            mode=mode,
            line_items=line_items,
            success_url=success_url,
            cancel_url=cancel_url,
            client_reference_id=user_id,
            metadata={"user_id": user_id, "plan_tier": plan_tier},
        )
        return {"success": True, "checkout_url": session.url, "session_id": session.id}
    except Exception as e:
        logger.error(f"Error creating Stripe checkout session: {e}")
        return {"success": False, "error": str(e)}


def process_stripe_webhook(
    payload: bytes, sig_header: str, repository: JobRepository
) -> dict[str, Any]:
    """Verify and handle incoming Stripe webhook events."""
    stripe_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

    if not stripe_key:
        return {"success": False, "error": "Stripe secret not configured."}

    try:
        if webhook_secret:
            try:
                import stripe
                stripe.api_key = stripe_key
                event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
            except ImportError:
                logger.info("Stripe SDK not installed, parsing webhook JSON directly.")
                event = json.loads(payload.decode("utf-8"))
        else:
            event = json.loads(payload.decode("utf-8"))
    except Exception as e:
        logger.error(f"Failed verifying webhook: {e}")
        return {"success": False, "error": str(e)}

    event_type = event.get("type", "")
    data_obj = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        user_id = data_obj.get("client_reference_id") or data_obj.get(
            "metadata", {}
        ).get("user_id")
        plan_tier = data_obj.get("metadata", {}).get("plan_tier", "pro_monthly")
        cust_id = data_obj.get("customer", "")
        sub_id = data_obj.get("subscription", "")

        now = datetime.now(timezone.utc)
        start_iso = now.isoformat()
        if plan_tier == "pass_3mo":
            end_iso = (now + timedelta(days=90)).isoformat()
            allowance = 1_500_000
        else:
            end_iso = (now + timedelta(days=30)).isoformat()
            allowance = 500_000

        if user_id:
            repository.save_subscription(
                user_id=user_id,
                plan_tier=plan_tier,
                status="active",
                stripe_customer_id=cust_id,
                stripe_subscription_id=sub_id,
                current_period_start=start_iso,
                current_period_end=end_iso,
                monthly_token_allowance=allowance,
            )
            logger.info(f"Activated subscription for user {user_id} tier={plan_tier}")

    elif event_type in (
        "customer.subscription.deleted",
        "customer.subscription.updated",
    ):
        sub_id = data_obj.get("id")
        status = data_obj.get("status", "canceled")
        mapped_status = "active" if status in ("active", "trialing") else "canceled"
        cust_id = data_obj.get("customer", "")
        # Look up user by customer id or metadata
        user_id = data_obj.get("metadata", {}).get("user_id")
        if user_id:
            repository.save_subscription(
                user_id=user_id,
                status=mapped_status,
                stripe_customer_id=cust_id,
                stripe_subscription_id=sub_id,
            )

    return {"success": True, "event": event_type}


def create_customer_portal_session(
    user_id: str, return_url: str, repository: JobRepository
) -> dict[str, Any]:
    """Generate Stripe Customer Portal session URL."""
    stripe_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    sub = repository.get_subscription(user_id)
    cust_id = sub.get("stripe_customer_id")

    if not stripe_key or not cust_id:
        return {
            "success": False,
            "error": "No active payment profile found to manage.",
            "portal_url": return_url,
        }

    try:
        import stripe

        stripe.api_key = stripe_key
        portal_session = stripe.billing_portal.Session.create(
            customer=cust_id,
            return_url=return_url,
        )
        return {"success": True, "portal_url": portal_session.url}
    except Exception as e:
        logger.error(f"Failed creating billing portal session: {e}")
        return {"success": False, "error": str(e), "portal_url": return_url}


def get_billing_status_response(
    user_id: str, repository: JobRepository
) -> dict[str, Any]:
    """Return consolidated subscription status, token usage, and allowance."""
    sub = repository.get_subscription(user_id)
    usage = repository.get_token_usage(user_id)

    return {
        "success": True,
        "user_id": user_id,
        "plan_tier": sub.get("plan_tier", "free"),
        "status": sub.get("status", "inactive"),
        "is_active": sub.get("status") == "active",
        "current_period_end": sub.get("current_period_end"),
        "cancel_at_period_end": sub.get("cancel_at_period_end", False),
        "trial_generations_remaining": sub.get("trial_generations_remaining", 3),
        "monthly_token_allowance": sub.get("monthly_token_allowance", 0),
        "tokens_used_this_month": usage.get("total_tokens", 0),
        "tokens_remaining": usage.get("remaining_tokens", 0),
        "estimated_spend_usd": usage.get("cost_usd", 0.0),
        "call_count": usage.get("call_count", 0),
    }
