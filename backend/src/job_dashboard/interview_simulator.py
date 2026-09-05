from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any

from .cache import get_cache
from .logging import get_logger
from .sources.base import detect_query_stream

logger = get_logger("job_dashboard.interview_simulator")


INDUSTRY_QUESTION_BANKS: dict[str, list[dict[str, Any]]] = {
    "healthcare": [
        {
            "id": "q1",
            "text": "Describe a clinical situation where a patient's vital signs deteriorated rapidly (MET call criteria). Walk through your clinical assessment, ISBAR communication, and immediate interventions.",
            "type": "clinical_acuity",
            "difficulty": "hard",
        },
        {
            "id": "q2",
            "text": "How do you ensure strict medication safety, 5 rights verification, and AHPRA / NSQHS compliance when handling high-risk pharmaceuticals or IV infusions?",
            "type": "patient_safety",
            "difficulty": "medium",
        },
        {
            "id": "q3",
            "text": "Give an example of managing a difficult clinical confrontation or de-escalating an anxious, distressed patient or family member regarding their treatment plan.",
            "type": "patient_advocacy",
            "difficulty": "medium",
        },
        {
            "id": "q4",
            "text": "How do you maintain documentation integrity and clinical handover continuity using electronic medical records (EMR / eMR / Best Practice) during high-workload shift transitions?",
            "type": "clinical_governance",
            "difficulty": "medium",
        },
        {
            "id": "q5",
            "text": "Describe how you coordinate with multidisciplinary teams (medical officers, allied health, discharge coordinators) to plan complex patient discharges while minimizing readmission risk.",
            "type": "multidisciplinary_collaboration",
            "difficulty": "medium",
        },
    ],
    "finance": [
        {
            "id": "q1",
            "text": "Walk through your methodology when leading a high-pressure month-end or year-end financial close while ensuring strict AASB / IFRS compliance.",
            "type": "statutory_compliance",
            "difficulty": "hard",
        },
        {
            "id": "q2",
            "text": "How do you investigate, explain, and resolve significant budget vs. actual variances across complex departmental cost centres?",
            "type": "variance_analysis",
            "difficulty": "medium",
        },
        {
            "id": "q3",
            "text": "Describe your experience managing large-scale ledger reconciliations, ERP migrations (SAP, Xero, MYOB), or automating repetitive accounting workflows.",
            "type": "systems_automation",
            "difficulty": "medium",
        },
        {
            "id": "q4",
            "text": "How do you manage Australian statutory obligations, including Business Activity Statements (BAS), GST, and ATO deadlines without operational error?",
            "type": "tax_governance",
            "difficulty": "medium",
        },
        {
            "id": "q5",
            "text": "How do you effectively present complex financial data, cash-flow forecasts, and margin pressures to non-financial executives and operational leaders?",
            "type": "stakeholder_reporting",
            "difficulty": "medium",
        },
    ],
    "trades": [
        {
            "id": "q1",
            "text": "Describe a situation on an active worksite where you identified a high-risk safety hazard or non-compliance with a Safe Work Method Statement (SWMS). How did you intervene?",
            "type": "whs_safety",
            "difficulty": "hard",
        },
        {
            "id": "q2",
            "text": "How do you manage critical path delays caused by inclement weather, material supply chain disruptions, or subcontractor shortages to protect project delivery dates?",
            "type": "project_coordination",
            "difficulty": "medium",
        },
        {
            "id": "q3",
            "text": "Walk through your quality assurance procedure for pre-handover inspections and enforcing defect rectification across trade subcontractors.",
            "type": "quality_assurance",
            "difficulty": "medium",
        },
        {
            "id": "q4",
            "text": "How do you track site costs, verify progress claims against bill of quantities, and prevent unauthorized variation drift?",
            "type": "cost_control",
            "difficulty": "medium",
        },
        {
            "id": "q5",
            "text": "Describe a conflict between two subcontracting crews regarding access or site sequencing. How did you resolve the dispute while maintaining site momentum?",
            "type": "subcontractor_management",
            "difficulty": "medium",
        },
    ],
    "legal": [
        {
            "id": "q1",
            "text": "When reviewing complex commercial agreements, what indemnities, limitation of liability clauses, and termination rights do you scrutinize most rigorously to mitigate exposure?",
            "type": "contractual_risk",
            "difficulty": "hard",
        },
        {
            "id": "q2",
            "text": "How do you advise commercial stakeholders to ensure new product launches or marketing campaigns strictly comply with Australian Consumer Law (ACL) and regulatory guidelines?",
            "type": "regulatory_compliance",
            "difficulty": "medium",
        },
        {
            "id": "q3",
            "text": "Describe your approach to managing contentious dispute negotiations or pre-litigation claims to achieve commercially sensible dispute resolutions.",
            "type": "dispute_resolution",
            "difficulty": "medium",
        },
        {
            "id": "q4",
            "text": "How do you navigate potential conflicts of interest or sensitive ethical dilemmas while upholding statutory and fiduciary obligations?",
            "type": "ethics_governance",
            "difficulty": "medium",
        },
        {
            "id": "q5",
            "text": "How do you balance legal risk mitigation with commercial imperatives when business leaders are pressing for rapid deal execution?",
            "type": "executive_advisory",
            "difficulty": "medium",
        },
    ],
    "technology": [
        {
            "id": "q1",
            "text": "Describe a high-severity production outage or critical system disruption you resolved under strict SLA pressure. Walk through your triage, root cause analysis (RCA), and preventative actions.",
            "type": "incident_rca",
            "difficulty": "hard",
        },
        {
            "id": "q2",
            "text": "How would you architect and automate endpoint compliance or hybrid cloud infrastructure (Azure / AWS / M365) to ensure high availability and zero-downtime operations?",
            "type": "cloud_architecture",
            "difficulty": "medium",
        },
        {
            "id": "q3",
            "text": "Give a specific example of an end-to-end automation workflow or infrastructure-as-code script you implemented to eliminate repetitive administrative toil.",
            "type": "automation_engineering",
            "difficulty": "medium",
        },
        {
            "id": "q4",
            "text": "How do you operationalize security baseline frameworks (such as ACSC Essential 8, ISO 27001, or NIST) across operational systems without paralyzing business velocity?",
            "type": "security_hardening",
            "difficulty": "medium",
        },
        {
            "id": "q5",
            "text": "How do you effectively translate complex technical trade-offs and technical debt remediation plans into strategic business outcomes for non-technical stakeholders?",
            "type": "stakeholder_alignment",
            "difficulty": "medium",
        },
    ],
    "general": [
        {
            "id": "q1",
            "text": "Tell me about yourself, your core professional expertise, and what drew you to this opportunity.",
            "type": "behavioral",
            "difficulty": "easy",
        },
        {
            "id": "q2",
            "text": "Describe a complex, high-stakes project or initiative you managed. What was your strategic approach and outcome?",
            "type": "leadership",
            "difficulty": "medium",
        },
        {
            "id": "q3",
            "text": "Give an example of resolving a challenging disagreement or competing priorities with a key stakeholder.",
            "type": "stakeholder_management",
            "difficulty": "medium",
        },
        {
            "id": "q4",
            "text": "How do you prioritize competing deadlines and maintain quality under heavy workload pressure?",
            "type": "situational",
            "difficulty": "medium",
        },
        {
            "id": "q5",
            "text": "What do you consider your greatest professional accomplishment, and what specific metric demonstrates its success?",
            "type": "achievement",
            "difficulty": "medium",
        },
    ],
}

SECTOR_PROOF_MARKERS: dict[str, list[str]] = {
    "healthcare": [
        "ahpra", "isbar", "met", "vital", "patient", "triage", "medication", "nsqhs",
        "clinical", "care", "doctor", "ward", "infusion", "escalat", "handover", "safety"
    ],
    "finance": [
        "aasb", "ifrs", "cpa", "ca", "reconciliation", "variance", "audit", "ledger",
        "bas", "gst", "tax", "p&l", "forecast", "erp", "xero", "sap", "myob", "cost centre"
    ],
    "trades": [
        "swms", "whs", "ohs", "safework", "hazard", "site", "subcontractor", "defect",
        "inspection", "variation", "safety", "ppe", "toolbox", "pre-start", "scaffold"
    ],
    "legal": [
        "indemnity", "liability", "contract", "clause", "acl", "asic", "apra", "dispute",
        "compliance", "fiduciary", "negotiation", "settlement", "privilege", "statutory"
    ],
    "technology": [
        "sla", "outage", "rca", "cloud", "azure", "aws", "m365", "automation",
        "powershell", "script", "security", "essential 8", "incident", "backup", "ci/cd"
    ],
    "general": [
        "objective", "result", "metric", "stakeholder", "deadline", "strategy", "deliver", "achieve"
    ],
}


class InterviewSimulator:
    def __init__(self):
        self.sessions = {}
        self._question_cache = {}
        logger.info("Interview Simulator initialized")

    def create_session(self, job_description: str, role: str, question_count: int = 5) -> dict[str, Any]:
        """Create a new interview session."""
        session_id = str(uuid.uuid4())
        stream = detect_query_stream(f"{role} {job_description}")
        questions = self._generate_questions(job_description, role, question_count, stream=stream)

        session = {
            "session_id": session_id,
            "job_description": job_description,
            "role": role,
            "stream": stream,
            "created_at": datetime.now().isoformat(),
            "questions": questions,
            "answers": {},
            "completed": False,
        }

        self.sessions[session_id] = session
        return {
            "session_id": session_id,
            "role": role,
            "stream": stream,
            "questions": questions,
            "total_questions": len(questions),
        }

    def _generate_questions(
        self, job_description: str, role: str, count: int, stream: str | None = None
    ) -> list[dict[str, Any]]:
        """Generate interview questions tailored to candidate industry stream."""
        if not stream:
            stream = detect_query_stream(f"{role} {job_description}")

        cache_key = f"interview_questions:{stream}:{hash(job_description)}:{role}:{count}"
        if cache_key in self._question_cache:
            return self._question_cache[cache_key]

        bank = INDUSTRY_QUESTION_BANKS.get(stream, INDUSTRY_QUESTION_BANKS["general"])
        selected = [dict(q) for q in bank[:count]]

        # If count requested exceeds bank, append from general
        if len(selected) < count:
            general_bank = INDUSTRY_QUESTION_BANKS["general"]
            for q in general_bank:
                if len(selected) >= count:
                    break
                if not any(item["id"] == q["id"] for item in selected):
                    selected.append(dict(q))

        self._question_cache[cache_key] = selected
        return selected

    def submit_answer(self, session_id: str, question_id: str, answer: str) -> dict[str, Any]:
        """Submit answer to interview question."""
        if session_id not in self.sessions:
            return {"error": "Session not found"}

        session = self.sessions[session_id]
        session["answers"][question_id] = {
            "answer": answer,
            "submitted_at": datetime.now().isoformat(),
        }

        # Check if all questions answered
        all_answered = len(session["answers"]) == len(session["questions"])
        if all_answered:
            session["completed"] = True
            self._generate_feedback(session_id)

        return {
            "success": True,
            "session_id": session_id,
            "question_id": question_id,
            "questions_remaining": len(session["questions"]) - len(session["answers"]),
            "all_answered": all_answered,
        }

    def _generate_feedback(self, session_id: str):
        """Generate deterministic, industry-grounded feedback and scoring."""
        session = self.sessions[session_id]
        stream = session.get("stream") or detect_query_stream(f"{session.get('role', '')} {session.get('job_description', '')}")
        proof_markers = SECTOR_PROOF_MARKERS.get(stream, SECTOR_PROOF_MARKERS["general"])

        answers = [item["answer"].strip() for item in session["answers"].values() if item.get("answer")]
        if not answers:
            session["feedback"] = {
                "text": "No answers provided to evaluate.",
                "score": 50,
                "generated_at": datetime.now().isoformat(),
            }
            return

        total_words = sum(len(ans.split()) for ans in answers)
        avg_words = total_words / len(answers)

        # Rubric evaluations
        score = 65  # Base passing starting point

        # 1. Depth and substantive content
        if avg_words >= 45:
            score += 10
        elif avg_words >= 25:
            score += 5
        elif avg_words < 10:
            score -= 15

        # 2. STAR Structure markers (Situation, Action, Result)
        combined_text = " ".join(answers).lower()
        has_situation = bool(re.search(r"\b(when|situation|project|patient|client|site|incident|case|contract)\b", combined_text))
        has_action = bool(re.search(r"\b(led|implemented|escalated|managed|performed|reconciled|negotiated|audited|automated|resolved)\b", combined_text))
        has_result = bool(re.search(r"\b(result|achieved|outcome|improved|reduced|prevented|uptime|completed|delivered|saved|zero)\b", combined_text))

        star_cues = sum([1 if has_situation else 0, 1 if has_action else 0, 1 if has_result else 0])
        if star_cues == 3:
            score += 10
        elif star_cues >= 1:
            score += 5

        # 3. Metric and quantification check (numbers, percentages, scales)
        has_metrics = bool(re.search(r"\b(\d+|%|\$|zero|hundred|million|thousand)\b", combined_text))
        if has_metrics:
            score += 8

        # 4. Sector-specific proof markers
        matched_markers = [m for m in proof_markers if m in combined_text]
        if len(matched_markers) >= 3:
            score += 10
        elif len(matched_markers) >= 1:
            score += 5
        else:
            score -= 5

        # Clamp score within reasonable bounds
        final_score = max(45, min(98, score))

        # Build constructive diagnostic feedback
        strengths = []
        improvements = []

        if star_cues >= 2:
            strengths.append("Structured responses utilizing clear situation-action-result narrative flow.")
        if has_metrics:
            strengths.append("Grounded claims in quantified business, patient, or operational outcomes.")
        if matched_markers:
            strengths.append(f"Demonstrated domain mastery referencing sector terms ({', '.join(matched_markers[:4])}).")
        if not strengths:
            strengths.append("Addressed the core question prompts directly and concisely.")

        if star_cues < 2:
            improvements.append("Apply the STAR method more systematically (specifically highlighting your personal action vs the team).")
        if not has_metrics:
            improvements.append("Incorporate specific quantifiable metrics (e.g. percentage improvements, budgets, headcount, or time savings).")
        if len(matched_markers) < 2:
            improvements.append(f"Explicitly cite recognized {stream.capitalize()} standards and frameworks (e.g., relevant statutory codes, protocols, or systems).")

        feedback_text = (
            f"Overall Assessment ({final_score}/100) — {stream.upper()} FOCUS:\n\n"
            f"Key Strengths:\n" + "\n".join(f"• {s}" for s in strengths) + "\n\n"
            f"Areas for Tactical Improvement:\n" + "\n".join(f"• {i}" for i in improvements) + "\n\n"
            f"Recommendation: In your live interview, lead with your most impactful outcome in the first 30 seconds of each response."
        )

        session["feedback"] = {
            "text": feedback_text,
            "score": final_score,
            "stream": stream,
            "generated_at": datetime.now().isoformat(),
        }

    def get_feedback(self, session_id: str) -> dict[str, Any]:
        """Get feedback for interview session."""
        if session_id not in self.sessions:
            return {"error": "Session not found"}

        session = self.sessions[session_id]

        if not session.get("completed"):
            return {"error": "Session not completed", "questions_remaining": len(session["questions"]) - len(session["answers"])}

        if not session.get("feedback"):
            self._generate_feedback(session_id)

        return {
            "session_id": session_id,
            "role": session["role"],
            "stream": session.get("stream", "general"),
            "score": session["feedback"]["score"],
            "feedback": session["feedback"]["text"],
            "total_questions": len(session["questions"]),
            "questions_answered": len(session["answers"]),
        }

    def analyze_performance(self, session_id: str) -> dict[str, Any]:
        """Analyze interview performance."""
        feedback = self.get_feedback(session_id)
        if "error" in feedback:
            return feedback

        score = feedback["score"]
        if score >= 85:
            level = "Excellent"
        elif score >= 70:
            level = "Good"
        elif score >= 60:
            level = "Average"
        else:
            level = "Needs Improvement"

        return {
            "session_id": session_id,
            "performance_level": level,
            "score": score,
            "stream": feedback.get("stream", "general"),
            "recommendation": "Practice STAR framing and front-load measurable impact metrics into each response.",
            "next_steps": ["Review feedback diagnostics", "Re-run simulation with targeted improvements", "Prepare 3 core proof stories"],
        }

    def get_statistics(self) -> dict[str, Any]:
        """Get simulator statistics."""
        total = len(self.sessions)
        completed = sum(1 for s in self.sessions.values() if s.get("completed"))
        avg_score = 0

        if completed > 0:
            scores = [s.get("feedback", {}).get("score", 70) for s in self.sessions.values() if s.get("completed")]
            avg_score = sum(scores) / len(scores) if scores else 0

        return {
            "total_sessions": total,
            "completed_sessions": completed,
            "average_score": round(avg_score, 1),
            "active_sessions": total - completed,
        }

    def reset_data(self) -> dict[str, Any]:
        """Reset all data."""
        count = len(self.sessions)
        self.sessions.clear()
        self._question_cache.clear()
        return {"status": "success", "cleared_sessions": count}


_interview_simulator = None


def get_interview_simulator() -> InterviewSimulator:
    global _interview_simulator
    if _interview_simulator is None:
        _interview_simulator = InterviewSimulator()
    return _interview_simulator

