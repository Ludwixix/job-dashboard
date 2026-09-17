"""System telemetry and process health metrics."""

from __future__ import annotations

import os
import platform
import resource
import sys
import time
from typing import Any, Dict

START_TIME = time.time()


def get_system_telemetry(repo: Any = None) -> Dict[str, Any]:
    """Return process and system level telemetry metrics.

    Calculates runtime uptime, process RSS memory allocation,
    platform runtime version, and current database integrity.
    """
    now = time.time()
    uptime_sec = max(0.0, now - START_TIME)

    # Process memory
    try:
        # On Linux, ru_maxrss is in kilobytes
        usage = resource.getrusage(resource.RUSAGE_SELF)
        rss_kb = usage.ru_maxrss
        rss_mb = round(rss_kb / 1024.0, 2)
    except Exception:
        rss_mb = 0.0

    # Jobs count & DB health
    jobs_count = 0
    db_healthy = True
    if repo is not None:
        try:
            jobs_count = repo.count_jobs()
        except Exception:
            db_healthy = False

    return {
        "success": True,
        "service": "career-agent",
        "version": "3.0.0",
        "status": "healthy" if db_healthy else "degraded",
        "timestamp": now,
        "uptime_seconds": round(uptime_sec, 1),
        "runtime": {
            "python_version": sys.version.split()[0],
            "platform": platform.platform(),
            "pid": os.getpid(),
            "memory_rss_mb": rss_mb,
        },
        "database": {
            "healthy": db_healthy,
            "jobs_count": jobs_count,
        },
    }
