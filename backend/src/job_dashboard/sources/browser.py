from __future__ import annotations

import time
from typing import Any

from ..logging import get_logger
from .proxy import sanitize_proxy_url

logger = get_logger("job_dashboard.sources.browser")

# User agent string resembling modern Google Chrome on macOS
STEALTH_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

# JavaScript injected into every frame before page scripts execute
STEALTH_INIT_SCRIPT = """
(() => {
    // 1. Remove automation flags
    Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
    });

    // 2. Mock standard Chrome runtime namespace
    window.chrome = {
        runtime: {},
        app: {},
        csi: function() {},
        loadTimes: function() {}
    };

    // 3. Mock plugins and languages
    Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
        configurable: true
    });
    Object.defineProperty(navigator, 'languages', {
        get: () => ['en-AU', 'en-US', 'en'],
        configurable: true
    });

    // 4. Mock notification permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
    );
})();
"""

CHALLENGE_TITLE_SUBSTRINGS = [
    "just a moment",
    "attention required",
    "security check",
    "cloudflare",
    "ddos-guard",
    "robot or human",
    "are you a human",
]


class BotBlockedError(RuntimeError):
    """Raised when an anti-bot or CAPTCHA challenge prevents page scraping."""


def is_challenge_page(title: str, content: str = "") -> bool:
    """Detect if a title or HTML body corresponds to a Cloudflare/anti-bot challenge."""
    title_lower = (title or "").lower().strip()
    if any(pattern in title_lower for pattern in CHALLENGE_TITLE_SUBSTRINGS):
        return True
    content_lower = (content or "")[:10000].lower()
    if "cf-turnstile" in content_lower or "challenge-running" in content_lower:
        return True
    return False


def create_stealth_browser(
    playwright: Any,
    headless: bool = True,
    proxy: dict[str, str] | None = None,
) -> tuple[Any, Any]:
    """
    Launch a Chromium browser and return a stealth-configured (browser, context) pair.
    """
    launch_args = [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--disable-infobars",
        "--no-first-run",
        "--window-size=1440,900",
    ]

    launch_kwargs: dict[str, Any] = {
        "headless": headless,
        "args": launch_args,
    }
    if proxy:
        launch_kwargs["proxy"] = proxy
        server_masked = sanitize_proxy_url(proxy.get("server", ""))
        logger.debug(f"Launching stealth browser via proxy: {server_masked}")

    browser = playwright.chromium.launch(**launch_kwargs)

    context = browser.new_context(
        user_agent=STEALTH_USER_AGENT,
        viewport={"width": 1440, "height": 900},
        locale="en-AU",
        timezone_id="Australia/Melbourne",
        color_scheme="light",
    )
    context.add_init_script(STEALTH_INIT_SCRIPT)
    return browser, context


def wait_for_challenge_clearance(page: Any, max_wait_seconds: float = 6.0) -> bool:
    """
    If a challenge page is detected, wait briefly in case automated JS challenges resolve.
    Returns True if page cleared the challenge, False if still blocked.
    """
    start_time = time.monotonic()
    while time.monotonic() - start_time < max_wait_seconds:
        try:
            title = page.title()
            if not is_challenge_page(title):
                return True
            time.sleep(1.0)
        except Exception:
            return False
    return not is_challenge_page(page.title())
