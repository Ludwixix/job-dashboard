"""Unit tests for anti-403 scraping resilience mechanisms."""

import time
from unittest.mock import MagicMock, patch
import pytest
import requests

from job_dashboard.sources.resilience import (
    CloudflareChallengeError,
    DomainCooldownTracker,
    RateLimitBlockedError,
    ResilientScrapeSession,
    domain_cooldown_tracker,
    get_stealth_headers,
)


@pytest.fixture(autouse=True)
def reset_cooldowns():
    domain_cooldown_tracker.clear()
    yield
    domain_cooldown_tracker.clear()


def test_stealth_headers_client_hints():
    """Verify that stealth headers contain aligned modern Client Hints."""
    headers_nav = get_stealth_headers(domain="au.jora.com", as_xhr=False)
    assert "sec-ch-ua" in headers_nav
    assert "sec-ch-ua-mobile" in headers_nav
    assert "sec-ch-ua-platform" in headers_nav
    assert headers_nav["sec-ch-ua-mobile"] == "?0"
    assert headers_nav["sec-fetch-dest"] == "document"
    assert headers_nav["sec-fetch-mode"] == "navigate"
    assert headers_nav["Host"] == "au.jora.com"
    assert headers_nav["Referer"] == "https://au.jora.com/"
    assert "en-AU" in headers_nav["Accept-Language"]

    # Verify XHR / API mode
    headers_xhr = get_stealth_headers(domain="api.seek.com.au", as_xhr=True)
    assert headers_xhr["sec-fetch-dest"] == "empty"
    assert headers_xhr["sec-fetch-mode"] == "cors"
    assert "application/json" in headers_xhr["Accept"]


def test_domain_cooldown_tracker():
    """Verify thread-safe domain cooldown tracking and expiration."""
    tracker = DomainCooldownTracker(default_cooldown_secs=1.0)
    assert tracker.is_cooldown_active("au.jora.com") is False

    tracker.mark_blocked("au.jora.com", cooldown_secs=0.5)
    assert tracker.is_cooldown_active("au.jora.com") is True
    assert tracker.get_remaining_cooldown("au.jora.com") > 0

    # Wait for expiry
    time.sleep(0.6)
    assert tracker.is_cooldown_active("au.jora.com") is False
    assert tracker.get_remaining_cooldown("au.jora.com") == 0.0


def test_resilient_session_cloudflare_challenge_detection():
    """Verify that ResilientScrapeSession intercepts Cloudflare challenge HTML and raises typed error."""
    tracker = DomainCooldownTracker()
    session = ResilientScrapeSession(domain="au.jora.com", min_jitter=0, max_jitter=0)

    mock_resp = MagicMock()
    mock_resp.status_code = 403
    mock_resp.text = "<html><head><title>Just a moment...</title></head><body>Verify you are human</body></html>"

    with patch.object(session.session, "get", return_value=mock_resp):
        with pytest.raises(CloudflareChallengeError) as exc_info:
            session.get("https://au.jora.com/j?q=python")
        assert "Cloudflare anti-bot challenge" in str(exc_info.value)
        assert exc_info.value.status_code == 403


def test_resilient_session_rate_limit_detection():
    """Verify that ResilientScrapeSession detects HTTP 429 and marks domain cooldown."""
    session = ResilientScrapeSession(domain="au.jora.com", min_jitter=0, max_jitter=0)

    mock_resp = MagicMock()
    mock_resp.status_code = 429
    mock_resp.headers = {"Retry-After": "45"}
    mock_resp.text = "Too many requests"

    with patch.object(session.session, "get", return_value=mock_resp):
        with pytest.raises(RateLimitBlockedError) as exc_info:
            session.get("https://au.jora.com/j?q=python")
        assert exc_info.value.retry_after == 45
