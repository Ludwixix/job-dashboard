from __future__ import annotations

import os
import threading
import urllib.parse
from dataclasses import dataclass
from typing import Any

from ..logging import get_logger

logger = get_logger("job_dashboard.sources.proxy")


@dataclass(frozen=True)
class ProxyInfo:
    url: str
    server: str
    username: str | None = None
    password: str | None = None
    scheme: str = "http"

    def to_playwright(self) -> dict[str, str]:
        """Convert to dict structure expected by Playwright browser launch."""
        config: dict[str, str] = {"server": self.server}
        if self.username:
            config["username"] = self.username
        if self.password:
            config["password"] = self.password
        return config


def sanitize_proxy_url(url: str | None) -> str:
    """Mask credentials in a proxy URL for safe diagnostic logging."""
    if not url:
        return ""
    try:
        parsed = urllib.parse.urlsplit(url)
        if parsed.password:
            netloc = f"{parsed.username}:***@{parsed.hostname}"
            if parsed.port:
                netloc += f":{parsed.port}"
            return urllib.parse.urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment))
        return url
    except Exception:
        return "<invalid-proxy-url>"


def parse_proxy(proxy_url: str | None) -> ProxyInfo | None:
    """Parse a proxy URL (http, https, socks5) into a ProxyInfo object."""
    if not proxy_url or not str(proxy_url).strip():
        return None
    raw = str(proxy_url).strip()
    if "://" not in raw:
        raw = f"http://{raw}"
    try:
        parsed = urllib.parse.urlsplit(raw)
        scheme = (parsed.scheme or "http").lower()
        port_str = f":{parsed.port}" if parsed.port else ""
        server = f"{scheme}://{parsed.hostname}{port_str}"
        return ProxyInfo(
            url=raw,
            server=server,
            username=parsed.username,
            password=parsed.password,
            scheme=scheme,
        )
    except Exception as error:
        logger.warning(f"Failed to parse proxy URL '{sanitize_proxy_url(raw)}': {error}")
        return None


def get_configured_proxies() -> list[str]:
    """Retrieve all available proxies from environment variables or settings."""
    proxies: list[str] = []
    
    # 1. Comma-separated list of rotating proxies
    env_list = os.getenv("JOB_DASHBOARD_PROXIES", "")
    if env_list:
        proxies.extend(p.strip() for p in env_list.split(",") if p.strip())
        
    # 2. Singular proxy setting
    single = (
        os.getenv("JOB_DASHBOARD_PROXY_URL")
        or os.getenv("HTTPS_PROXY")
        or os.getenv("HTTP_PROXY")
        or os.getenv("ALL_PROXY")
    )
    if single and single.strip() and single.strip() not in proxies:
        proxies.append(single.strip())
        
    return proxies


class ProxyRotator:
    """Thread-safe proxy rotator that manages round-robin proxy usage and temporary blacklisting."""

    def __init__(self, proxies: list[str] | None = None, max_fails: int = 3):
        self._proxies = [p for p in (proxies or get_configured_proxies()) if parse_proxy(p) is not None]
        self._index = 0
        self._fails: dict[str, int] = {}
        self._max_fails = max_fails
        self._lock = threading.Lock()

    @property
    def has_proxies(self) -> bool:
        return len(self._proxies) > 0

    def get_proxy(self) -> str | None:
        """Return the next available proxy URL, rotating round-robin."""
        with self._lock:
            if not self._proxies:
                return None
            active = [p for p in self._proxies if self._fails.get(p, 0) < self._max_fails]
            if not active:
                # If all proxies hit max_fails, reset fail counters to try again
                logger.info("All proxies marked failed; resetting proxy failure counts")
                self._fails.clear()
                active = self._proxies
            proxy = active[self._index % len(active)]
            self._index += 1
            return proxy

    def get_playwright_proxy(self) -> dict[str, str] | None:
        """Return the next proxy formatted for Playwright."""
        proxy_url = self.get_proxy()
        if not proxy_url:
            return None
        info = parse_proxy(proxy_url)
        return info.to_playwright() if info else None

    def mark_failed(self, proxy_url: str | None) -> None:
        """Increment failure count for a proxy URL."""
        if not proxy_url:
            return
        with self._lock:
            self._fails[proxy_url] = self._fails.get(proxy_url, 0) + 1
            if self._fails[proxy_url] >= self._max_fails:
                logger.warning(f"Proxy '{sanitize_proxy_url(proxy_url)}' temporarily disabled after {self._fails[proxy_url]} failures")

    def mark_success(self, proxy_url: str | None) -> None:
        """Reset failure count on successful request."""
        if not proxy_url:
            return
        with self._lock:
            if proxy_url in self._fails:
                del self._fails[proxy_url]
