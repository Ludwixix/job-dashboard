"""
Universal Compensation Benchmarking, Offer Analytics & Employment Contract Risk Auditing.

Provides:
1. Australian market compensation distributions across 5 sectors (Tech, Healthcare, Finance, Trades, Legal).
2. Percentile scoring, Superannuation (11.5% SG rate), and ATO tax/take-home projections.
3. Deterministic Fair Work & National Employment Standards (NES) contract clause risk auditing.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

STATUTORY_SUPERANNUATION_RATE = 0.115  # 11.5% Australian Super Guarantee

AU_COMPENSATION_BENCHMARKS: Dict[str, Dict[str, Dict[str, int]]] = {
    "technology": {
        "junior": {"p10": 75000, "p25": 85000, "p50": 98000, "p75": 115000, "p90": 130000},
        "mid": {"p10": 105000, "p25": 120000, "p50": 135000, "p75": 155000, "p90": 175000},
        "senior": {"p10": 140000, "p25": 160000, "p50": 180000, "p75": 205000, "p90": 230000},
        "lead": {"p10": 175000, "p25": 195000, "p50": 220000, "p75": 250000, "p90": 285000},
    },
    "healthcare": {
        "junior": {"p10": 70000, "p25": 78000, "p50": 86000, "p75": 96000, "p90": 108000},
        "mid": {"p10": 88000, "p25": 96000, "p50": 108000, "p75": 122000, "p90": 135000},
        "senior": {"p10": 110000, "p25": 125000, "p50": 140000, "p75": 158000, "p90": 175000},
        "lead": {"p10": 135000, "p25": 150000, "p50": 170000, "p75": 195000, "p90": 220000},
    },
    "finance": {
        "junior": {"p10": 68000, "p25": 75000, "p50": 85000, "p75": 98000, "p90": 110000},
        "mid": {"p10": 95000, "p25": 110000, "p50": 125000, "p75": 142000, "p90": 160000},
        "senior": {"p10": 130000, "p25": 148000, "p50": 168000, "p75": 192000, "p90": 220000},
        "lead": {"p10": 170000, "p25": 195000, "p50": 225000, "p75": 260000, "p90": 300000},
    },
    "trades": {
        "junior": {"p10": 65000, "p25": 72000, "p50": 82000, "p75": 94000, "p90": 105000},
        "mid": {"p10": 85000, "p25": 98000, "p50": 115000, "p75": 132000, "p90": 150000},
        "senior": {"p10": 120000, "p25": 138000, "p50": 155000, "p75": 178000, "p90": 205000},
        "lead": {"p10": 150000, "p25": 172000, "p50": 195000, "p75": 225000, "p90": 260000},
    },
    "legal": {
        "junior": {"p10": 75000, "p25": 85000, "p50": 98000, "p75": 115000, "p90": 132000},
        "mid": {"p10": 110000, "p25": 130000, "p50": 150000, "p75": 175000, "p90": 205000},
        "senior": {"p10": 160000, "p25": 185000, "p50": 215000, "p75": 250000, "p90": 290000},
        "lead": {"p10": 210000, "p25": 245000, "p50": 285000, "p75": 330000, "p90": 390000},
    },
}

GENERAL_BENCHMARKS = {
    "junior": {"p10": 65000, "p25": 75000, "p50": 85000, "p75": 100000, "p90": 115000},
    "mid": {"p10": 90000, "p25": 105000, "p50": 120000, "p75": 140000, "p90": 160000},
    "senior": {"p10": 130000, "p25": 145000, "p50": 165000, "p75": 190000, "p90": 215000},
    "lead": {"p10": 160000, "p25": 180000, "p50": 205000, "p75": 235000, "p90": 270000},
}


def detect_seniority(title: str) -> str:
    """Classifies a job title into seniority tier: junior, mid, senior, or lead."""
    t = (title or "").lower()
    if any(w in t for w in ["lead", "principal", "head", "director", "manager", "chief", "vp", "partner", "general manager"]):
        return "lead"
    if any(w in t for w in ["senior", "sr", "specialist", "coordinator", "iv", "iii"]):
        return "senior"
    if any(w in t for w in ["junior", "graduate", "grad", "associate", "intern", "entry", "assistant"]):
        return "junior"
    return "mid"


def detect_sector_track(text: str) -> str:
    """Detects target industry sector."""
    s = (text or "").lower()
    if re.search(r"nurs|health|medic|clinic|patient|aged care|hospital|doctor", s):
        return "healthcare"
    if re.search(r"construct|builder|site supervisor|site manager|carpenter|trade|whs|foreman", s):
        return "trades"
    if re.search(r"account|cpa|\bca\b|tax|financ|bookkeep|payroll|ledger|treasury", s):
        return "finance"
    if re.search(r"legal|lawyer|counsel|paralegal|solicitor|barrister|litigat", s):
        return "legal"
    if re.search(r"cloud|azure|software|engineer|developer|devops|data|analyst|cyber|network", s):
        return "technology"
    return "general"


def calculate_australian_tax(taxable_income: float) -> Dict[str, float]:
    """
    Calculates estimated Australian income tax & Medicare levy (Stage 3 rates).
    Rates:
      $0 – $18,200: Nil
      $18,201 – $45,000: 16% on excess over $18,200
      $45,001 – $135,000: $4,288 + 30% on excess over $45,000
      $135,001 – $190,000: $31,288 + 37% on excess over $135,000
      $190,001+: $51,638 + 45% on excess over $190,000
      Medicare Levy: 2.0%
    """
    inc = max(0.0, float(taxable_income))
    base_tax = 0.0

    if inc <= 18200:
        base_tax = 0.0
    elif inc <= 45000:
        base_tax = (inc - 18200) * 0.16
    elif inc <= 135000:
        base_tax = 4288 + (inc - 45000) * 0.30
    elif inc <= 190000:
        base_tax = 31288 + (inc - 135000) * 0.37
    else:
        base_tax = 51638 + (inc - 190000) * 0.45

    medicare = inc * 0.02 if inc > 24000 else 0.0
    total_tax = round(base_tax + medicare, 2)
    net_annual = round(inc - total_tax, 2)
    net_monthly = round(net_annual / 12.0, 2)
    net_fortnightly = round(net_annual / 26.0, 2)

    return {
        "gross_annual": round(inc, 2),
        "income_tax": round(base_tax, 2),
        "medicare_levy": round(medicare, 2),
        "total_tax": total_tax,
        "net_annual": net_annual,
        "net_monthly": net_monthly,
        "net_fortnightly": net_fortnightly,
        "effective_tax_rate_percent": round((total_tax / inc * 100) if inc > 0 else 0.0, 1),
    }


def calculate_compensation_benchmark(
    base_salary: float,
    role_title: str = "",
    sector: Optional[str] = None,
    super_included: bool = False,
    location: str = "Melbourne, VIC",
) -> Dict[str, Any]:
    """
    Evaluates an offer base salary against Australian market distributions.
    """
    raw_salary = max(0.0, float(base_salary))
    active_sector = sector if sector in AU_COMPENSATION_BENCHMARKS else detect_sector_track(f"{role_title} {sector or ''}")
    seniority = detect_seniority(role_title)

    brackets = AU_COMPENSATION_BENCHMARKS.get(active_sector, GENERAL_BENCHMARKS).get(seniority, GENERAL_BENCHMARKS["mid"])

    # Handle superannuation
    if super_included:
        actual_base = round(raw_salary / (1.0 + STATUTORY_SUPERANNUATION_RATE), 2)
        super_amount = round(raw_salary - actual_base, 2)
        trp = raw_salary
    else:
        actual_base = raw_salary
        super_amount = round(actual_base * STATUTORY_SUPERANNUATION_RATE, 2)
        trp = round(actual_base + super_amount, 2)

    # Calculate percentile
    p10, p25, p50, p75, p90 = brackets["p10"], brackets["p25"], brackets["p50"], brackets["p75"], brackets["p90"]

    if actual_base <= p10:
        percentile = max(5, round(10 * (actual_base / p10))) if p10 > 0 else 10
    elif actual_base <= p25:
        percentile = round(10 + 15 * ((actual_base - p10) / (p25 - p10)))
    elif actual_base <= p50:
        percentile = round(25 + 25 * ((actual_base - p25) / (p50 - p25)))
    elif actual_base <= p75:
        percentile = round(50 + 25 * ((actual_base - p50) / (p75 - p50)))
    elif actual_base <= p90:
        percentile = round(75 + 15 * ((actual_base - p75) / (p90 - p75)))
    else:
        percentile = min(99, round(90 + 9 * ((actual_base - p90) / (p90 * 0.3))))

    # Positioning verdict
    if percentile >= 75:
        verdict = "Top Quartile Offer (Strong)"
        verdict_color = "emerald"
    elif percentile >= 50:
        verdict = "Above Median (Competitive)"
        verdict_color = "cyan"
    elif percentile >= 25:
        verdict = "Below Median (Room to Negotiate)"
        verdict_color = "amber"
    else:
        verdict = "Bottom Quartile (Under Market)"
        verdict_color = "rose"

    tax_breakdown = calculate_australian_tax(actual_base)

    return {
        "actual_base_salary": actual_base,
        "superannuation_amount": super_amount,
        "superannuation_rate_percent": round(STATUTORY_SUPERANNUATION_RATE * 100, 1),
        "total_remuneration_package": trp,
        "sector": active_sector,
        "seniority": seniority,
        "percentile": percentile,
        "verdict": verdict,
        "verdict_color": verdict_color,
        "market_bands": {
            "p10_entry": p10,
            "p25_lower": p25,
            "p50_median": p50,
            "p75_upper": p75,
            "p90_top": p90,
        },
        "tax_breakdown": tax_breakdown,
        "location": location,
    }


def scan_employment_contract_risks(contract_text: str) -> Dict[str, Any]:
    """
    Deterministic Fair Work & Australian National Employment Standards (NES) risk auditor.
    Scans for:
    1. Restraint of trade / non-compete overreach (>6 months, >10km, broad industry bans).
    2. Overtime & reasonable additional hours clauses (unpaid toil, all-inclusive clauses).
    3. Intellectual property assignment overreach (24/7 blanket ownership outside work).
    4. Asymmetric termination notice periods.
    """
    text = contract_text or ""
    flags: List[Dict[str, Any]] = []

    # 1. Restraint of Trade / Non-Compete
    restraint_match = re.search(
        r"(restraint|non-compete|covenant not to compete|restraint period|restraint area|shall not engage|shall not work for any competitor)",
        text,
        re.IGNORECASE,
    )
    if restraint_match:
        # Check excessive duration
        duration_match = re.search(r"(\b(?:12|18|24)\s*months?\b|\b(?:1|2)\s*years?\b)", text, re.IGNORECASE)
        area_match = re.search(r"(\b(?:20|50|100|250)\s*k(?:ilometers|m)\b|throughout Australia|globally|worldwide)", text, re.IGNORECASE)

        severity = "high" if (duration_match or area_match) else "medium"
        flags.append({
            "category": "Restraint of Trade / Non-Compete",
            "severity": severity,
            "title": "Post-Employment Restraint Clause Detected",
            "snippet": restraint_match.group(0),
            "description": (
                "Clauses restricting future employment are only enforceable under Australian law if strictly reasonable "
                "to protect legitimate business interests. Clauses exceeding 6 months or broad geographic boundaries "
                "are frequently viewed as punitive and unenforceable restraints of trade."
            ),
            "fair_work_guidance": "Under Australian common law and Fair Work principles, unreasonable restraints restricting a worker's livelihood are void as contrary to public policy.",
            "recommended_counter": "Propose narrowing the restraint to 3 months, limiting to direct client solicitation rather than general industry employment, and striking blanket geographic prohibitions.",
        })

    # 2. Reasonable Additional Hours / Overtime
    overtime_match = re.search(
        r"(reasonable additional hours|salary is inclusive of all hours|no overtime penalty|no additional remuneration for hours worked in excess|salary in full satisfaction)",
        text,
        re.IGNORECASE,
    )
    if overtime_match:
        flags.append({
            "category": "Working Hours & Overtime",
            "severity": "medium",
            "title": "All-Inclusive Additional Hours Clause",
            "snippet": overtime_match.group(0),
            "description": (
                "The contract designates salary as all-inclusive for any additional hours worked without explicit overtime rates "
                "or Time Off In Lieu (TOIL)."
            ),
            "fair_work_guidance": "Section 62 of the Fair Work Act 2009 allows employees to refuse unreasonable additional hours taking into account health and safety, family responsibilities, and notice given.",
            "recommended_counter": "Add a clause specifying that sustained hours beyond standard weekly hours will be compensated via Time Off In Lieu (TOIL) or reviewed after 90 days.",
        })

    # 3. Intellectual Property Overreach
    ip_overreach_match = re.search(
        r"(all intellectual property created at any time|whether during or outside working hours|whether or not using company equipment|all inventions created during the period of employment)",
        text,
        re.IGNORECASE,
    )
    if ip_overreach_match:
        flags.append({
            "category": "Intellectual Property Ownership",
            "severity": "high",
            "title": "Blanket Off-Duty Intellectual Property Assignment",
            "snippet": ip_overreach_match.group(0),
            "description": (
                "The IP assignment clause claims ownership over works or inventions created outside working hours or unrelated to company duties."
            ),
            "fair_work_guidance": "Australian courts protect an employee's private intellectual property created entirely on personal time without employer equipment or proprietary data.",
            "recommended_counter": "Amend clause to explicitly exclude inventions created outside working hours without use of company equipment, confidential information, or resources.",
        })

    # 4. Asymmetric Notice Period
    asymm_match = re.search(
        r"(employee shall provide (?:4|8|12) weeks notice.*company may terminate with (?:1|2) week)",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if asymm_match:
        flags.append({
            "category": "Termination & Notice",
            "severity": "high",
            "title": "Notice Period Asymmetry",
            "snippet": asymm_match.group(0)[:120],
            "description": "Notice period required by the employee significantly exceeds the notice period promised by the employer.",
            "fair_work_guidance": "National Employment Standards (NES) set statutory minimum notice periods for employers. Symmetrical notice periods are standard Australian practice.",
            "recommended_counter": "Request mutual notice parity (e.g. 4 weeks mutual notice for both employer and employee).",
        })

    # Calculate overall Safety Score
    high_count = sum(1 for f in flags if f["severity"] == "high")
    med_count = sum(1 for f in flags if f["severity"] == "medium")
    score = max(20, 100 - (high_count * 25) - (med_count * 12))

    if score >= 85:
        risk_rating = "Low Risk (Standard Contract)"
        rating_color = "emerald"
    elif score >= 65:
        risk_rating = "Moderate Risk (Amendments Recommended)"
        rating_color = "amber"
    else:
        risk_rating = "High Risk (Careful Redline Required)"
        rating_color = "rose"

    return {
        "contract_safety_score": score,
        "risk_rating": risk_rating,
        "rating_color": rating_color,
        "total_flags": len(flags),
        "high_risk_count": high_count,
        "medium_risk_count": med_count,
        "flags": flags,
        "summary": f"Detected {len(flags)} clause item(s) requiring candidate attention before signing.",
    }
