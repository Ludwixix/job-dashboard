"""
job_dashboard.services
~~~~~~~~~~~~~~~~~~~~~~
Modular domain services decomposed from DashboardApp:
- JobIndexService: In-memory dual-indexed job cache and persistence.
- ScrapeOrchestrationService: Multi-source scraper pipeline and single-flight queue coordinator.
- ApplicationWorkflowService: Kanban pipeline, CRM relations, and document generation workflows.
"""

from .job_index import JobIndexService
from .scrape_orchestrator import ScrapeOrchestrationService
from .application_workflow import ApplicationWorkflowService

__all__ = [
    "JobIndexService",
    "ScrapeOrchestrationService",
    "ApplicationWorkflowService",
]
