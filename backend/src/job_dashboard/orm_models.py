"""SQLAlchemy 2.0 ORM models for Job Dashboard applications and events.

Defines JobApplication with version-based Optimistic Concurrency Control (OCC)
via __mapper_args__ = {"version_id_col": version}, and ApplicationEvent mapping
to the existing SQLite schema.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from .state_machine import MacroStage


class Base(DeclarativeBase):
    """Base declarative class for Job Dashboard ORM models."""



class JobApplication(Base):
    """Candidate job application record mapped to 'user_applications' table.

    Enforces Optimistic Concurrency Control (OCC) via the 'version' column:
    SQLAlchemy ensures updates verify WHERE version = :version and increments
    version on every UPDATE statement.
    """

    __tablename__ = "user_applications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    job_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="sourced", nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    resume_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    cover_letter_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    resume_url: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    cover_letter_url: Mapped[str] = mapped_column(
        String(512), default="", nullable=False
    )
    applied_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    job_data_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)

    # OCC & Two-Tier State Machine columns
    macro_stage: Mapped[str] = mapped_column(
        String(32),
        default=MacroStage.LEAD.value,
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    updated_at: Mapped[str] = mapped_column(
        String(64),
        default=lambda: datetime.now(timezone.utc).isoformat(),
        nullable=False,
    )

    events: Mapped[list[ApplicationEvent]] = relationship(
        "ApplicationEvent",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="desc(ApplicationEvent.created_at)",
    )

    __table_args__ = (
        UniqueConstraint("user_id", "job_id", name="uq_user_applications_user_job"),
    )

    __mapper_args__ = {
        "version_id_col": version,
    }

    def to_dict(self) -> dict[str, Any]:
        """Convert ORM model to dictionary matching API response structure."""
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "job_id": self.job_id,
            "status": self.status,
            "notes": self.notes,
            "resume_text": self.resume_text,
            "cover_letter_text": self.cover_letter_text,
            "resume_url": self.resume_url,
            "cover_letter_url": self.cover_letter_url,
            "applied_at": self.applied_at,
            "macro_stage": self.macro_stage,
            "version": self.version,
            "updated_at": self.updated_at,
        }
        try:
            extra = json.loads(self.job_data_json or "{}")
            if isinstance(extra, dict):
                for k, v in extra.items():
                    if k not in data or not data[k]:
                        data[k] = v
        except Exception:
            pass
        return data


class ApplicationEvent(Base):
    """Discrete, timestamped operational event record mapped to 'user_application_events'."""

    __tablename__ = "user_application_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    application_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("user_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    idempotency_key: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
        unique=True,
        index=True,
    )
    payload_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    created_at: Mapped[str] = mapped_column(
        String(64),
        default=lambda: datetime.now(timezone.utc).isoformat(),
        nullable=False,
    )

    application: Mapped[JobApplication] = relationship(
        "JobApplication",
        back_populates="events",
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert ORM model to dictionary matching API response structure."""
        return {
            "id": self.id,
            "application_id": self.application_id,
            "event_type": self.event_type,
            "idempotency_key": self.idempotency_key,
            "payload_json": self.payload_json,
            "created_at": self.created_at,
        }
