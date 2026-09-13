"""SEEK Pass & Verified Credentials Pre-Qualification Auditor.

Analyzes job descriptions for Australian mandatory and regulated credentials,
cross-references candidate profiles to detect algorithmic knockout risks,
calculates SEEK Pass Readiness Scores, and synthesizes 1-click verified responses.
"""

from __future__ import annotations

import re
from typing import Any


CREDENTIAL_DOMAINS: dict[str, dict[str, Any]] = {
    "right_to_work": {
        "label": "Australian Work Rights & Citizenship",
        "authority": "Department of Home Affairs (VEVO)",
        "authority_url": "https://online.immi.gov.au/evo/firstParty",
        "turnaround": "Instant via VEVO / SEEK Pass",
        "patterns": [
            r"(?:australian|nz|new zealand)\s*(?:citizen|citizenship)",
            r"permanent\s*resid(?:ent|ency)|pr\b",
            r"unrestricted\s*(?:work|working)\s*rights?",
            r"full\s*working\s*rights?",
            r"visa\s*sponsorship\s*(?:not|is\s*not)\s*available",
            r"must\s*have\s*(?:the\s*)?right\s*to\s*work\s*in\s*australia",
        ],
        "profile_keys": ["work_rights", "citizenship", "visa_status"],
    },
    "security_clearance": {
        "label": "AGSVA Australian Government Security Clearance",
        "authority": "Australian Government Security Vetting Agency (AGSVA)",
        "authority_url": "https://www.defence.gov.au/security/clearances",
        "turnaround": "3 to 12 months (requires Australian Citizen sponsor)",
        "patterns": [
            r"baseline\s*(?:security\s*)?clearance",
            r"negative\s*vetting\s*(?:level\s*)?1|nv1\b",
            r"negative\s*vetting\s*(?:level\s*)?2|nv2\b",
            r"positive\s*vetting|pv\b",
            r"agsva\b",
            r"defence\s*(?:security\s*)?clearance",
        ],
        "profile_keys": ["clearances", "security_clearances", "credentials"],
    },
    "criminal_history": {
        "label": "National Police Check (Criminal Record)",
        "authority": "Australian Criminal Intelligence Commission (ACIC) / Fit2Work",
        "authority_url": "https://www.acic.gov.au/services/national-police-checking-service",
        "turnaround": "1 to 3 business days online",
        "patterns": [
            r"national\s*police\s*(?:certificate|check)",
            r"criminal\s*(?:record|history)\s*check",
            r"police\s*(?:check|clearance)",
            r"afac\s*(?:check|clearance)",
            r"fit2work",
        ],
        "profile_keys": ["credentials", "certifications", "licences", "clearances"],
    },
    "working_with_children": {
        "label": "Working with Children Check (WWCC / Blue Card / WWVP)",
        "authority": "State Statutory Bodies (Service VIC / Service NSW / Blue Card QLD)",
        "authority_url": "https://www.service.vic.gov.au/services/working-with-children",
        "turnaround": "3 to 21 business days",
        "patterns": [
            r"working\s*with\s*children\s*(?:check|card)?|wwcc\b",
            r"blue\s*card\b",
            r"working\s*with\s*vulnerable\s*people|wwvp\b",
            r"child\s*protection\s*clearance",
        ],
        "profile_keys": ["credentials", "certifications", "licences"],
    },
    "ndis_worker": {
        "label": "NDIS Worker Screening Check",
        "authority": "NDIS Quality and Safeguards Commission",
        "authority_url": "https://www.ndiscommission.gov.au/workers/worker-screening-workers",
        "turnaround": "1 to 3 weeks",
        "patterns": [
            r"ndis\s*worker\s*screening(?:\s*check)?",
            r"ndis\s*clearance",
            r"ndis\s*check",
        ],
        "profile_keys": ["credentials", "certifications", "licences"],
    },
    "occupational_licences": {
        "label": "Occupational & Safety Licences (White Card / Driver / High Risk)",
        "authority": "SafeWork Australia / State Transport Authorities",
        "authority_url": "https://www.safeworkaustralia.gov.au/",
        "turnaround": "1 day course (White Card) / Immediate (Licence)",
        "patterns": [
            r"(?:construction\s*)?white\s*card|cpccwhs1001",
            r"(?:australian\s*)?driver'?s?\s*licen[sc]e",
            r"valid\s*c[\s-]class\s*licen[sc]e",
            r"forklift\s*licen[sc]e|lf\s*licen[sc]e|lo\s*licen[sc]e",
            r"high\s*risk\s*work\s*licen[sc]e|hrwl\b",
            r"first\s*aid|hltaid009|hltaid011|cpr\b",
        ],
        "profile_keys": ["licences", "credentials", "certifications"],
    },
    "healthcare_ahpra": {
        "label": "AHPRA Professional Registration",
        "authority": "Australian Health Practitioner Regulation Agency (AHPRA)",
        "authority_url": "https://www.ahpra.gov.au/",
        "turnaround": "4 to 8 weeks (Mandatory statutory requirement)",
        "patterns": [
            r"ahpra\b",
            r"registered\s*nurse|rn\b",
            r"medical\s*board\s*of\s*australia",
            r"pharmacy\s*board",
            r"allied\s*health\s*registration",
        ],
        "profile_keys": ["credentials", "certifications", "licences"],
    },
    "finance_professional": {
        "label": "Accounting & Finance Professional Accreditation",
        "authority": "CPA Australia / Chartered Accountants ANZ",
        "authority_url": "https://www.cpaaustralia.com.au/",
        "turnaround": "Professional body membership verification",
        "patterns": [
            r"\bcpa\b|cpa\s*australia",
            r"ca\s*anz|chartered\s*accountant",
            r"institute\s*of\s*public\s*accountants|ipa\b",
            r"fasea\b|financial\s*adviser\s*register",
        ],
        "profile_keys": ["credentials", "certifications", "skills"],
    },
}


def extract_seek_pass_requirements(jd_text: str, job_title: str = "") -> list[dict[str, Any]]:
    """Extract Australian credential requirements from job description text and title."""
    full_text = f"{job_title}\n{jd_text or ''}".lower()
    requirements: list[dict[str, Any]] = []

    for domain_id, domain_meta in CREDENTIAL_DOMAINS.items():
        for pattern in domain_meta["patterns"]:
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                matched_str = match.group(0)
                # Determine mandatory vs preferred based on surrounding context
                start_idx = max(0, match.start() - 80)
                end_idx = min(len(full_text), match.end() + 80)
                context_window = full_text[start_idx:end_idx]

                is_mandatory = bool(
                    re.search(
                        r"(?:must|mandatory|essential|required|prior\s*to|commencing|prerequisite|non[\s-]negotiable)",
                        context_window,
                        re.IGNORECASE,
                    )
                )
                if not is_mandatory:
                    # Clearances and RTW default to mandatory if stated
                    if domain_id in ("right_to_work", "security_clearance", "healthcare_ahpra", "ndis_worker"):
                        is_mandatory = True

                req_id = f"{domain_id}_{abs(hash(matched_str)) % 10000:04d}"
                requirements.append(
                    {
                        "id": req_id,
                        "domain": domain_id,
                        "name": domain_meta["label"],
                        "authority": domain_meta["authority"],
                        "authority_url": domain_meta["authority_url"],
                        "turnaround": domain_meta["turnaround"],
                        "mandatory": is_mandatory,
                        "matched_text": matched_str,
                        "context_snippet": context_window.strip().replace("\n", " "),
                    }
                )
                break  # Record one requirement per domain to avoid duplicates

    return requirements


def audit_candidate_credentials(
    requirements: list[dict[str, Any]], profile: dict[str, Any]
) -> list[dict[str, Any]]:
    """Audit candidate profile against extracted credential requirements."""
    audited: list[dict[str, Any]] = []
    
    # Flatten candidate profile credentials & clearances
    candidate_tokens: list[str] = []
    for key in ["work_rights", "citizenship", "visa_status", "summary", "headline"]:
        val = profile.get(key)
        if isinstance(val, str) and val.strip():
            candidate_tokens.append(val.lower())

    for list_key in ["credentials", "clearances", "security_clearances", "certifications", "licences", "skills"]:
        items = profile.get(list_key, [])
        if isinstance(items, list):
            for item in items:
                if isinstance(item, str):
                    candidate_tokens.append(item.lower())
                elif isinstance(item, dict):
                    candidate_tokens.append(json.dumps(item).lower())

    candidate_corpus = " ".join(candidate_tokens)

    for req in requirements:
        domain = req["domain"]
        domain_meta = CREDENTIAL_DOMAINS.get(domain, {})
        patterns = domain_meta.get("patterns", [])
        
        # Check if candidate holds this credential
        is_verified = False
        evidence = ""

        # Special check for right to work
        if domain == "right_to_work":
            if any(term in candidate_corpus for term in ["australian citizen", "citizen", "pr", "permanent resident", "full working rights", "unrestricted"]):
                is_verified = True
                evidence = "Australian Citizen / Permanent Resident with full unrestricted working rights"
        else:
            for pat in patterns:
                cand_match = re.search(pat, candidate_corpus, re.IGNORECASE)
                if cand_match:
                    is_verified = True
                    evidence = f"Matched credential in profile: '{cand_match.group(0)}'"
                    break

        if is_verified:
            status = "VERIFIED"
            action = "Credential verified in profile. Ready to link or present via SEEK Pass."
        elif req.get("mandatory", False):
            # High risk knockout if mandatory statutory requirement
            if domain in ("security_clearance", "healthcare_ahpra"):
                status = "KNOCKOUT_RISK"
                action = f"Mandatory qualification missing. Application risks automatic disqualification to 'Not Suitable' bucket. {domain_meta['authority']} accreditation required."
            elif domain == "right_to_work":
                status = "KNOCKOUT_RISK"
                action = "Unrestricted Australian working rights required. Non-citizens without valid work visa will be automatically screened out."
            else:
                status = "ACTION_REQUIRED"
                action = f"Apply immediately via {domain_meta['authority']} ({domain_meta['turnaround']}). State that check is in progress in application notes."
        else:
            status = "ACTION_REQUIRED"
            action = f"Obtain or link via {domain_meta['authority']} to boost competitive ranking."

        audited.append(
            {
                **req,
                "status": status,
                "evidence": evidence,
                "action_steps": action,
            }
        )

    return audited


def calculate_readiness_score(audited_requirements: list[dict[str, Any]]) -> dict[str, Any]:
    """Calculate overall SEEK Pass readiness index and knockout risk classification."""
    if not audited_requirements:
        return {
            "readiness_score": 100,
            "risk_level": "EXEMPT",
            "verified_count": 0,
            "action_count": 0,
            "knockout_count": 0,
            "total_requirements": 0,
            "summary": "No mandatory statutory or SEEK Pass credential requirements detected. Full application clearance.",
        }

    total_weight = 0.0
    verified_weight = 0.0
    knockout_count = 0
    action_count = 0
    verified_count = 0

    for item in audited_requirements:
        weight = 2.0 if item.get("mandatory", False) else 1.0
        total_weight += weight
        status = item.get("status", "ACTION_REQUIRED")

        if status == "VERIFIED":
            verified_weight += weight
            verified_count += 1
        elif status == "KNOCKOUT_RISK":
            knockout_count += 1
        else:
            action_count += 1

    readiness = int(round((verified_weight / total_weight) * 100)) if total_weight > 0 else 100

    if knockout_count > 0:
        risk_level = "HIGH_RISK_KNOCKOUT"
        summary = f"High Risk: {knockout_count} mandatory credential(s) missing. Application will likely trigger algorithmic knockout rules."
    elif action_count > 0:
        risk_level = "MEDIUM_RISK"
        summary = f"Medium Risk: {action_count} credential(s) require action or declaration before commencement."
    else:
        risk_level = "PASS_READY"
        summary = "100% Verified: All credential requirements satisfied in candidate profile. Ready for instant SEEK Pass submission."

    return {
        "readiness_score": readiness,
        "risk_level": risk_level,
        "verified_count": verified_count,
        "action_count": action_count,
        "knockout_count": knockout_count,
        "total_requirements": len(audited_requirements),
        "summary": summary,
    }


def generate_seek_pass_responses(
    audited_requirements: list[dict[str, Any]], profile: dict[str, Any]
) -> list[dict[str, Any]]:
    """Synthesize copyable pre-screening answers tailored for SEEK Pass forms."""
    responses: list[dict[str, Any]] = []

    for item in audited_requirements:
        domain = item["domain"]
        status = item["status"]
        name = item["name"]

        if domain == "right_to_work":
            resp = (
                "Yes. I am an Australian Citizen with unrestricted, permanent rights to work in Australia. "
                "No visa sponsorship is required."
            )
        elif domain == "security_clearance":
            if status == "VERIFIED":
                resp = "Yes. I hold an active Australian Government Security Clearance verified through AGSVA."
            else:
                resp = (
                    "I am an Australian Citizen eligible to obtain and maintain an AGSVA security clearance "
                    "(Baseline / NV1) upon sponsorship."
                )
        elif domain == "criminal_history":
            if status == "VERIFIED":
                resp = (
                    "Yes. I hold a current, clean National Police Certificate issued within Australia and am "
                    "readily able to provide verification or consent to an ACIC check."
                )
            else:
                resp = (
                    "Yes. I am willing and able to provide a current National Police Certificate and consent "
                    "to background screening prior to appointment."
                )
        elif domain == "working_with_children":
            if status == "VERIFIED":
                resp = "Yes. I hold a valid Working with Children Check (Employee status) verified for child-related work."
            else:
                resp = "I am fully eligible to apply for and hold a valid Working with Children Check upon offer."
        elif domain == "ndis_worker":
            if status == "VERIFIED":
                resp = "Yes. I hold a current NDIS Worker Screening Check clearance."
            else:
                resp = "I am eligible and prepared to complete the NDIS Worker Screening Check application immediately."
        elif domain == "occupational_licences":
            resp = (
                "Yes. I hold the relevant valid Australian driver's licence and required occupational certifications "
                "(e.g., SafeWork White Card)."
            )
        elif domain == "healthcare_ahpra":
            if status == "VERIFIED":
                resp = "Yes. I hold current, unrestricted professional registration with AHPRA."
            else:
                resp = "My qualifications are aligned with AHPRA requirements; registration details available upon request."
        elif domain == "finance_professional":
            resp = "Yes. I hold active professional accreditation and membership in good standing."
        else:
            resp = "Yes. I meet all prerequisite regulatory and statutory credentials for this position."

        responses.append(
            {
                "requirement_id": item["id"],
                "requirement_name": name,
                "domain": domain,
                "prompt_question": f"Do you hold or are you eligible for {name}?",
                "response": resp,
                "status": status,
            }
        )

    return responses


def generate_seek_pass_report(job: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    """Generate comprehensive SEEK Pass readiness report and exportable Markdown dossier."""
    job_id = str(job.get("id", ""))
    job_title = job.get("title", "Position")
    company = job.get("company", "Employer")
    description = job.get("description", "")

    reqs = extract_seek_pass_requirements(description, job_title)
    audited = audit_candidate_credentials(reqs, profile)
    score_data = calculate_readiness_score(audited)
    responses = generate_seek_pass_responses(audited, profile)

    # Markdown Dossier Generation
    dossier_lines = [
        f"# SEEK Pass & Verified Credentials Pre-Qualification Dossier",
        f"**Target Role**: {job_title} | **Employer**: {company} | **Candidate**: {profile.get('name', 'Candidate')}",
        f"**SEEK Pass Readiness Index**: {score_data['readiness_score']}% ({score_data['risk_level']})",
        "",
        f"### Executive Summary",
        score_data["summary"],
        "",
        "| Credential Requirement | Domain | Mandatory | Status | Issuing Authority | Turnaround |",
        "|---|---|:---:|:---:|---|---|",
    ]

    for item in audited:
        mand_str = "Yes" if item.get("mandatory") else "No"
        status_icon = "✅ VERIFIED" if item["status"] == "VERIFIED" else ("⛔ KNOCKOUT RISK" if item["status"] == "KNOCKOUT_RISK" else "⚠️ ACTION REQUIRED")
        dossier_lines.append(
            f"| {item['name']} | {item['domain']} | {mand_str} | {status_icon} | [{item['authority']}]({item['authority_url']}) | {item['turnaround']} |"
        )

    if audited:
        dossier_lines.extend([
            "",
            "### Pre-Screening Questionnaire Response Scripts (1-Click Ready)",
        ])
        for resp in responses:
            dossier_lines.extend([
                f"**Q: {resp['prompt_question']}**",
                f"> *\"{resp['response']}\"*",
                "",
            ])

        dossier_lines.extend([
            "### Recommended Action Plan & Next Steps",
        ])
        for item in audited:
            if item["status"] != "VERIFIED":
                dossier_lines.append(f"- **{item['name']}**: {item['action_steps']} (Link: {item['authority_url']})")

    dossier_markdown = "\n".join(dossier_lines)

    return {
        "job_id": job_id,
        "job_title": job_title,
        "company": company,
        "readiness_score": score_data["readiness_score"],
        "risk_level": score_data["risk_level"],
        "summary": score_data["summary"],
        "verified_count": score_data["verified_count"],
        "action_count": score_data["action_count"],
        "knockout_count": score_data["knockout_count"],
        "total_requirements": score_data["total_requirements"],
        "audited_requirements": audited,
        "screening_responses": responses,
        "dossier_markdown": dossier_markdown,
    }

