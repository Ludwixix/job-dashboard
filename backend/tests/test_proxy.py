import pytest

from job_dashboard.sources.proxy import (
    ProxyInfo,
    ProxyRotator,
    get_configured_proxies,
    parse_proxy,
    sanitize_proxy_url,
)


def test_parse_proxy_with_credentials():
    info = parse_proxy("http://user:secretpassword@proxy.example.com:8080")
    assert info is not None
    assert info.server == "http://proxy.example.com:8080"
    assert info.username == "user"
    assert info.password == "secretpassword"
    assert info.scheme == "http"

    pw = info.to_playwright()
    assert pw == {
        "server": "http://proxy.example.com:8080",
        "username": "user",
        "password": "secretpassword",
    }


def test_parse_proxy_without_credentials():
    info = parse_proxy("socks5://127.0.0.1:1080")
    assert info is not None
    assert info.server == "socks5://127.0.0.1:1080"
    assert info.username is None
    assert info.password is None

    pw = info.to_playwright()
    assert pw == {"server": "socks5://127.0.0.1:1080"}


def test_parse_proxy_empty_or_invalid():
    assert parse_proxy(None) is None
    assert parse_proxy("") is None
    assert parse_proxy("   ") is None


def test_sanitize_proxy_url_masks_password():
    # Zero secret exposure check: passwords must never be visible in sanitized strings
    url = "http://admin:SuperSecret123@proxy.domain.org:3128"
    sanitized = sanitize_proxy_url(url)
    assert "SuperSecret123" not in sanitized
    assert sanitized == "http://admin:***@proxy.domain.org:3128"


def test_sanitize_proxy_url_unauthenticated():
    url = "http://proxy.domain.org:3128"
    assert sanitize_proxy_url(url) == url


def test_proxy_rotator_round_robin():
    proxies = [
        "http://proxy1.com:8080",
        "http://proxy2.com:8080",
        "http://proxy3.com:8080",
    ]
    rotator = ProxyRotator(proxies, max_fails=2)
    assert rotator.has_proxies is True

    # Rotates sequentially
    assert rotator.get_proxy() == "http://proxy1.com:8080"
    assert rotator.get_proxy() == "http://proxy2.com:8080"
    assert rotator.get_proxy() == "http://proxy3.com:8080"
    assert rotator.get_proxy() == "http://proxy1.com:8080"


def test_proxy_rotator_fail_and_recover():
    proxies = ["http://proxy1.com:8080", "http://proxy2.com:8080"]
    rotator = ProxyRotator(proxies, max_fails=2)

    # Fail proxy1 twice
    rotator.mark_failed("http://proxy1.com:8080")
    rotator.mark_failed("http://proxy1.com:8080")

    # Now only proxy2 is active
    assert rotator.get_proxy() == "http://proxy2.com:8080"
    assert rotator.get_proxy() == "http://proxy2.com:8080"

    # Recover proxy1 on success
    rotator.mark_success("http://proxy1.com:8080")
    results = {rotator.get_proxy(), rotator.get_proxy()}
    assert "http://proxy1.com:8080" in results
