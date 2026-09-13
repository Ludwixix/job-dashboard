"""Phase 22: Cover Letter Swappability Analyzer & Anti-Template Polarizer Engine.

Evaluates candidate cover letters against the "Swappability Test" and
"Anti-Template Rule" defined in docs/Resume_Optimization.md. Disqualifies
canned AI openers, highlights corporate fluff, audits 3-paragraph structure,
and generates polarizing rewrite variants designed for recruiter fatigue.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


CLICHE_OPENERS = [
    (r"\bi\s+am\s+writing\s+to\s+apply\b", "I am writing to apply"),
    (r"\bi\s+am\s+writing\s+to\s+express\b", "I am writing to express"),
    (r"\bi\s+am\s+excited\s+to\s+apply\b", "I am excited to apply"),
    (r"\bi\s+was\s+thrilled\s+to\s+see\b", "I was thrilled to see"),
    (r"\bwith\s+a\s+proven\s+track\s+record\b", "With a proven track record"),
    (r"\bplease\s+accept\s+my\s+resume\b", "Please accept my resume"),
    (r"\bi\s+am\s+submitting\s+my\s+application\b", "I am submitting my application"),
    (r"\bi\s+wish\s+to\s+apply\b", "I wish to apply"),
    (r"\bas\s+a\s+seasoned\b", "As a seasoned"),
    (r"\ballow\s+me\s+to\s+introduce\s+myself\b", "Allow me to introduce myself"),
    (r"\bi\s+am\s+delighted\s+to\s+submit\b", "I am delighted to submit"),
    (r"\bi\s+believe\s+i\s+would\s+be\s+a\s+great\s+fit\b", "I believe I would be a great fit"),
]

CORPORATE_FLUFF_MAP = {
    "results-driven": "State exact metrics (e.g., 'reduced latency 40%', 'grew revenue $2M')",
    "team player": "Detail squad scale (e.g., 'co-led 8-engineer platform pod')",
    "think outside the box": "Specify the unconventional engineering solution you designed",
    "synergy": "Describe concrete cross-functional handoffs or API integrations",
    "hit the ground running": "Cite immediate 30-day deliverables or early production commits",
    "passionate professional": "Focus on technical domain depth or open-source stewardship",
    "hardworking": "Show output velocity or system reliability under pressure",
    "detail-oriented": "Show automated QA testing, static analysis, or zero-defect releases",
    "dynamic professional": "Replace with your explicit job title and core tech stack",
    "fast-paced environment": "Specify deployment frequency (e.g., '15 CI/CD deploys/day')",
    "go the extra mile": "Demonstrate operational ownership or on-call incident resolution",
    "wear multiple hats": "Enumerate discrete responsibilities (e.g., 'IaC + DB tuning + security')",
    "proven track record": "Give 2 concrete verifiable business milestones",
    "customer-centric": "Name user impact (e.g., 'resolved top friction point for 50k users')",
    "thought leader": "Reference specific RFCs, technical architecture specs, or mentoring",
}


@dataclass
class CoverLetterAuditResult:
    swappability_score: int
    swappability_level: str
    company_mention_count: int
    detected_company_entities: List[str]
    opener_check: Dict[str, Any]
    cliches_found: List[Dict[str, str]]
    paragraph_analysis: List[Dict[str, Any]]
    voice_profile: Dict[str, Any]
    overall_verdict: str
    recommendations: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "swappability_score": self.swappability_score,
            "swappability_level": self.swappability_level,
            "company_mention_count": self.company_mention_count,
            "detected_company_entities": self.detected_company_entities,
            "opener_check": self.opener_check,
            "cliches_found": self.cliches_found,
            "paragraph_analysis": self.paragraph_analysis,
            "voice_profile": self.voice_profile,
            "overall_verdict": self.overall_verdict,
            "recommendations": self.recommendations,
        }


def _extract_paragraphs(text: str) -> List[str]:
    raw_paras = re.split(r"\n\s*\n", text.strip())
    return [p.strip() for p in raw_paras if p.strip()]


def audit_cover_letter(
    cover_letter_text: str,
    company: str = "",
    job_title: str = "",
    job_description: str = "",
) -> CoverLetterAuditResult:
    """Performs full Swappability, Anti-Template, and Structural Audit of a cover letter."""
    text = (cover_letter_text or "").strip()
    company = (company or "").strip()
    job_title = (job_title or "").strip()
    job_description = (job_description or "").strip()

    if not text:
        return CoverLetterAuditResult(
            swappability_score=100,
            swappability_level="Critical Risk (Completely Swappable)",
            company_mention_count=0,
            detected_company_entities=[],
            opener_check={
                "has_cliche_opener": False,
                "detected_opener": None,
                "suggestion": "Draft a sharp hook paragraph referencing the employer's current technical trajectory.",
            },
            cliches_found=[],
            paragraph_analysis=[],
            voice_profile={"tone": "Empty / Missing", "confidence_score": 0, "fluff_ratio": 0.0},
            overall_verdict="Fail - Terminal Genericism",
            recommendations=[
                "Provide cover letter text to evaluate swappability against target employer.",
                "Ensure letter includes the target company name and specific technical context.",
            ],
        )

    paragraphs = _extract_paragraphs(text)
    total_words = len(re.findall(r"\b\w+\b", text))

    # 1. Opener Check on Paragraph 1
    opener_check: Dict[str, Any] = {
        "has_cliche_opener": False,
        "detected_opener": None,
        "suggestion": "Lead directly with an insightful observation about the company's core challenge or architecture.",
    }
    first_para = paragraphs[0] if paragraphs else ""
    first_two_sentences = ". ".join([s.strip() for s in first_para.split(".")[:2]])

    for pattern, label in CLICHE_OPENERS:
        if re.search(pattern, first_two_sentences, re.IGNORECASE):
            opener_check["has_cliche_opener"] = True
            opener_check["detected_opener"] = label
            opener_check["suggestion"] = (
                f"Replace canned opener '{label}' with an opinionated hook addressing {company or 'the employer'}'s product or scaling challenges."
            )
            break

    # 2. Company Mentions and Entity Specificity
    detected_entities: List[str] = []
    company_mention_count = 0
    if company:
        escaped_comp = re.escape(company)
        matches = re.findall(rf"\b{escaped_comp}\b", text, re.IGNORECASE)
        company_mention_count = len(matches)
        if company_mention_count > 0:
            detected_entities.append(f"Company: {company} ({company_mention_count}x)")

    # Extract high-value domain tokens from description/title
    if job_description:
        tech_tokens = [
            "Kubernetes", "AWS", "GCP", "Azure", "Terraform", "Python", "Go", "Rust",
            "Kafka", "PostgreSQL", "Redis", "Distributed", "Microservices", "GraphQL",
            "CI/CD", "DevOps", "FinTech", "SaaS", "Security", "SOC2", "Observability"
        ]
        found_tokens = [
            t for t in tech_tokens
            if re.search(rf"\b{re.escape(t)}\b", job_description, re.IGNORECASE)
            and re.search(rf"\b{re.escape(t)}\b", text, re.IGNORECASE)
        ]
        if found_tokens:
            detected_entities.extend(found_tokens[:5])

    # 3. Corporate Fluff & Cliches Detection
    cliches_found: List[Dict[str, str]] = []
    for fluff, fix in CORPORATE_FLUFF_MAP.items():
        if re.search(rf"\b{re.escape(fluff)}\b", text, re.IGNORECASE):
            cliches_found.append({
                "phrase": fluff,
                "category": "Corporate Fluff",
                "fix": fix,
            })

    # 4. 3-Paragraph Structural Blueprint Analysis
    paragraph_roles = [
        "The Hook (Company Trajectory & Context)",
        "The Proof Narrative (Quantified Impact)",
        "The Low-Friction Close (Confident Call to Action)",
    ]
    paragraph_analysis: List[Dict[str, Any]] = []
    for i, p in enumerate(paragraphs):
        p_words = len(re.findall(r"\b\w+\b", p))
        role = paragraph_roles[i] if i < len(paragraph_roles) else f"Additional Paragraph {i + 1}"
        compliant = True
        feedback = "Balanced length and density."

        if i == 0:
            if p_words < 20:
                compliant = False
                feedback = "Too short for an impactful hook. Expand with context about the company's domain."
            elif p_words > 110:
                compliant = False
                feedback = "Too verbose for an opener hook. Keep it concise (< 90 words)."
        elif i == 1:
            if p_words < 40:
                compliant = False
                feedback = "Proof narrative lacks depth. Include specific metrics and scale."
            elif p_words > 180:
                compliant = False
                feedback = "Proof narrative is running long. Focus on a single decisive win."
        elif i == 2:
            if p_words < 15:
                compliant = False
                feedback = "Closing is too abrupt."
            elif p_words > 80:
                compliant = False
                feedback = "Closing call-to-action should be crisp, confident, and low-friction (< 60 words)."
        else:
            compliant = False
            feedback = "Exceeds the 3-paragraph structural blueprint. Consolidate into 3 focused sections."

        paragraph_analysis.append({
            "index": i + 1,
            "role": role,
            "word_count": p_words,
            "compliant": compliant,
            "feedback": feedback,
            "preview": (p[:90] + "…") if len(p) > 90 else p,
        })

    # 5. Swappability Risk Index Calculation
    # 0 = Completely company-locked / non-swappable
    # 100 = 100% generic / swappable with any competitor
    score = 45  # baseline

    if opener_check["has_cliche_opener"]:
        score += 25
    else:
        score -= 10

    if company_mention_count == 0:
        score += 35
    else:
        score -= min(25, company_mention_count * 10)

    # Reward domain entity integration
    domain_tech_count = len(detected_entities) - (1 if company_mention_count > 0 else 0)
    score -= min(20, domain_tech_count * 5)

    # Penalize corporate cliches
    score += min(20, len(cliches_found) * 5)

    # Paragraph structural penalty
    if len(paragraphs) != 3:
        score += 10
    else:
        score -= 5

    # Clamp between 5 and 95
    score = max(5, min(95, score))

    if score <= 35:
        swappability_level = "Low Risk (Highly Specific)"
    elif score <= 65:
        swappability_level = "Moderate Risk"
    else:
        swappability_level = "Critical Risk (Completely Swappable)"

    # Voice Profile Assessment
    fluff_ratio = round(len(cliches_found) / max(1, total_words / 50), 2)
    if opener_check["has_cliche_opener"] or fluff_ratio > 1.5:
        tone = "Sterile / Generic AI"
        confidence_score = 42
    elif score <= 35 and len(cliches_found) == 0:
        tone = "Opinionated & Distinct"
        confidence_score = 92
    else:
        tone = "Safe / Corporate Standard"
        confidence_score = 70

    voice_profile = {
        "tone": tone,
        "confidence_score": confidence_score,
        "fluff_ratio": fluff_ratio,
        "total_words": total_words,
    }

    # Overall Verdict
    if score <= 35 and not opener_check["has_cliche_opener"] and len(paragraphs) == 3:
        overall_verdict = "Pass - Polarizing & Specific"
    elif score <= 65:
        overall_verdict = "Review - Moderately Generic"
    else:
        overall_verdict = "Fail - Terminal Genericism"

    # Actionable Recommendations
    recommendations: List[str] = []
    if opener_check["has_cliche_opener"]:
        recommendations.append(opener_check["suggestion"])
    if company_mention_count == 0:
        recommendations.append(
            f"Explicitly reference '{company or 'the target company'}' and its current product or engineering initiatives."
        )
    if len(paragraphs) != 3:
        recommendations.append(
            f"Expected 3 paragraphs (Hook, Proof Narrative, Close), found {len(paragraphs)}. Refactor for maximum brevity."
        )
    for c in cliches_found[:3]:
        recommendations.append(f"Purge cliché '{c['phrase']}': {c['fix']}")
    if score > 50:
        recommendations.append(
            "Execute the Swappability Test: ensure swapping in a competitor's name would make the letter nonsensical."
        )

    return CoverLetterAuditResult(
        swappability_score=score,
        swappability_level=swappability_level,
        company_mention_count=company_mention_count,
        detected_company_entities=detected_entities,
        opener_check=opener_check,
        cliches_found=cliches_found,
        paragraph_analysis=paragraph_analysis,
        voice_profile=voice_profile,
        overall_verdict=overall_verdict,
        recommendations=recommendations,
    )


def generate_polarized_variants(
    job: Dict[str, Any],
    profile: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Generates 3 opinionated, non-generic cover letter variants adhering to Phase 4 constraints."""
    company = job.get("company") or "the engineering team"
    title = job.get("title") or "Engineering Role"
    skills = (profile or {}).get("skills") or ["Distributed Systems", "Cloud Architecture", "CI/CD", "Observability"]
    top_skill = skills[0] if skills else "Distributed Systems"
    second_skill = skills[1] if len(skills) > 1 else "Cloud Infrastructure"

    # 1. The High-Conviction Angle
    p1_conviction = (
        f"Scaling {company}'s platform while maintaining sub-second latency is fundamentally a distributed state problem. "
        f"Watching your team navigate rapid user adoption convinced me this {title} position needs someone who treats infrastructure as an active product moat."
    )
    p2_conviction = (
        f"Over the past four years, I spearheaded the core migration to an event-driven {top_skill} framework at scale. "
        f"By re-architecting asynchronous broker pipelines and automating failover policies, my squad eliminated $350k in compute waste and maintained 99.995% uptime across 1.4M daily transactions."
    )
    p3_conviction = (
        f"If {company} is ready to cut through operational complexity and accelerate release velocity without downtime, let's connect for 15 minutes this week."
    )

    # 2. The Direct Systems Architect
    p1_systems = (
        f"Most software architectures break down not at the algorithm layer, but at the observability and deployment boundaries. "
        f"{company}'s roadmap for {title} caught my attention because it directly targets production-grade reliability."
    )
    p2_systems = (
        f"At my previous company, I owned our enterprise {second_skill} pipeline. "
        f"I designed containerized runtime environments from scratch, drove automated regression suites down to under four minutes, and cut incident triage times by 60% through structured telemetry."
    )
    p3_systems = (
        f"I would welcome the opportunity to review your current deployment bottlenecks and discuss how my tooling philosophy aligns with {company}'s goals."
    )

    # 3. The Cultural Rebel / Velocity Outlier
    p1_rebel = (
        f"Bureaucracy kills developer velocity faster than technical debt ever will. "
        f"I respect {company}'s bias toward autonomous, high-ownership engineering, and this {title} vacancy is exactly the high-stakes environment I thrive in."
    )
    p2_rebel = (
        f"I don't write defensive specifications; I ship resilient code. When our legacy queueing system failed under Black Friday load, "
        f"I rewrote the critical ingestion pathway in 72 hours, scaling throughput by 3.8x with zero data loss using {top_skill} and automated reconciliation."
    )
    p3_rebel = (
        f"If you need an engineer who takes full ownership from architectural RFC to production telemetry, let's schedule an introductory discussion."
    )

    return [
        {
            "id": "high_conviction",
            "title": "The High-Conviction Angle",
            "subtitle": "Bold Hypothesis & Competitive Moat",
            "tone": "Opinionated, Strategic & Visionary",
            "hook_explanation": "Hooks the hiring manager with an expert hypothesis on the company's real scaling friction.",
            "paragraphs": [p1_conviction, p2_conviction, p3_conviction],
            "full_text": f"{p1_conviction}\n\n{p2_conviction}\n\n{p3_conviction}",
        },
        {
            "id": "systems_architect",
            "title": "The Direct Systems Architect",
            "subtitle": "Zero-Fluff Technical Proof & Quantified Scale",
            "tone": "Pragmatic, Metrics-Driven & Precise",
            "hook_explanation": "Skips generic corporate pleasantries and proves immediate operational mastery.",
            "paragraphs": [p1_systems, p2_systems, p3_systems],
            "full_text": f"{p1_systems}\n\n{p2_systems}\n\n{p3_systems}",
        },
        {
            "id": "cultural_outlier",
            "title": "The Cultural Rebel",
            "subtitle": "High-Velocity, Low-Bureaucracy Execution",
            "tone": "Direct, Confident & High-Energy",
            "hook_explanation": "Actively screens out slow-moving corporate red tape to hook agile engineering leaders.",
            "paragraphs": [p1_rebel, p2_rebel, p3_rebel],
            "full_text": f"{p1_rebel}\n\n{p2_rebel}\n\n{p3_rebel}",
        },
    ]

