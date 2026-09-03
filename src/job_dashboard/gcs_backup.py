"""
Best-effort GCS object backup/restore for the local SQLite job index.

Cloud Run's default execution environment has an ephemeral filesystem: every
cold start (scale-to-zero, redeploy, crash) starts from the container image's
baked-in snapshot and discards anything written locally by a previous
instance. Mounting SQLite directly on a Cloud Storage FUSE volume is not a
safe alternative either, since GCS FUSE does not support the POSIX file
locking SQLite's WAL mode relies on and can silently corrupt the database
under concurrent access.

Instead, the SQLite files live on local disk for correct operation, and are
copied to/from a plain GCS bucket as opaque objects at safe points (startup
restore, post-refresh backup) — never mounted or written to concurrently by
more than one process at a time.
"""
from __future__ import annotations

from pathlib import Path

from .logging import get_logger

logger = get_logger("job_dashboard.gcs_backup")

# Keep SQLite files as opaque objects; do not mount the bucket as a filesystem.
BACKUP_FILENAMES = (
    "jobs.sqlite3",
    "jobs.sqlite3-wal",
    "jobs.sqlite3-shm",
    "health.sqlite3",
    "health.sqlite3-wal",
    "health.sqlite3-shm",
    "jobs.json",
)


def _get_client():
    try:
        from google.cloud import storage
    except ImportError:
        logger.warning("google-cloud-storage not installed; GCS backup/restore disabled")
        return None
    try:
        return storage.Client()
    except Exception as error:
        logger.warning(f"Could not create GCS client: {error}")
        return None


def restore_from_gcs(bucket_name: str | None, data_dir: Path) -> int:
    """Download the last known-good index into data_dir if missing locally. Returns files restored."""
    if not bucket_name:
        return 0
    client = _get_client()
    if client is None:
        return 0

    restored = 0
    try:
        bucket = client.bucket(bucket_name)
        # Restore each database independently: the job index may be present
        # in the image while health history exists only in GCS.
        for filename in BACKUP_FILENAMES:
            if (data_dir / filename).exists():
                continue
            if filename.endswith("-wal") or filename.endswith("-shm"):
                base = filename.removesuffix("-wal").removesuffix("-shm")
                if not (data_dir / base).exists():
                    continue
            blob = bucket.blob(filename)
            if blob.exists():
                data_dir.mkdir(parents=True, exist_ok=True)
                blob.download_to_filename(str(data_dir / filename))
                restored += 1
        if restored:
            logger.info(f"Restored {restored} data file(s) from gs://{bucket_name}")
    except Exception as error:
        logger.warning(f"GCS restore failed, starting with a fresh/baked-in index: {error}")
    return restored


def backup_to_gcs(bucket_name: str | None, data_dir: Path) -> int:
    """Upload the current index to GCS so it survives the next cold start. Returns files uploaded."""
    if not bucket_name:
        return 0
    client = _get_client()
    if client is None:
        return 0

    uploaded = 0
    try:
        bucket = client.bucket(bucket_name)
        for filename in BACKUP_FILENAMES:
            local_path = data_dir / filename
            if local_path.exists():
                blob = bucket.blob(filename)
                # Reload metadata to obtain current generation for optimistic concurrency
                generation_match = None
                try:
                    blob.reload()
                    generation_match = blob.generation
                except Exception:
                    # Blob doesn't exist yet; condition on non-existence (generation 0)
                    generation_match = 0

                try:
                    blob.upload_from_filename(
                        str(local_path),
                        if_generation_match=generation_match,
                    )
                    uploaded += 1
                except Exception as upload_err:
                    logger.warning(
                        f"GCS backup precondition failed for {filename} (concurrent writer detected): {upload_err}"
                    )
        if uploaded:
            logger.info(f"Backed up {uploaded} data file(s) to gs://{bucket_name}")
    except Exception as error:
        logger.warning(f"GCS backup failed (index remains local-only until next successful backup): {error}")
    return uploaded
