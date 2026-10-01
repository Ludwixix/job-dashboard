"""Two-tier Finite State Machine (Macro Stage + Micro-Event) for Job Dashboard.

This module formalizes the job application lifecycle into two tiers:
1. Macro Stages: High-level funnel stages (LEAD, SAVED, APPLIED, INTERVIEWING, OFFER, CLOSED).
2. Micro-Events: Granular, timestamped operational events that drive stage transitions
   and record chronological activity.
"""

from __future__ import annotations

from enum import Enum


class MacroStage(str, Enum):
    """High-level lifecycle funnel stages for job applications."""

    LEAD = "LEAD"
    SAVED = "SAVED"
    APPLIED = "APPLIED"
    INTERVIEWING = "INTERVIEWING"
    OFFER = "OFFER"
    CLOSED = "CLOSED"


class MicroEventType(str, Enum):
    """Discrete operational milestones and timeline events."""

    # Ingress / LEAD & SAVED
    LEAD_IMPORTED = "LEAD_IMPORTED"
    SOURCED_MANUALLY = "SOURCED_MANUALLY"
    DOSSIER_COMPILED = "DOSSIER_COMPILED"
    ASSETS_TAILORED = "ASSETS_TAILORED"
    LEAD_DISMISSED = "LEAD_DISMISSED"

    # APPLIED
    APPLICATION_SUBMITTED = "APPLICATION_SUBMITTED"
    REFERRAL_REQUESTED = "REFERRAL_REQUESTED"
    OUTREACH_SENT = "OUTREACH_SENT"
    FOLLOW_UP_SENT = "FOLLOW_UP_SENT"
    INSTANT_REJECTION = "INSTANT_REJECTION"
    OUTREACH_GHOSTED = "OUTREACH_GHOSTED"

    # INTERVIEWING
    SCREEN_SCHEDULED = "SCREEN_SCHEDULED"
    ASSESSMENT_RECEIVED = "ASSESSMENT_RECEIVED"
    PANEL_SCHEDULED = "PANEL_SCHEDULED"
    INTERVIEW_COMPLETED = "INTERVIEW_COMPLETED"
    INTERVIEW_REJECTION = "INTERVIEW_REJECTION"
    CANDIDATE_WITHDRAWN = "CANDIDATE_WITHDRAWN"

    # OFFER
    OFFER_RECEIVED = "OFFER_RECEIVED"
    COUNTER_OFFER_SENT = "COUNTER_OFFER_SENT"
    OFFER_ACCEPTED = "OFFER_ACCEPTED"
    OFFER_DECLINED = "OFFER_DECLINED"
    OFFER_RESCINDED = "OFFER_RESCINDED"

    # GENERAL TERMINAL
    REJECTED = "REJECTED"
    GHOSTED = "GHOSTED"


class StateTransitionError(ValueError):
    """Raised when an invalid state transition or micro-event is requested."""

    def __init__(
        self,
        current_stage: str,
        event_type: str,
        message: str | None = None,
        target_stage: str | None = None,
    ):
        self.current_stage = current_stage
        self.event_type = event_type
        self.target_stage = target_stage
        detail = message or (
            f"Invalid transition: Cannot execute event '{event_type}' from macro stage '{current_stage}'"
            + (f" to '{target_stage}'" if target_stage else "")
        )
        super().__init__(detail)


# Standard default target stage when each event is processed in a given stage
# (current_stage, event_type) -> resulting_stage
TRANSITION_MAP: dict[tuple[MacroStage, MicroEventType], MacroStage] = {
    # From LEAD
    (MacroStage.LEAD, MicroEventType.LEAD_IMPORTED): MacroStage.LEAD,
    (MacroStage.LEAD, MicroEventType.SOURCED_MANUALLY): MacroStage.LEAD,
    (MacroStage.LEAD, MicroEventType.DOSSIER_COMPILED): MacroStage.LEAD,
    (MacroStage.LEAD, MicroEventType.ASSETS_TAILORED): MacroStage.LEAD,
    (MacroStage.LEAD, MicroEventType.APPLICATION_SUBMITTED): MacroStage.APPLIED,
    (MacroStage.LEAD, MicroEventType.OUTREACH_SENT): MacroStage.APPLIED,
    (MacroStage.LEAD, MicroEventType.LEAD_DISMISSED): MacroStage.CLOSED,
    (MacroStage.LEAD, MicroEventType.REJECTED): MacroStage.CLOSED,
    (MacroStage.LEAD, MicroEventType.GHOSTED): MacroStage.CLOSED,
    (MacroStage.LEAD, MicroEventType.INSTANT_REJECTION): MacroStage.CLOSED,
    (MacroStage.LEAD, MicroEventType.CANDIDATE_WITHDRAWN): MacroStage.CLOSED,
    # From SAVED
    (MacroStage.SAVED, MicroEventType.DOSSIER_COMPILED): MacroStage.SAVED,
    (MacroStage.SAVED, MicroEventType.ASSETS_TAILORED): MacroStage.SAVED,
    (MacroStage.SAVED, MicroEventType.APPLICATION_SUBMITTED): MacroStage.APPLIED,
    (MacroStage.SAVED, MicroEventType.OUTREACH_SENT): MacroStage.APPLIED,
    (MacroStage.SAVED, MicroEventType.LEAD_DISMISSED): MacroStage.CLOSED,
    (MacroStage.SAVED, MicroEventType.REJECTED): MacroStage.CLOSED,
    (MacroStage.SAVED, MicroEventType.GHOSTED): MacroStage.CLOSED,
    (MacroStage.SAVED, MicroEventType.CANDIDATE_WITHDRAWN): MacroStage.CLOSED,
    # From APPLIED
    (MacroStage.APPLIED, MicroEventType.APPLICATION_SUBMITTED): MacroStage.APPLIED,
    (MacroStage.APPLIED, MicroEventType.REFERRAL_REQUESTED): MacroStage.APPLIED,
    (MacroStage.APPLIED, MicroEventType.OUTREACH_SENT): MacroStage.APPLIED,
    (MacroStage.APPLIED, MicroEventType.FOLLOW_UP_SENT): MacroStage.APPLIED,
    (MacroStage.APPLIED, MicroEventType.ASSETS_TAILORED): MacroStage.APPLIED,
    (MacroStage.APPLIED, MicroEventType.SCREEN_SCHEDULED): MacroStage.INTERVIEWING,
    (MacroStage.APPLIED, MicroEventType.ASSESSMENT_RECEIVED): MacroStage.INTERVIEWING,
    (MacroStage.APPLIED, MicroEventType.INTERVIEW_COMPLETED): MacroStage.INTERVIEWING,
    (MacroStage.APPLIED, MicroEventType.REJECTED): MacroStage.CLOSED,
    (MacroStage.APPLIED, MicroEventType.GHOSTED): MacroStage.CLOSED,
    (MacroStage.APPLIED, MicroEventType.INSTANT_REJECTION): MacroStage.CLOSED,
    (MacroStage.APPLIED, MicroEventType.OUTREACH_GHOSTED): MacroStage.CLOSED,
    (MacroStage.APPLIED, MicroEventType.CANDIDATE_WITHDRAWN): MacroStage.CLOSED,
    # From INTERVIEWING
    (MacroStage.INTERVIEWING, MicroEventType.SCREEN_SCHEDULED): MacroStage.INTERVIEWING,
    (
        MacroStage.INTERVIEWING,
        MicroEventType.ASSESSMENT_RECEIVED,
    ): MacroStage.INTERVIEWING,
    (MacroStage.INTERVIEWING, MicroEventType.PANEL_SCHEDULED): MacroStage.INTERVIEWING,
    (
        MacroStage.INTERVIEWING,
        MicroEventType.INTERVIEW_COMPLETED,
    ): MacroStage.INTERVIEWING,
    (MacroStage.INTERVIEWING, MicroEventType.FOLLOW_UP_SENT): MacroStage.INTERVIEWING,
    (MacroStage.INTERVIEWING, MicroEventType.ASSETS_TAILORED): MacroStage.INTERVIEWING,
    (MacroStage.INTERVIEWING, MicroEventType.OFFER_RECEIVED): MacroStage.OFFER,
    (MacroStage.INTERVIEWING, MicroEventType.INTERVIEW_REJECTION): MacroStage.CLOSED,
    (MacroStage.INTERVIEWING, MicroEventType.REJECTED): MacroStage.CLOSED,
    (MacroStage.INTERVIEWING, MicroEventType.GHOSTED): MacroStage.CLOSED,
    (MacroStage.INTERVIEWING, MicroEventType.CANDIDATE_WITHDRAWN): MacroStage.CLOSED,
    # From OFFER
    (MacroStage.OFFER, MicroEventType.OFFER_RECEIVED): MacroStage.OFFER,
    (MacroStage.OFFER, MicroEventType.COUNTER_OFFER_SENT): MacroStage.OFFER,
    (MacroStage.OFFER, MicroEventType.OFFER_ACCEPTED): MacroStage.CLOSED,
    (MacroStage.OFFER, MicroEventType.OFFER_DECLINED): MacroStage.CLOSED,
    (MacroStage.OFFER, MicroEventType.OFFER_RESCINDED): MacroStage.CLOSED,
    (MacroStage.OFFER, MicroEventType.REJECTED): MacroStage.CLOSED,
    (MacroStage.OFFER, MicroEventType.GHOSTED): MacroStage.CLOSED,
    (MacroStage.OFFER, MicroEventType.CANDIDATE_WITHDRAWN): MacroStage.CLOSED,
}


def normalize_macro_stage(stage: str | MacroStage) -> MacroStage:
    """Normalize input string or Enum to a valid MacroStage."""
    if isinstance(stage, MacroStage):
        return stage
    clean = str(stage).strip().upper()
    try:
        return MacroStage(clean)
    except ValueError:
        raise StateTransitionError(
            current_stage=clean,
            event_type="",
            message=f"Unknown macro stage '{stage}'. Must be one of {[s.value for s in MacroStage]}.",
        )


def normalize_event_type(event_type: str | MicroEventType) -> MicroEventType:
    """Normalize input string or Enum to a valid MicroEventType."""
    if isinstance(event_type, MicroEventType):
        return event_type
    clean = str(event_type).strip().upper()
    try:
        return MicroEventType(clean)
    except ValueError:
        raise StateTransitionError(
            current_stage="",
            event_type=clean,
            message=f"Unknown micro-event type '{event_type}'. Must be one of {[e.value for e in MicroEventType]}.",
        )


def is_terminal_stage(stage: str | MacroStage) -> bool:
    """Check if the given stage is a terminal state (CLOSED)."""
    return normalize_macro_stage(stage) == MacroStage.CLOSED


def get_valid_events_for_stage(stage: str | MacroStage) -> list[MicroEventType]:
    """Return all micro-events that can be legitimately dispatched from the given stage."""
    m_stage = normalize_macro_stage(stage)
    if m_stage == MacroStage.CLOSED:
        return []
    return [event for (st, event) in TRANSITION_MAP if st == m_stage]


def validate_transition(
    current_stage: str | MacroStage,
    event_type: str | MicroEventType,
    requested_stage: str | MacroStage | None = None,
) -> MacroStage:
    """Validate and compute the target macro stage for an event dispatch.

    Args:
        current_stage: The current macro stage of the application.
        event_type: The micro-event being appended to the timeline.
        requested_stage: Optional explicit target stage requested by caller.

    Returns:
        The resulting MacroStage.

    Raises:
        StateTransitionError: If the transition is prohibited or illegal.
    """
    curr = normalize_macro_stage(current_stage)
    evt = normalize_event_type(event_type)

    if curr == MacroStage.CLOSED:
        raise StateTransitionError(
            current_stage=curr.value,
            event_type=evt.value,
            message=f"Application is in terminal state '{curr.value}'. No further events or transitions are permitted.",
        )

    # Allow LEAD -> SAVED promotion if explicitly requested
    if curr == MacroStage.LEAD and requested_stage:
        req = normalize_macro_stage(requested_stage)
        if req == MacroStage.SAVED and evt in (
            MicroEventType.LEAD_IMPORTED,
            MicroEventType.SOURCED_MANUALLY,
            MicroEventType.DOSSIER_COMPILED,
            MicroEventType.ASSETS_TAILORED,
        ):
            return MacroStage.SAVED

    key = (curr, evt)
    if key not in TRANSITION_MAP:
        raise StateTransitionError(
            current_stage=curr.value,
            event_type=evt.value,
            message=(
                f"Prohibited transition: Event '{evt.value}' is not valid for application in '{curr.value}' stage. "
                f"Valid events for '{curr.value}' are: {[e.value for e in get_valid_events_for_stage(curr)]}"
            ),
        )

    natural_next = TRANSITION_MAP[key]

    if requested_stage:
        req = normalize_macro_stage(requested_stage)
        # If caller requested a specific stage, it must match natural next or be a valid variant
        if req != natural_next and not (
            curr == MacroStage.LEAD and req == MacroStage.SAVED
        ):
            raise StateTransitionError(
                current_stage=curr.value,
                event_type=evt.value,
                target_stage=req.value,
                message=(
                    f"Conflicting target stage: Event '{evt.value}' moves '{curr.value}' -> '{natural_next.value}', "
                    f"which conflicts with requested stage '{req.value}'."
                ),
            )
        return req

    return natural_next
