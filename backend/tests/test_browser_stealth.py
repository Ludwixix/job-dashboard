import pytest

from job_dashboard.sources.browser import (
    CHALLENGE_TITLE_SUBSTRINGS,
    STEALTH_INIT_SCRIPT,
    STEALTH_USER_AGENT,
    is_challenge_page,
)


def test_is_challenge_page_detection():
    # Detects Cloudflare and anti-bot challenge titles
    assert is_challenge_page("Just a moment...") is True
    assert is_challenge_page("Attention Required! | Cloudflare") is True
    assert is_challenge_page("Security Check") is True
    assert is_challenge_page("Are You a Human?") is True

    # Real job search titles pass
    assert is_challenge_page("System Administrator Jobs in All Melbourne VIC - Sep 2026 | SEEK") is False
    assert is_challenge_page("50 System Administrator Jobs and Work in Melbourne VIC | Indeed") is False
    assert is_challenge_page("") is False


def test_is_challenge_page_content_detection():
    assert is_challenge_page("Page", content="<div id='cf-turnstile-wrapper'></div>") is True
    assert is_challenge_page("Page", content="<div class='challenge-running'></div>") is True
    assert is_challenge_page("Page", content="<div class='job-list'>Normal content</div>") is False


def test_stealth_init_script_overrides():
    # Invariant checks for anti-automation evasion
    assert "webdriver" in STEALTH_INIT_SCRIPT
    assert "window.chrome" in STEALTH_INIT_SCRIPT
    assert "plugins" in STEALTH_INIT_SCRIPT
    assert "languages" in STEALTH_INIT_SCRIPT
    assert "HeadlessChrome" not in STEALTH_USER_AGENT
