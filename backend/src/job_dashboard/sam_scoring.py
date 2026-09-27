"""Sam Mode Hyper-Personalized Scoring & Knockout Engine.

Custom-tailored scoring, hard knockout evaluation, proof-point justification,
and match chip synthesis grounded in Sam Ludwig's 10-year enterprise career.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

logger = logging.getLogger("job_dashboard.sam_scoring")

# =====================================================================
# 1. Canonical Profile & Constants
# =====================================================================

CANONICAL_TARGET_TITLES: tuple[str, ...] = (
    "Senior Systems Engineer",
    "Senior Infrastructure Engineer",
    "Senior M365 Engineer",
    "Cloud Infrastructure Specialist",
    "Endpoint / EUC Engineer",
    "L3 Systems / Operations Lead",
    "SharePoint & Modern Workplace Architect",
    "Automation & DevOps Engineer",
)

SAM_CANONICAL_FALLBACK: dict[str, Any] = {
    "id": "sam_ludwig",
    "name": "Sam Ludwig",
    "title": "Senior Infrastructure & M365 Engineer",
    "yearsOfExperience": 10,
    "seniorityLevel": "Senior / Lead",
    "location": "Melbourne, VIC (Balaclava 3183)",
    "suburb": "Balaclava",
    "state": "VIC",
    "workRights": "Australian Citizen (Unrestricted)",
    "clearance": "Australian Citizen (Baseline / NV1 Eligible)",
    "targetSalary": "$140,000 - $165,000 + Super",
    "salaryFloor": 120000,
    "salaryExpectations": {
        "min": 140000,
        "max": 165000,
        "preferred": 150000,
        "currency": "AUD",
        "floor": 120000,
    },
    "targetTitles": list(CANONICAL_TARGET_TITLES),
}

SAM_SALARY_FLOOR: float = 120000.0

# Competency clusters with associated weights and keyword aliases
SAM_COMPETENCY_CLUSTERS: dict[str, dict[str, Any]] = {
    "m365_modern_workplace": {
        "weight": 1.0,
        "skills": (
            "microsoft 365",
            "sharepoint online / server",
            "exchange hybrid / online",
            "microsoft teams",
        ),
        "aliases": (
            "m365",
            "o365",
            "office 365",
            "sharepoint",
            "spo",
            "exchange",
            "teams",
            "modern workplace",
        ),
    },
    "identity_security": {
        "weight": 1.0,
        "skills": (
            "entra id (azure ad)",
            "active directory domain services",
            "acsc essential 8 & iso 27001",
            "microsoft graph api",
        ),
        "aliases": (
            "entra",
            "entra id",
            "azure ad",
            "aad",
            "active directory",
            "adds",
            "essential 8",
            "e8",
            "iso 27001",
            "graph api",
            "zero trust",
        ),
    },
    "endpoint_euc": {
        "weight": 0.95,
        "skills": (
            "microsoft intune (mdm/mam)",
            "windows autopilot",
            "windows server (2012r2–2022)",
        ),
        "aliases": (
            "intune",
            "endpoint manager",
            "mem",
            "mdm",
            "mam",
            "autopilot",
            "windows 10",
            "windows 11",
            "windows server",
            "soe",
        ),
    },
    "automation_devops": {
        "weight": 0.95,
        "skills": ("powershell 5.1/7 & pnp", "python automation", "azure devops ci/cd"),
        "aliases": (
            "powershell",
            "pwsh",
            "pnp",
            "python",
            "scripting",
            "runbooks",
            "azure devops",
            "ado",
            "ci/cd",
            "automation",
        ),
    },
    "cloud_infrastructure": {
        "weight": 0.90,
        "skills": (
            "azure cloud (vms, functions, automation)",
            "vmware vsphere (esxi)",
            "layer 1 infrastructure (fibre / copper)",
        ),
        "aliases": (
            "azure",
            "vmware",
            "vsphere",
            "esxi",
            "virtualisation",
            "cloud infrastructure",
            "structured cabling",
            "fibre",
            "copper",
            "ntd",
        ),
    },
    "itsm_governance": {
        "weight": 0.85,
        "skills": ("servicenow (advanced)", "itil 4 service management"),
        "aliases": (
            "servicenow",
            "snow",
            "itsm",
            "itil",
            "itil 4",
            "incident management",
            "change management",
            "problem management",
            "rca",
        ),
    },
}

SAM_VERIFIED_MILESTONES: list[dict[str, Any]] = [
    {
        "id": "vic_gov_education",
        "employer": "Capgemini / Dept. of Education Victoria",
        "category": "enterprise_scale",
        "headline": "Southern Hemisphere's Largest SharePoint Farm (660,000+ Users)",
        "evidence": "Managed Southern Hemisphere's largest SharePoint farm (660,000+ users, 1,000+ sites) at Dept. of Education VIC with 99.9% uptime, Tier-3 M365 escalation, and tri-platform AD/Entra ID/Google sync.",
        "trigger_keywords": (
            "660k",
            "660,000",
            "education",
            "schools",
            "large scale",
            "enterprise",
            "sharepoint farm",
            "multi-site",
            "tier-3",
            "tier 3",
            "l3",
            "rca",
            "department",
            "vic gov",
            "public sector",
        ),
    },
    {
        "id": "st_john_of_god",
        "employer": "St John of God Health Care",
        "category": "clinical_endpoints",
        "headline": "100+ Clinical Hospital Endpoint Windows 11 Autopilot Migration",
        "evidence": "Led Windows 11 enterprise migration across 100+ clinical endpoints at St John of God Health Care with 100% Autopilot adherence, zero patient care disruption, and hospital EMR/PACS diagnostic imaging compatibility.",
        "trigger_keywords": (
            "hospital",
            "clinical",
            "healthcare",
            "patient",
            "emr",
            "pacs",
            "health",
            "medical",
            "doctor",
            "nurse",
            "ward",
            "st john of god",
        ),
    },
    {
        "id": "australia_post",
        "employer": "Australia Post (via Capgemini)",
        "category": "automation_itsm",
        "headline": "ServiceNow Keystroke Automation & Enterprise Endpoint SOE",
        "evidence": "Engineered custom keystroke injection automation in ServiceNow saving hundreds of hours of manual ticket entry per month; managed enterprise fleet Windows 10/11 SOE builds and NIST-compliant sanitisation.",
        "trigger_keywords": (
            "servicenow",
            "keystroke",
            "ticket",
            "itsm",
            "australia post",
            "auspost",
            "soe build",
            "reimage",
            "hardware lifecycle",
            "endpoint fleet",
        ),
    },
    {
        "id": "knosys",
        "employer": "Knosys",
        "category": "cloud_migration",
        "headline": "PowerShell Migration Automation (87% Batch Time Reduction)",
        "evidence": "Engineered PowerShell automation reducing cloud migration batch processing by 87% (2 hours to 15 minutes per batch), saving 10+ hours per month, with 95% SLA resolution for GreenOrbit enterprise intranet platform.",
        "trigger_keywords": (
            "knosys",
            "greenorbit",
            "87%",
            "batch",
            "migration script",
            "powershell automation",
            "patching automation",
            "sla",
        ),
    },
    {
        "id": "engage_squared",
        "employer": "Engage Squared",
        "category": "modern_workplace",
        "headline": "Enterprise Intranets & Azure DevOps CI/CD (Victoria Police / Transurban)",
        "evidence": "Architected 5+ bespoke enterprise SharePoint Online intranets for Victoria Police, Transurban, and Cimic Group using SPFx/React, reducing Azure DevOps deployment cycles by 25% under ISO 27001.",
        "trigger_keywords": (
            "engage squared",
            "victoria police",
            "transurban",
            "spfx",
            "intranet",
            "sharegate",
            "spmt",
            "iso 27001",
            "azure devops",
            "ci/cd",
        ),
    },
    {
        "id": "nbn_layer1",
        "employer": "National Broadband Network (NBN) & PolaAir",
        "category": "physical_infrastructure",
        "headline": "Layer 1 Telecommunications Cabling & Physical Systems Diagnostics",
        "evidence": "Deployed Layer 1 physical infrastructure (fibre optic and copper structured cabling), NTDs, and routing equipment across commercial networks, with deep diagnostic RCA methodologies.",
        "trigger_keywords": (
            "nbn",
            "cabling",
            "fibre",
            "fiber",
            "copper",
            "structured cabling",
            "layer 1",
            "data-link",
            "rack",
            "hvac",
            "mechanical",
        ),
    },
]


# =====================================================================
# 2. Dataclasses
# =====================================================================


@dataclass(frozen=True)
class KnockoutEvaluation:
    """Encapsulates the 4-pillar hard knockout assessment."""

    knocked_out: bool
    reasons: tuple[str, ...]
    work_rights_pass: bool
    clearance_pass: bool
    salary_pass: bool
    location_pass: bool

    def as_dict(self) -> dict[str, Any]:
        """Convert knockout evaluation to dictionary format."""
        return {
            "work_rights_pass": self.work_rights_pass,
            "clearance_pass": self.clearance_pass,
            "salary_pass": self.salary_pass,
            "location_pass": self.location_pass,
            "overall_pass": not self.knocked_out,
            "reasons": list(self.reasons),
        }


@dataclass(frozen=True)
class MatchChip:
    """Visual telemetry badge displayed on job cards."""

    label: str
    variant: Literal["match", "neutral", "warning", "knockout"]
    category: str = "general"

    def as_dict(self) -> dict[str, str]:
        """Serialize chip to dict with label and variant."""
        return {"label": self.label, "variant": self.variant}


@dataclass(frozen=True)
class ProofPointJustification:
    """Empirical proof point linking job requirements to Sam's verified milestones."""

    requirement: str
    category: str
    verified_evidence: str
    source_employer: str
    alignment_score: int

    def as_dict(self) -> dict[str, Any]:
        """Serialize proof point details."""
        return {
            "requirement": self.requirement,
            "category": self.category,
            "verified_evidence": self.verified_evidence,
            "source_employer": self.source_employer,
            "alignment_score": self.alignment_score,
        }


@dataclass(frozen=True)
class SamScoreResult:
    """Comprehensive scoring, knockout, and justification result for a job."""

    overall_score: int
    base_rule_score: int
    competency_score: int
    justification_score: int
    scale_multiplier: float
    role_archetype: str
    chips: tuple[MatchChip, ...]
    knockout: KnockoutEvaluation
    proof_points: tuple[str, ...]
    proof_point_details: tuple[ProofPointJustification, ...]
    salary_assessment: dict[str, Any]
    recommended_action: str

    def as_dict(self) -> dict[str, Any]:
        """Serialize scoring result to JSON-compliant dictionary."""
        return {
            "sam_score": self.overall_score,
            "score": self.overall_score,
            "justification_score": self.justification_score,
            "competency_score": self.competency_score,
            "base_rule_score": self.base_rule_score,
            "scale_multiplier": self.scale_multiplier,
            "role_archetype": self.role_archetype,
            "archetype": self.role_archetype,
            "match_chips": [c.label for c in self.chips],
            "chips": [c.as_dict() for c in self.chips],
            "knockouts": self.knockout.as_dict(),
            "knockout": {
                "knocked_out": self.knockout.knocked_out,
                "reasons": list(self.knockout.reasons),
                "work_rights_pass": self.knockout.work_rights_pass,
                "clearance_pass": self.knockout.clearance_pass,
                "salary_pass": self.knockout.salary_pass,
                "location_pass": self.knockout.location_pass,
            },
            "proof_points": list(self.proof_points),
            "proof_point_details": [p.as_dict() for p in self.proof_point_details],
            "salary_assessment": self.salary_assessment,
            "recommended_action": self.recommended_action,
        }


# =====================================================================
# 3. Core Evaluation Logic
# =====================================================================


def _normalize_job_data(job: Any) -> tuple[str, str, str, str | None, bool]:
    """Extract and normalize standard fields from Job object or dict."""
    if isinstance(job, dict):
        title = str(job.get("title") or "")
        desc = str(job.get("description") or job.get("notes") or "")
        loc = str(job.get("location") or "")
        sal = job.get("salary_raw") or job.get("salary")
        remote = bool(job.get("remote")) or ("remote" in loc.lower())
    else:
        title = str(getattr(job, "title", "") or "")
        desc = str(getattr(job, "description", "") or getattr(job, "notes", "") or "")
        loc = str(getattr(job, "location", "") or "")
        sal = getattr(job, "salary_raw", None) or getattr(job, "salary", None)
        remote = bool(getattr(job, "remote", False)) or ("remote" in loc.lower())
    return title, desc, loc, sal, remote


def evaluate_salary(
    salary_raw: str | None,
) -> tuple[bool, dict[str, Any], list[str]]:
    """Parse salary and enforce strict $120,000 AUD floor.

    Handles daily contract rates (multiplied by 220), hourly contract rates
    (multiplied by 1800), 'k' notation, and standard ranges.
    Unstated or purely competitive salaries never trigger a false knockout.
    """
    if not salary_raw or not str(salary_raw).strip():
        return (
            True,
            {
                "in_range": True,
                "raw": "Undisclosed",
                "estimated_annual": 150000,
                "vs_floor": "+$30,000",
            },
            [],
        )

    text = str(salary_raw).strip()
    low_text = text.lower()
    reasons: list[str] = []

    # Non-numeric text phrases (e.g. "Competitive salary package", "Market rate")
    if any(
        k in low_text for k in ("competitive", "negotiable", "market rate", "package")
    ) and not re.search(r"\d", low_text):
        return (
            True,
            {
                "in_range": True,
                "raw": text,
                "estimated_annual": 150000,
                "vs_floor": "+$30,000",
            },
            [],
        )

    # 1. Daily rate parsing: e.g. "$850 - $950 per day", "$900/day"
    day_match = re.search(
        r"\$?\s*(\d{3,4})\s*(?:-|to)?\s*\$?\s*(\d{3,4})?\s*(?:/\s*day|p\.?d\.?|per\s+day)",
        low_text,
    )
    if day_match:
        rates = [float(r) for r in day_match.groups() if r]
        max_rate = max(rates) if rates else 0.0
        annual = max_rate * 220.0
        if annual < SAM_SALARY_FLOOR:
            reasons.append(
                f"Daily rate (${max_rate:.0f}/day -> ${annual:,.0f}/yr) is below $120,000 floor"
            )
            return (
                False,
                {
                    "in_range": False,
                    "raw": text,
                    "estimated_annual": annual,
                    "vs_floor": f"-${SAM_SALARY_FLOOR - annual:,.0f}",
                },
                reasons,
            )
        return (
            True,
            {
                "in_range": True,
                "raw": text,
                "estimated_annual": annual,
                "vs_floor": f"+${annual - SAM_SALARY_FLOOR:,.0f}",
            },
            [],
        )

    # 2. Hourly rate parsing: e.g. "$85 / hr", "$75 - $90 p.h."
    hr_match = re.search(
        r"\$?\s*(\d{2,3}(?:\.\d{2})?)\s*(?:-|to)?\s*\$?\s*(\d{2,3}(?:\.\d{2})?)?\s*(?:/\s*hr|p\.?h\.?|per\s+hour)",
        low_text,
    )
    if hr_match:
        rates = [float(r) for r in hr_match.groups() if r]
        max_rate = max(rates) if rates else 0.0
        annual = max_rate * 1800.0
        if annual < SAM_SALARY_FLOOR:
            reasons.append(
                f"Hourly rate (${max_rate:.2f}/hr -> ${annual:,.0f}/yr) is below $120,000 floor"
            )
            return (
                False,
                {
                    "in_range": False,
                    "raw": text,
                    "estimated_annual": annual,
                    "vs_floor": f"-${SAM_SALARY_FLOOR - annual:,.0f}",
                },
                reasons,
            )
        return (
            True,
            {
                "in_range": True,
                "raw": text,
                "estimated_annual": annual,
                "vs_floor": f"+${annual - SAM_SALARY_FLOOR:,.0f}",
            },
            [],
        )

    # 3. 'k' notation parsing: e.g. "$145k - $160k", "$85k"
    k_matches = re.findall(r"\$?\s*(\d{2,3})\s*[kK]\b", text)
    if k_matches:
        vals = [float(v) * 1000.0 for v in k_matches]
        max_val = max(vals)
        if max_val < SAM_SALARY_FLOOR:
            reasons.append(f"Salary maximum (${max_val:,.0f}) is below $120,000 floor")
            return (
                False,
                {
                    "in_range": False,
                    "raw": text,
                    "estimated_annual": max_val,
                    "vs_floor": f"-${SAM_SALARY_FLOOR - max_val:,.0f}",
                },
                reasons,
            )
        return (
            True,
            {
                "in_range": True,
                "raw": text,
                "estimated_annual": max_val,
                "vs_floor": f"+${max_val - SAM_SALARY_FLOOR:,.0f}",
            },
            [],
        )

    # 4. Standard integers with commas or 5-6 digits: e.g. "$119,000", "$155,000 - $165,000"
    num_matches = re.findall(r"\$?\s*(\d{2,3}(?:,\d{3})+|\d{5,6})\b", text)
    if num_matches:
        vals = [float(v.replace(",", "")) for v in num_matches]
        max_val = max(vals)
        if max_val < SAM_SALARY_FLOOR:
            reasons.append(f"Salary maximum (${max_val:,.0f}) is below $120,000 floor")
            return (
                False,
                {
                    "in_range": False,
                    "raw": text,
                    "estimated_annual": max_val,
                    "vs_floor": f"-${SAM_SALARY_FLOOR - max_val:,.0f}",
                },
                reasons,
            )
        return (
            True,
            {
                "in_range": True,
                "raw": text,
                "estimated_annual": max_val,
                "vs_floor": f"+${max_val - SAM_SALARY_FLOOR:,.0f}",
            },
            [],
        )

    # Default permissive for unparsed numbers
    return (
        True,
        {
            "in_range": True,
            "raw": text,
            "estimated_annual": 150000,
            "vs_floor": "+$30,000",
        },
        [],
    )


def evaluate_work_rights(full_text: str) -> tuple[bool, list[str]]:
    """Evaluate work rights ensuring ZERO false knockouts for Australian Citizens.

    Sam Ludwig is an Australian Citizen with unrestricted working rights.
    """
    reasons: list[str] = []
    # Trigger knockout only when explicitly restricted to foreign citizenship
    foreign_only = re.search(
        r"\b(us\s+citizens?\s+only|must\s+be\s+a\s+us\s+citizen|itar\s+compliant\s+role|green\s+card\s+only|uk\s+nationals?\s+only)\b",
        full_text,
    )
    if foreign_only:
        reasons.append(
            "Job restricted to foreign nationals / non-Australian work rights"
        )
        return False, reasons

    return True, []


def evaluate_security_clearance(full_text: str) -> tuple[bool, list[str]]:
    """Evaluate security clearance with ZERO false knockouts on Baseline / NV1.

    Sam Ludwig is an Australian Citizen eligible for Baseline and NV1 clearances.
    Knockout triggers ONLY when mandatory, active, unsponsored Top Secret Positive
    Vetting (TSPV) or NV2 is strictly required.
    """
    reasons: list[str] = []
    # Check for mandatory active TSPV without sponsorship or eligibility allowance
    mandatory_tspv = re.search(
        r"\b(must\s+(currently\s+)?hold|current|active|mandatory)\b[^.\n]*?\b(ts\s*pv|tspv|top\s*secret\s*positive\s*vetting|positive\s*vetting)\b",
        full_text,
    )
    if mandatory_tspv:
        sponsorship_or_eligible = re.search(
            r"\b(ability\s+to\s+obtain|eligible\s+for|willing\s+to\s+sponsor|sponsorship\s+available|baseline\s+or\s+nv1)\b",
            full_text,
        )
        if not sponsorship_or_eligible:
            reasons.append(
                "Requires active TSPV security clearance with no sponsorship path"
            )
            return False, reasons

    return True, []


def evaluate_location(
    location: str,
    full_text: str,
    remote: bool,
) -> tuple[bool, list[str]]:
    """Evaluate location and commute suitability for Melbourne/Balaclava/Remote.

    Passes Balaclava, Melbourne SE, Greater Melbourne, Remote, and Hybrid.
    Knocks out strictly on-site roles in interstate capital cities.
    """
    reasons: list[str] = []

    # Check if job explicitly states no remote / strictly on-site
    has_negative_remote = bool(
        re.search(
            r"\b(no|non|not)\s+(remote|wfh|interstate)\b|\bstrictly\s+(\d+\s+days?\s+per\s+week\s+)?on-?site\b",
            full_text,
        )
    )

    if remote and not has_negative_remote:
        return True, []

    is_melbourne_vic = bool(
        re.search(
            r"\b(melbourne|vic|victoria|balaclava|3183|melbourne\s+cbd|docklands|richmond|clayton|south\s+yarra|st\s+kilda|mulgrave|cremorne|box\s+hill|hawthorn|moorabbin|caulfield|malvern)\b",
            full_text,
        )
    )
    is_strict_interstate = bool(
        re.search(
            r"\b(perth|wa|western\s+australia|sydney|nsw|new\s+south\s+wales|brisbane|qld|queensland|canberra|act|adelaide|sa|south\s+australia|darwin|nt|hobart|tasmania)\b",
            full_text,
        )
    )

    if is_strict_interstate and not is_melbourne_vic:
        reasons.append(f"Strict on-site role located outside Victoria ({location})")
        return False, reasons

    if not has_negative_remote:
        is_remote_or_hybrid = any(
            k in full_text
            for k in (
                "remote",
                "hybrid",
                "wfh",
                "work from home",
                "anywhere in australia",
                "flexible",
            )
        )
        if is_remote_or_hybrid:
            return True, []

    if is_melbourne_vic:
        return True, []

    reasons.append(
        f"Role location ({location}) does not match Melbourne or remote preferences"
    )
    return False, reasons


def evaluate_knockouts(job: Any) -> KnockoutEvaluation:
    """Evaluate all 4 hard knockout pillars."""
    title, desc, loc, sal, remote = _normalize_job_data(job)
    full_text = f"{title} {desc} {loc}".lower()

    work_rights_pass, wr_reasons = evaluate_work_rights(full_text)
    clearance_pass, cl_reasons = evaluate_security_clearance(full_text)
    salary_pass, _sal_assess, sal_reasons = evaluate_salary(sal)
    location_pass, loc_reasons = evaluate_location(loc, full_text, remote)

    all_reasons = wr_reasons + cl_reasons + sal_reasons + loc_reasons
    knocked_out = not (
        work_rights_pass and clearance_pass and salary_pass and location_pass
    )

    return KnockoutEvaluation(
        knocked_out=knocked_out,
        reasons=tuple(all_reasons),
        work_rights_pass=work_rights_pass,
        clearance_pass=clearance_pass,
        salary_pass=salary_pass,
        location_pass=location_pass,
    )


def classify_role_archetype(job: Any) -> str:
    """Classify role title into one of Sam's 8 canonical target titles."""
    title, _, _, _, _ = _normalize_job_data(job)
    low_title = title.lower()

    # 1. Exact archetype substring match
    for arch in CANONICAL_TARGET_TITLES:
        if arch.lower() in low_title:
            return arch

    # 2. Specific role markers
    if any(
        k in low_title for k in ("operations", "tier 3", "tier-3", "l3", "ops lead")
    ):
        return "L3 Systems / Operations Lead"
    if any(
        k in low_title
        for k in ("sharepoint", "modern workplace", "workplace", "intranet")
    ):
        return "SharePoint & Modern Workplace Architect"
    if any(k in low_title for k in ("devops", "automation", "powershell")):
        return "Automation & DevOps Engineer"
    if any(
        k in low_title for k in ("endpoint", "euc", "autopilot", "intune", "desktop")
    ):
        return "Endpoint / EUC Engineer"
    if any(k in low_title for k in ("m365", "microsoft 365", "office 365")):
        return "Senior M365 Engineer"
    if "cloud" in low_title:
        return "Cloud Infrastructure Specialist"
    if "infrastructure" in low_title:
        return "Senior Infrastructure Engineer"
    if "systems" in low_title:
        return "Senior Systems Engineer"

    # Match by key terms in canonical titles
    for arch in CANONICAL_TARGET_TITLES:
        words = [w.lower() for w in arch.split() if len(w) > 3]
        if any(w in low_title for w in words):
            return arch

    return "Senior Infrastructure Engineer"


def calculate_competency_and_multiplier(
    full_text: str,
) -> tuple[int, float, list[MatchChip]]:
    """Compute deep competency score and enterprise scale multiplier."""
    matched_clusters = 0
    total_weights = 0.0
    weighted_score = 0.0

    chips: list[MatchChip] = []

    # 1. Competency Cluster Matching
    for cluster_data in SAM_COMPETENCY_CLUSTERS.values():
        aliases = cluster_data.get("aliases", ())
        hits = sum(1 for a in aliases if re.search(rf"\b{re.escape(a)}\b", full_text))
        if hits > 0:
            matched_clusters += 1
            weight = float(cluster_data.get("weight", 1.0))
            total_weights += weight
            ratio = min(1.0, hits / 2.0)
            weighted_score += weight * ratio

    if matched_clusters > 0:
        comp_score = round((weighted_score / max(1.0, total_weights)) * 100.0)
        comp_score = max(70, min(100, comp_score + (matched_clusters * 5)))
    else:
        comp_score = 65

    # 2. Enterprise Scale Multiplier
    multiplier = 1.0
    # High user scale (+0.10)
    if any(
        k in full_text
        for k in (
            "660k",
            "660,000",
            "enterprise",
            "large scale",
            "thousands",
            "multi-site",
            "thousand",
        )
    ):
        multiplier += 0.10
        chips.append(
            MatchChip(
                label="Enterprise Scale: 660k+ Users", variant="match", category="scale"
            )
        )

    # Clinical / Healthcare (+0.10)
    if any(
        k in full_text
        for k in (
            "hospital",
            "clinical",
            "healthcare",
            "patient",
            "emr",
            "pacs",
            "medical",
        )
    ):
        multiplier += 0.10
        chips.append(
            MatchChip(
                label="Clinical Migration: Match", variant="match", category="domain"
            )
        )

    # High-ROI Automation (+0.05)
    if any(
        k in full_text
        for k in (
            "powershell runbook",
            "powershell",
            "automation",
            "knosys",
            "batch",
            "87%",
        )
    ):
        multiplier += 0.05
        chips.append(
            MatchChip(
                label="PowerShell: Expert (87% Speedup)",
                variant="match",
                category="competency",
            )
        )

    # Government & Compliance (+0.05)
    if any(
        k in full_text
        for k in ("department", "public sector", "vic gov", "essential 8", "iso 27001")
    ):
        multiplier += 0.05
        chips.append(
            MatchChip(
                label="Essential 8 & Compliance: Ready",
                variant="match",
                category="compliance",
            )
        )

    multiplier = min(1.25, multiplier)

    # Generate standard match chips
    if any(
        k in full_text
        for k in ("m365", "microsoft 365", "entra", "azure ad", "active directory")
    ):
        chips.insert(
            0,
            MatchChip(
                label="M365 & Entra ID: 100%", variant="match", category="competency"
            ),
        )
    else:
        chips.insert(
            0,
            MatchChip(
                label="Systems & Cloud: Match", variant="match", category="competency"
            ),
        )

    if any(k in full_text for k in ("autopilot", "intune", "endpoint", "windows 11")):
        chips.insert(
            1,
            MatchChip(
                label="Autopilot/Intune: Match", variant="match", category="competency"
            ),
        )
    else:
        chips.insert(
            1,
            MatchChip(
                label="Enterprise SOE: Match", variant="match", category="competency"
            ),
        )

    return comp_score, multiplier, chips


def synthesize_proof_points(
    full_text: str,
) -> tuple[list[str], list[ProofPointJustification], int]:
    """Synthesize concrete proof points from Sam's 6 verified career milestones."""
    proof_points: list[str] = []
    details: list[ProofPointJustification] = []
    justification_score = 65

    # Check Dept of Ed 660k scale
    if any(
        k in full_text
        for k in (
            "660k",
            "660,000",
            "education",
            "schools",
            "large scale",
            "enterprise",
            "sharepoint",
            "m365",
            "department",
            "tier-3",
            "tier 3",
        )
    ):
        justification_score += 18
        proof_points.append(
            "Matches 660,000+ user M365 enterprise administration at Dept of Education VIC"
        )
        details.append(
            ProofPointJustification(
                requirement="Enterprise M365 & Southern Hemisphere Scale",
                category="enterprise_scale",
                verified_evidence="Managed Southern Hemisphere's largest SharePoint farm (660,000+ users, 1,000+ sites) at Dept. of Education VIC with 99.9% uptime and tri-platform AD/Entra ID sync.",
                source_employer="Capgemini / Dept. of Education VIC",
                alignment_score=98,
            )
        )

    # Check St John of God Clinical Endpoints
    if any(
        k in full_text
        for k in (
            "hospital",
            "clinical",
            "healthcare",
            "patient",
            "emr",
            "pacs",
            "autopilot",
            "intune",
            "endpoint",
            "windows 11",
        )
    ):
        justification_score += 14
        proof_points.append(
            "Matches 100+ clinical endpoint Windows 11 Autopilot migration at St John of God"
        )
        details.append(
            ProofPointJustification(
                requirement="Clinical Endpoint & Windows 11 Autopilot Fleet",
                category="clinical_endpoints",
                verified_evidence="Led Windows 11 enterprise migration across 100+ clinical endpoints at St John of God Health Care with 100% Autopilot adherence and zero patient care disruption.",
                source_employer="St John of God Health Care",
                alignment_score=95,
            )
        )

    # Check Knosys Batch Optimization
    if any(
        k in full_text
        for k in (
            "powershell",
            "automation",
            "batch",
            "optimization",
            "speedup",
            "migration",
            "script",
        )
    ):
        justification_score += 10
        proof_points.append(
            "Matches PowerShell migration automation achieving 87% batch reduction at Knosys"
        )
        details.append(
            ProofPointJustification(
                requirement="High-Impact PowerShell Automation & Cloud Migration",
                category="cloud_migration",
                verified_evidence="Engineered PowerShell automation cutting cloud migration batch processing by 87% (2 hours to 15 minutes per batch) at Knosys.",
                source_employer="Knosys",
                alignment_score=92,
            )
        )

    # Check Australia Post ServiceNow Keystroke
    if any(
        k in full_text
        for k in (
            "servicenow",
            "itsm",
            "ticket",
            "australia post",
            "sanitisation",
            "fleet",
        )
    ):
        justification_score += 8
        proof_points.append(
            "Matches ServiceNow keystroke automation and enterprise SOE lifecycle at Australia Post"
        )
        details.append(
            ProofPointJustification(
                requirement="ITSM Automation & Endpoint Governance",
                category="automation_itsm",
                verified_evidence="Engineered custom keystroke injection automation in ServiceNow saving hundreds of hours of manual entry per month at Australia Post.",
                source_employer="Australia Post",
                alignment_score=90,
            )
        )

    if not proof_points:
        proof_points.append(
            "Matches 10 years of verified enterprise infrastructure and M365 engineering history"
        )
        details.append(
            ProofPointJustification(
                requirement="Core Enterprise Infrastructure Engineering",
                category="enterprise_scale",
                verified_evidence="10 years of verified enterprise systems administration across government, healthcare, and enterprise platforms.",
                source_employer="Capgemini / Dept of Education VIC",
                alignment_score=80,
            )
        )

    justification_score = max(50, min(100, justification_score))
    return proof_points, details, justification_score


def score_sam_job(
    job: Any,
    profile: Mapping[str, Any] | None = None,
) -> SamScoreResult:
    """Execute hyper-personalized scoring, knockouts, and proof-point synthesis.

    Directly evaluates the job against Sam Ludwig's canonical profile, enforcing
    hard knockout invariants, competency weights, and enterprise scale multipliers.
    """
    title, desc, loc, sal, remote = _normalize_job_data(job)
    full_text = f"{title} {desc} {loc}".lower()

    # 1. Knockout Evaluation
    knockout = evaluate_knockouts(job)
    _sal_pass, sal_assess, _ = evaluate_salary(sal)

    # 2. Competency & Multiplier
    comp_score, multiplier, chips = calculate_competency_and_multiplier(full_text)

    # 3. Proof Points & Justification Score
    proof_points, proof_details, justification_score = synthesize_proof_points(
        full_text
    )

    # 4. Role Archetype
    role_archetype = classify_role_archetype(job)

    # 5. Salary & Clearance Chips
    if knockout.salary_pass:
        raw_sal = sal_assess["raw"]
        if raw_sal == "Undisclosed":
            chips.append(
                MatchChip(
                    label="Salary: Undisclosed", variant="match", category="salary"
                )
            )
        else:
            chips.append(
                MatchChip(label="Salary: In Range", variant="match", category="salary")
            )
    else:
        chips.append(
            MatchChip(
                label="Salary: Below Floor", variant="knockout", category="salary"
            )
        )

    if knockout.clearance_pass:
        chips.append(
            MatchChip(label="Clearance: Ready", variant="match", category="clearance")
        )
    else:
        chips.append(
            MatchChip(
                label="Clearance: Knockout", variant="knockout", category="clearance"
            )
        )

    # 6. Overall Score Computation
    if knockout.knocked_out:
        overall_score = min(40, round(comp_score * 0.35))
        recommended_action = "Knocked Out"
    else:
        # Base alignment weights
        role_bonus = (
            15
            if any(
                w.lower() in title.lower() for w in role_archetype.split() if len(w) > 3
            )
            else 5
        )
        local_bonus = 0
        if any(k in full_text for k in ("balaclava", "3183", "south east")):
            local_bonus = 8
            chips.append(
                MatchChip(
                    label="Location: Balaclava Local",
                    variant="match",
                    category="location",
                )
            )
        elif any(k in full_text for k in ("hybrid", "flexible")):
            local_bonus = 4
            chips.append(
                MatchChip(
                    label="Location: Melbourne Hybrid",
                    variant="match",
                    category="location",
                )
            )
        elif remote or "remote" in loc.lower():
            local_bonus = 4
            chips.append(
                MatchChip(
                    label="Location: Remote", variant="match", category="location"
                )
            )

        sal_bonus = 0
        est_annual = sal_assess.get("estimated_annual", 0)
        if est_annual >= 140000:
            sal_bonus = 6

        base_calc = (
            (comp_score * 0.45 * multiplier)
            + (justification_score * 0.35)
            + role_bonus
            + local_bonus
            + sal_bonus
        )
        overall_score = max(55, min(100, round(base_calc)))

        if overall_score >= 85:
            recommended_action = "Immediate Apply"
        elif overall_score >= 70:
            recommended_action = "Strong Prospect"
        else:
            recommended_action = "Review Fluff"

    return SamScoreResult(
        overall_score=overall_score,
        base_rule_score=comp_score,
        competency_score=comp_score,
        justification_score=justification_score,
        scale_multiplier=multiplier,
        role_archetype=role_archetype,
        chips=tuple(chips),
        knockout=knockout,
        proof_points=tuple(proof_points),
        proof_point_details=tuple(proof_details),
        salary_assessment=sal_assess,
        recommended_action=recommended_action,
    )
