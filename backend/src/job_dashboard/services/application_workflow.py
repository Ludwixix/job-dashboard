"""
job_dashboard.services.application_workflow
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Domain service managing application workflows, Kanban pipeline states,
document generation caches, and recruiter network relations.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from ..network_crm import NetworkCRMManager
from ..smart_applications import get_smart_application_tracker

logger = logging.getLogger(__name__)


class ApplicationWorkflowService:
    """Manages application status lifecycle, interview tracking, and CRM."""

    def __init__(self, data_dir: Path, repository=None):
        self.data_dir = Path(data_dir)
        self.repository = repository
        self.application_tracker = get_smart_application_tracker(self.data_dir)
        self.network_crm = NetworkCRMManager(self.data_dir / "jobs.sqlite3")
        self.generated_documents: dict[str, dict[str, str]] = (
            self._load_generated_documents()
        )
        self.generation_progress: dict[str, dict[str, Any]] = {}

    def _load_generated_documents(self) -> dict[str, dict[str, str]]:
        """Load cached generated documents from disk."""
        path = self.data_dir / "generated_documents.json"
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except Exception as err:
                logger.warning(f"Error loading generated documents from {path}: {err}")
        return {}

    def save_generated_documents(self) -> None:
        """Persist generated documents to disk."""
        path = self.data_dir / "generated_documents.json"
        try:
            path.write_text(
                json.dumps(self.generated_documents, indent=2, ensure_ascii=False)
                + "\n",
                encoding="utf-8",
            )
        except Exception as err:
            logger.warning(f"Error saving generated documents: {err}")

    def get_application_events(
        self, user_id_or_job_id: str, job_id: str | None = None
    ) -> list[dict[str, Any]]:
        """Retrieve chronological history of application status transitions."""
        if self.repository:
            return self.repository.get_application_events(
                user_id_or_job_id, job_id=job_id
            )
        return []

    def update_application_status(
        self,
        user_id: str,
        job_id: str,
        status: str,
        notes: str = "",
        job_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Update application status and log an audit event."""
        if self.repository:
            payload: dict[str, Any] = {"status": status, "notes": notes}
            if job_data:
                payload["job_data"] = job_data
            return self.repository.upsert_user_application(
                user_id=user_id,
                job_id=job_id,
                data=payload,
            )
        return {"user_id": user_id, "job_id": job_id, "status": status}
