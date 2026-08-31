"""
Job Ad Liveness and Validity Verification Service.
Checks whether job portal URLs and postings are still active, expired, or taken down.
"""
from __future__ import annotations

import re
import time
import urllib.request
import urllib.error
import ssl
from typing import Dict, Any, List

# In-memory TTL cache: { url: { "is_valid": bool, "is_expired": bool, "status_code": int, "reason": str, "timestamp": float } }
_VERIFY_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_TTL_SECONDS = 6 * 3600  # 6 hours

# Signatures indicating job ad was taken down, expired, or removed
EXPIRED_SIGNATURES = [
    re.compile(r"this job is no longer advertised", re.IGNORECASE),
    re.compile(r"no longer accepting applications", re.IGNORECASE),
    re.compile(r"this job has expired", re.IGNORECASE),
    re.compile(r"job has expired", re.IGNORECASE),
    re.compile(r"job no longer available", re.IGNORECASE),
    re.compile(r"this job is no longer available", re.IGNORECASE),
    re.compile(r"job is closed", re.IGNORECASE),
    re.compile(r"this position has been closed", re.IGNORECASE),
    re.compile(r"position has been filled", re.IGNORECASE),
    re.compile(r"vacancy has closed", re.IGNORECASE),
    re.compile(r"listing you are looking for has expired", re.IGNORECASE),
    re.compile(r"sorry, this job is no longer active", re.IGNORECASE),
    re.compile(r"application deadline has passed", re.IGNORECASE),
    re.compile(r"page not found", re.IGNORECASE),
    re.compile(r"404 - not found", re.IGNORECASE),
    re.compile(r"job not found", re.IGNORECASE),
]

def verify_job_url(url: str, force: bool = False) -> Dict[str, Any]:
    """
    Verifies if a job ad URL is still active and valid.
    """
    if not url or not isinstance(url, str):
        return {
            "url": url or "",
            "is_valid": False,
            "is_expired": True,
            "status_code": 400,
            "reason": "Missing or invalid URL",
            "checked_at": time.time()
        }

    clean_url = url.strip()
    if not (clean_url.startswith("http://") or clean_url.startswith("https://")):
        return {
            "url": clean_url,
            "is_valid": False,
            "is_expired": True,
            "status_code": 400,
            "reason": "URL must start with http:// or https://",
            "checked_at": time.time()
        }

    # Check cache unless force is True
    now = time.time()
    if not force and clean_url in _VERIFY_CACHE:
        cached = _VERIFY_CACHE[clean_url]
        if (now - cached.get("timestamp", 0)) < _CACHE_TTL_SECONDS:
            return {
                "url": clean_url,
                "is_valid": cached.get("is_valid", True),
                "is_expired": cached.get("is_expired", False),
                "status_code": cached.get("status_code", 200),
                "reason": cached.get("reason", "Active & verified"),
                "checked_at": cached.get("timestamp", now),
                "cached": True
            }

    # Perform lightweight HTTP fetch with realistic browser User-Agent
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(
        clean_url,
        headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=5, context=ctx) as response:
            status_code = response.getcode()
            # Read first 128KB to inspect text signatures
            raw_bytes = response.read(131072)
            html_text = raw_bytes.decode("utf-8", errors="ignore")

            # Check for removal signatures
            for pattern in EXPIRED_SIGNATURES:
                if pattern.search(html_text):
                    result = {
                        "url": clean_url,
                        "is_valid": False,
                        "is_expired": True,
                        "status_code": status_code,
                        "reason": "Job ad taken down or expired (detected on portal)",
                        "timestamp": now
                    }
                    _VERIFY_CACHE[clean_url] = result
                    return result

            # Valid and active
            result = {
                "url": clean_url,
                "is_valid": True,
                "is_expired": False,
                "status_code": status_code,
                "reason": "Job ad verified active and online",
                "timestamp": now
            }
            _VERIFY_CACHE[clean_url] = result
            return result

    except urllib.error.HTTPError as e:
        is_expired = e.code in (404, 410, 403, 500)
        reason = f"HTTP Error {e.code}: {'Job removed or link dead' if is_expired else e.reason}"
        result = {
            "url": clean_url,
            "is_valid": not is_expired,
            "is_expired": is_expired,
            "status_code": e.code,
            "reason": reason,
            "timestamp": now
        }
        _VERIFY_CACHE[clean_url] = result
        return result

    except Exception as e:
        # Network error or timeout
        result = {
            "url": clean_url,
            "is_valid": False,
            "is_expired": True,
            "status_code": 0,
            "reason": f"Connection check failed: {str(e)}",
            "timestamp": now
        }
        _VERIFY_CACHE[clean_url] = result
        return result

def verify_job_urls(urls: List[str], force: bool = False) -> Dict[str, Dict[str, Any]]:
    """
    Batch verify a list of job URLs.
    """
    results = {}
    for u in (urls or [])[:50]:  # Limit to 50 per batch
        if u:
            results[u] = verify_job_url(u, force=force)
    return results
