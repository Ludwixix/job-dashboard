"""
interview_influence.py
----------------------
Post-Interview Tactical Intelligence, Objection Overcoming & Executive Referee Alignment Hub ("Post-Interview Influence Hub").
Provides data structures, health scoring, objection-overcoming memos, and referee briefing alignment packs.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

INTERVIEW_STAGES = (
    "Initial Screening & HR",
    "Hiring Manager Deep Dive",
    "Technical & Architecture",
    "Panel Interview",
    "Stakeholder & Cross-Functional",
    "Final Executive & Board",
)

PANEL_SENTIMENTS = (
    "Strong Positive",
    "Leaning Positive",
    "Neutral / Ambiguous",
    "High Friction",
)

@dataclass
class InterviewDebrief:
    job_id: str
    stage: str
    interview_date: str
    panel_names: str
    panel_sentiment: str
    topics_covered: list[str] = field(default_factory=list)
    perceived_objections: list[str] = field(default_factory=list)
    promised_decision_date: str | None = None
    notes: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> InterviewDebrief:
        return cls(
            job_id=str(data.get("job_id", "")),
            stage=str(data.get("stage", "Technical & Architecture")),
            interview_date=str(data.get("interview_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))),
            panel_names=str(data.get("panel_names", "")),
            panel_sentiment=str(data.get("panel_sentiment", "Leaning Positive")),
            topics_covered=list(data.get("topics_covered", [])),
            perceived_objections=list(data.get("perceived_objections", [])),
            promised_decision_date=data.get("promised_decision_date"),
            notes=str(data.get("notes", "")),
            created_at=str(data.get("created_at", datetime.now(timezone.utc).isoformat())),
        )


def evaluate_influence_health(debrief: InterviewDebrief) -> dict[str, Any]:
    """Evaluates post-interview tactical posture, objection severity, and next-step actions."""
    sentiment_weights = {
        "Strong Positive": 90,
        "Leaning Positive": 75,
        "Neutral / Ambiguous": 55,
        "High Friction": 35,
    }
    base_score = sentiment_weights.get(debrief.panel_sentiment, 65)
    objection_penalty = len(debrief.perceived_objections) * 10
    score = max(20, min(100, base_score - objection_penalty))

    if score >= 75:
        status = "High Conviction"
        recommended_action = "Send brief value-add reinforcement memo"
    elif score >= 55:
        status = "Cautious / Balanced"
        recommended_action = "Clarify scope, address ambiguities, and prepare referee alignment"
    else:
        status = "Objection Overcoming Required"
        recommended_action = "Execute targeted objection mitigation memo with tangible proof artifacts"

    action_items = []
    if debrief.perceived_objections:
        for obj in debrief.perceived_objections:
            action_items.append(f"Mitigate panel objection: '{obj}' with measurable project documentation.")
    else:
        action_items.append("Reinforce primary discussion themes and confirm reference readiness.")

    if debrief.promised_decision_date:
        action_items.append(f"Set calendar milestone for promised decision date: {debrief.promised_decision_date}.")

    action_items.append("Pre-brief selected referees with tailored STAR talking points matching the panel's focus.")

    return {
        "score": score,
        "status": status,
        "recommended_action": recommended_action,
        "action_items": action_items,
        "objection_count": len(debrief.perceived_objections),
    }

def generate_objection_resolution_memo(job: dict[str, Any], debrief: InterviewDebrief, profile: dict[str, Any]) -> dict[str, str]:
    """
    Formulates a surgical, value-adding follow-up letter that resolves panel objections
    with concrete proof points without sounding desperate or cliché.
    """
    company = job.get("company", "the team")
    title = job.get("title", "the role")
    candidate_name = profile.get("name", "Candidate")
    first_panel_name = debrief.panel_names.split(",")[0].split("(")[0].strip() or "Hiring Panel"

    subject = f"RE: Technical Debrief & Value Add — {title} ({company})"

    objection_paragraphs = []
    if debrief.perceived_objections:
        for obj in debrief.perceived_objections:
            clean_obj = obj.rstrip(".")
            objection_paragraphs.append(
                f"Reflecting on our conversation around {clean_obj}, I wanted to share a concrete example from my recent project delivery. In a parallel environment, we solved this by implementing strict automated rollback routines, validated in staging pipelines prior to production cutover. This approach eliminated downtime variance and gave operational stakeholders immediate assurance."
            )
    else:
        objection_paragraphs.append(
            f"Our discussion regarding the strategic priorities for {title} reinforced my conviction that my experience standardizing operating procedures, accelerating delivery velocity, and establishing resilient cross-functional workflows aligns directly with {company}'s immediate milestones."
        )

    topics_summary = ", ".join(debrief.topics_covered) if debrief.topics_covered else "operational scalability and core system resilience"

    body = f"""Hi {first_panel_name},

Thank you for the thoughtful discussion today regarding the {title} opportunity at {company}. I appreciated digging into your focus on {topics_summary}.

{chr(10).join(objection_paragraphs)}

As discussed, I am fully prepared to commence without ramp-up latency and would welcome the opportunity to partner with the team. Please let me know if any additional technical context or portfolio artifacts would be helpful as you evaluate next steps.

Sincerely,
{candidate_name}
{profile.get('title', '')}
{profile.get('phone', '')} | {profile.get('email', '')}"""

    return {
        "subject": subject,
        "body": body,
        "recipient_names": debrief.panel_names,
    }


def generate_referee_alignment_pack(
    job: dict[str, Any],
    debrief: InterviewDebrief,
    referee_name: str,
    referee_title: str,
    referee_relationship: str,
    profile: dict[str, Any]
) -> dict[str, Any]:
    """
    Generates a 1-page alignment briefing for the candidate's referee, equipping them
    with the exact STAR project proof points and talking points matching the role's priorities.
    """
    company = job.get("company", "Target Organization")
    title = job.get("title", "Target Role")
    cand_name = profile.get("name", "Candidate")

    topics_list = debrief.topics_covered or ["Operational Reliability", "Process Standardization", "Autonomous Delivery"]
    objections_list = debrief.perceived_objections or ["Verification of autonomous problem-solving under tight SLA windows"]

    star_points = []
    for topic in topics_list[:3]:
        star_points.append({
            "dimension": topic,
            "situation": f"When working on cross-functional initiatives requiring {topic}.",
            "task": f"Deliver measurable stability and stakeholder transparency under {company}'s operating framework.",
            "talking_point": f"Can speak to {cand_name}'s high-ownership execution, technical pragmatism, and meticulous documentation standard."
        })

    for obj in objections_list[:2]:
        star_points.append({
            "dimension": f"Panel Alignment: {obj}",
            "situation": f"Addressing panel inquiry regarding {obj}.",
            "task": "Demonstrate proven precedent and verified production reliability.",
            "talking_point": f"Emphasize that {cand_name} consistently operates with proactive risk management, clear escalation protocols, and zero complacency."
        })

    briefing_doc = f"""# EXECUTIVE REFEREE ALIGNMENT BRIEFING

**Candidate:** {cand_name}  
**Referee:** {referee_name} ({referee_title} — {referee_relationship})  
**Target Organization:** {company}  
**Target Role:** {title}  
**Interview Stage Completed:** {debrief.stage}  
**Panel Contact(s):** {debrief.panel_names}  
**Expected Contact Window:** Approx. 24–48 hours prior to {debrief.promised_decision_date or 'offer stage'}

---

## 1. Context & Role Rationale
{company} is currently looking for an experienced, high-trust practitioner in {title}. During the {debrief.stage} interview, the panel focused heavily on:
{chr(10).join(f"- **{t}**" for t in topics_list)}

---

## 2. Recommended Alignment Points & STAR Precedents
When the recruitment team or hiring manager connects with you, highlighting the following competencies will provide decisive proof:

{chr(10).join(f"### • {p['dimension']}{chr(10)}**Talking Point:** {p['talking_point']}{chr(10)}" for p in star_points)}

---

## 3. Candidate Value Proposition
- **Operating Posture:** Pragmatic, proactive, structured, and documentation-first.
- **Team Dynamic:** Low-ego collaborator who communicates with clarity and protects system uptime/clinical safety/fiscal rigor.

*Thank you for taking the time to provide this reference. Please let {cand_name} know if the hiring team makes contact!*
"""

    return {
        "referee_name": referee_name,
        "referee_title": referee_title,
        "referee_relationship": referee_relationship,
        "briefing_document": briefing_doc,
        "targeted_star_talking_points": star_points,
    }
