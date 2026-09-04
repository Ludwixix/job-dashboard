"""
Strict API Boundary Layer for Job Dashboard.

This module is the single public entrypoint for frontend clients communicating with the backend.
Internal domain modules (service.py, classify.py, score.py, models.py) are encapsulated behind
this layer and must not be imported directly by external request handlers.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ..web import DashboardApp


class ApiGateway:
    """Facade encapsulating all domain and application services behind a strict API surface."""

    def __init__(self, app: DashboardApp):
        self._app = app

    @property
    def app(self) -> DashboardApp:
        return self._app

    def get_public_jobs(self) -> list[dict[str, Any]]:
        return self._app.public_jobs()

    def get_profile(self) -> dict[str, Any]:
        return self._app.dashboard.profile

    def update_profile(self, profile: dict[str, Any]) -> dict[str, Any]:
        self._app.dashboard.profile = profile
        if hasattr(self._app, "save_profile"):
            self._app.save_profile()
        return self._app.dashboard.profile

    def get_preferences(self, user_id: str = "default_user") -> dict[str, Any]:
        return self._app.repository.get_user_preferences(user_id)

    def save_preferences(self, preferences: dict[str, Any], user_id: str = "default_user") -> None:
        self._app.repository.save_user_preferences(user_id, preferences)

    def get_applications(self, user_id: str = "default_user") -> list[dict[str, Any]]:
        return self._app.repository.get_user_applications(user_id)

    def save_application(self, application: dict[str, Any], user_id: str = "default_user") -> None:
        self._app.repository.save_user_application(user_id, application)

    def generate_documents(self, job_id: str) -> dict[str, Any]:
        return self._app.generate(job_id)
