"""Routes package initialization — imports domain route modules to register on app_router."""

from . import ai, auth, billing, jobs, scrape

__all__ = ["ai", "auth", "billing", "jobs", "scrape"]
