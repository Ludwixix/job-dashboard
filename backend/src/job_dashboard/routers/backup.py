"""Cloud Storage Backup & Snapshot Management Router."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

from ..gcs_backup import get_backup_status, create_backup_snapshot

router = APIRouter(prefix="/api/backup", tags=["Backup & Storage"])


def _get_data_dir_and_bucket(request: Request) -> tuple[Path, Optional[str]]:
    data_dir_str = getattr(request.app.state, "data_dir", None)
    if data_dir_str:
        data_dir = Path(data_dir_str)
    else:
        env_dir = os.getenv("JOB_DASHBOARD_DATA_DIR")
        data_dir = Path(env_dir) if env_dir else Path.cwd() / "data"

    bucket_name = (
        os.getenv("JOB_DASHBOARD_GCS_DATA_BUCKET")
        or os.getenv("JOB_DASHBOARD_GCS_BUCKET")
        or os.getenv("GCS_BUCKET_NAME")
    )
    return data_dir, bucket_name


class SnapshotRequest(BaseModel):
    snapshot_tag: Optional[str] = None


@router.get("/status")
async def get_status(request: Request) -> Dict[str, Any]:
    """Inspect local database assets and Google Cloud Storage backup readiness."""
    data_dir, bucket_name = _get_data_dir_and_bucket(request)
    return get_backup_status(bucket_name, data_dir)


@router.post("/snapshot")
async def trigger_snapshot(
    request: Request,
    payload: Optional[SnapshotRequest] = None,
) -> Dict[str, Any]:
    """Trigger a persistent backup snapshot of SQLite databases and configuration."""
    data_dir, bucket_name = _get_data_dir_and_bucket(request)
    tag = payload.snapshot_tag if payload else None
    return create_backup_snapshot(bucket_name, data_dir, snapshot_tag=tag)
