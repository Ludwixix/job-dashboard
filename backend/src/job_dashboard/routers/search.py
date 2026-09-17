"""Search criteria and saved searches router."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel

from ..repository import JobRepository
from ..scrape import resolve_cli_queries

router = APIRouter(tags=["Search & Discovery Criteria"])


def get_repo(request: Request) -> JobRepository:
    return request.app.state.repository


class SavedSearchPayload(BaseModel):
    name: str
    query: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None


@router.get("/api/search-criteria")
async def get_search_criteria(repo: JobRepository = Depends(get_repo)) -> Dict[str, Any]:
    """Retrieve active automated scraper query terms."""
    queries = resolve_cli_queries(None)
    return {
        "queries": [
            {
                "term": q.term,
                "location": q.location,
                "stream": q.stream,
                "group": q.group,
                "weight": q.weight,
                "exclude_terms": list(q.exclude_terms),
                "enabled": q.enabled,
            }
            for q in queries
        ]
    }


@router.get("/api/search-criteria/defaults")
async def get_default_search_criteria() -> Dict[str, Any]:
    """Retrieve default recommended discovery query terms."""
    queries = resolve_cli_queries(None)
    return {
        "queries": [
            {
                "term": q.term,
                "location": q.location,
                "stream": q.stream,
            }
            for q in queries[:5]
        ]
    }


@router.get("/api/saved-searches")
async def get_saved_searches(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    user_id: Optional[str] = Query(default=None),
    repo: JobRepository = Depends(get_repo),
) -> Dict[str, Any]:
    """Retrieve user-saved custom search query profiles."""
    active_user = x_user_id or user_id or "default_user"
    searches = repo.get_saved_searches(active_user)
    return {"success": True, "saved_searches": searches}


@router.post("/api/saved-searches")
async def save_search(
    payload: SavedSearchPayload,
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    user_id: Optional[str] = Query(default=None),
    repo: JobRepository = Depends(get_repo),
) -> Dict[str, Any]:
    """Create a new saved search filter configuration."""
    active_user = x_user_id or user_id or "default_user"
    saved = repo.create_saved_search(
        user_id=active_user,
        name=payload.name,
        query=payload.query or "",
        filters=payload.filters or {},
    )
    return {"success": True, "saved_search": saved}

