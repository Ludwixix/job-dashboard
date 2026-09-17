"""API Routers package for Job Dashboard."""

from .applications import router as applications_router
from .auth import router as auth_router
from .digest import router as digest_router
from .jobs import router as jobs_router
from .metrics import router as metrics_router
from .search import router as search_router

__all__ = [
    "applications_router",
    "auth_router",
    "digest_router",
    "jobs_router",
    "metrics_router",
    "search_router",
]
