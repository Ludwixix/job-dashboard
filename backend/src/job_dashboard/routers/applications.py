"""Applications router for tracking candidate applications, events, and stages."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict

from ..repository import JobRepository
from ..security import decode_token

router = APIRouter(tags=["Applications"])


def get_repo(request: Request) -> JobRepository:
    return request.app.state.repository


def get_current_user_id(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    user_id: Optional[str] = Query(default=None),
    demo: Optional[str] = Query(default=None),
) -> str:
    """Resolve current user ID from JWT, header, or query parameters."""
    if x_user_id:
        return x_user_id.strip()
    if user_id:
        return user_id.strip()
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        payload = decode_token(token)
        if payload and "sub" in payload:
            return str(payload["sub"])
    if demo == "true":
        return "demo_user"
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Provide Authorization token or X-User-Id header.",
    )


class ApplicationUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    job_id: Optional[str] = None
    id: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    status: Optional[str] = None
    applied_at: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None


class ApplicationSyncRequest(BaseModel):
    applications: List[Dict[str, Any]]


@router.get("/api/applications")
async def list_applications(
    user_id: str = Depends(get_current_user_id),
    repo: JobRepository = Depends(get_repo),
) -> Dict[str, Any]:
    """List tracked applications for current candidate."""
    apps = repo.get_user_applications(user_id)
    return {"success": True, "applications": apps}


@router.post("/api/applications")
async def upsert_application(
    payload: Dict[str, Any],
    user_id: str = Depends(get_current_user_id),
    repo: JobRepository = Depends(get_repo),
) -> Dict[str, Any]:
    """Create or update candidate job application stage."""
    job_id = str(payload.get("job_id") or payload.get("id") or "").strip()
    if not job_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing job_id",
        )

    app_rec = repo.upsert_user_application(user_id, job_id, payload)
    return {"success": True, "application": app_rec}


@router.post("/api/applications/sync")
async def sync_applications(
    payload: ApplicationSyncRequest,
    user_id: str = Depends(get_current_user_id),
    repo: JobRepository = Depends(get_repo),
) -> Dict[str, Any]:
    """Batch synchronize client application states to backend repository."""
    synced = []
    for item in payload.applications:
        job_id = str(item.get("job_id") or item.get("id") or "").strip()
        if job_id:
            rec = repo.upsert_user_application(user_id, job_id, item)
            synced.append(rec)
    return {"success": True, "count": len(synced), "applications": synced}


@router.get("/api/applications/{job_id}/events")
async def get_application_events(
    job_id: str,
    user_id: str = Depends(get_current_user_id),
    repo: JobRepository = Depends(get_repo),
) -> Dict[str, Any]:
    """Retrieve full audit timeline / activity events for an application."""
    events = repo.get_application_events(user_id, job_id)
    return {"success": True, "job_id": job_id, "events": events}
