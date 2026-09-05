"""Tests for Semantic Density & Content Generation Engine (Phase 3)."""

from job_dashboard.semantic_tailoring import (
    eradicate_fluff,
    localize_australian,
    extract_quantified_metric,
    anchor_achievement,
    analyze_semantic_gap
)


def test_eradicate_fluff_removes_subjective_jargon():
    text = "A results-driven team player with a proven track record, dynamic professional, and highly motivated self-starter."
    cleaned = eradicate_fluff(text)
    assert "results-driven" not in cleaned.lower()
    assert "team player" not in cleaned.lower()
    assert "proven track record" not in cleaned.lower()
    assert "dynamic professional" not in cleaned.lower()
    assert "self-starter" not in cleaned.lower()


def test_localize_australian_converts_spelling():
    us_text = "We prioritize optimization, organize data, utilize defense programs, and analyze behavior in the center."
    au_text = localize_australian(us_text)
    assert "prioritise" in au_text
    assert "optimisation" in au_text
    assert "organise" in au_text
    assert "utilise" in au_text
    assert "defence" in au_text
    assert "programme" in au_text
    assert "analyse" in au_text
    assert "behaviour" in au_text
    assert "centre" in au_text


def test_extract_quantified_metric_finds_metrics():
    assert extract_quantified_metric("Maintained 99.9% production uptime across 660,000 users") == "99.9%"
    assert extract_quantified_metric("Automated deployment across 200+ servers") in ["200+ servers", "200+"]
    assert extract_quantified_metric("Managed a budget of $2.5M annually") in ["$2.5M", "$ 2.5M"]


def test_anchor_achievement_structures_formula():
    raw = "I was a passionate team player who built PowerShell automation to speed up processing time by 87%."
    anchored = anchor_achievement(raw)
    assert anchored.active_verb in ["Automated", "Engineered", "Delivered", "Built"]
    assert "passionate" not in anchored.anchored.lower()
    assert "team player" not in anchored.anchored.lower()
    assert "87%" in anchored.metric


def test_analyze_semantic_gap_high_alignment():
    job = {
        "id": "job_high_align",
        "title": "Senior Systems Engineer - Microsoft 365 & Azure",
        "company": "Enterprise Cloud Corp",
        "description": "Seeking an experienced Senior Systems Engineer to manage Microsoft 365, Azure, Entra ID, and Intune."
    }
    profile = {
        "name": "Sam Ludwig",
        "coreSkills": ["Microsoft 365", "Azure", "Entra ID", "Intune", "PowerShell"],
        "fullWorkExperienceText": "Managed Microsoft 365 and Azure environments with Entra ID."
    }
    diagnostic = analyze_semantic_gap(job, profile)
    assert diagnostic.job_id == "job_high_align"
    assert diagnostic.semantic_density_score >= 80
    assert diagnostic.recommended_action == "pursue_high_conviction"
    assert "Microsoft 365" in diagnostic.matched_competencies or "Azure" in diagnostic.matched_competencies
    assert len(diagnostic.anchored_achievements) > 0
    assert diagnostic.localization == "en-AU"


def test_analyze_semantic_gap_low_alignment():
    job = {
        "id": "job_low_align",
        "title": "Clinical Nurse Specialist - Intensive Care",
        "company": "St Vincent's Hospital",
        "description": "Registered nurse required with AHPRA registration, triage experience, and medication administration."
    }
    profile = {
        "name": "Sam Ludwig",
        "coreSkills": ["Microsoft 365", "Azure", "PowerShell"],
        "fullWorkExperienceText": "Managed IT servers and SharePoint."
    }
    diagnostic = analyze_semantic_gap(job, profile)
    assert diagnostic.semantic_density_score < 60
    assert diagnostic.recommended_action in ["skip_low_alignment", "pursue_with_tailoring"]
    assert "Weak semantic density" in diagnostic.diagnostic_summary or "Moderate conceptual alignment" in diagnostic.diagnostic_summary
