"""Routes package initialization — imports domain route modules to register on app_router."""

from . import ai, auth, billing, career_mode, jobs, scrape

__all__ = ["ai", "auth", "billing", "career_mode", "jobs", "scrape"]
