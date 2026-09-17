"""Morning Opportunity Digest router (Phase 5.2)."""

from __future__ import annotations

import os
from typing import Any, Dict, Optional
import urllib.request
import json

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from ..digest import (
    generate_morning_digest,
    format_slack_digest_blocks,
    format_markdown_digest,
    format_html_digest,
)
from ..repository import JobRepository

router = APIRouter(prefix="/api/digest", tags=["Digest & Notifications"])


def get_repo(request: Request) -> JobRepository:
    return request.app.state.repository


class DigestDispatchRequest(BaseModel):
    webhook_url: Optional[str] = None
    min_score: int = 85
    limit: int = 5


@router.get("/preview")
async def preview_digest(
    min_score: int = Query(85, ge=50, le=100),
    limit: int = Query(5, ge=1, le=25),
    repo: JobRepository = Depends(get_repo),
) -> Dict[str, Any]:
    """Generates a preview of the morning opportunity digest."""
    jobs = repo.list_jobs(match_score_min=min_score)
    digest_data = generate_morning_digest(jobs, min_score=min_score, limit=limit)
    slack_blocks = format_slack_digest_blocks(digest_data)
    markdown_text = format_markdown_digest(digest_data)

    return {
        "status": "success",
        "digest": digest_data,
        "slack_blocks": slack_blocks,
        "markdown": markdown_text,
    }


@router.post("/dispatch")
async def dispatch_digest(
    payload: DigestDispatchRequest,
    repo: JobRepository = Depends(get_repo),
) -> Dict[str, Any]:
    """Dispatches the morning opportunity digest to an external webhook (e.g. Slack)."""
    jobs = repo.list_jobs(match_score_min=payload.min_score)
    digest_data = generate_morning_digest(jobs, min_score=payload.min_score, limit=payload.limit)
    slack_blocks = format_slack_digest_blocks(digest_data)

    target_webhook = payload.webhook_url or os.environ.get("SLACK_WEBHOOK_URL")

    if not target_webhook:
        return {
            "status": "dry_run",
            "message": "No webhook URL provided or configured in environment. Digest rendered successfully.",
            "digest": digest_data,
            "slack_blocks": slack_blocks,
        }

    # Transmit to webhook
    req = urllib.request.Request(
        target_webhook,
        data=json.dumps({"blocks": slack_blocks}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        status_code = response.getcode()

    return {
        "status": "dispatched",
        "http_code": status_code,
        "total_opportunities": len(digest_data.get("top_opportunities", [])),
    }
