"""Tests for Phase 22: Cover Letter Swappability Analyzer & Anti-Template Polarizer Engine."""

import pytest
from job_dashboard.cover_letter_polarizer import (
    audit_cover_letter,
    generate_polarized_variants,
    CoverLetterAuditResult,
    CLICHE_OPENERS,
    CORPORATE_FLUFF_MAP,
)


def test_detect_canned_ai_openers():
    generic_text = (
        "I am writing to apply for the Senior Cloud Engineer position at Acme Corp. "
        "With a proven track record in DevOps, I am confident in my abilities.\n\n"
        "Over the past five years, I reduced latency by 40% using Kubernetes and Terraform.\n\n"
        "I look forward to discussing how my background fits your team."
    )
    result = audit_cover_letter(generic_text, company="Acme Corp", job_title="Senior Cloud Engineer")
    
    assert result.opener_check["has_cliche_opener"] is True
    assert "i am writing to apply" in result.opener_check["detected_opener"].lower()
    assert len(result.opener_check["suggestion"]) > 0
    assert any(c["phrase"].lower() == "proven track record" for c in result.cliches_found)


def test_unique_hook_passes_opener_check():
    opinionated_text = (
        "Most distributed architectures struggle with state synchronization when scaling beyond 10,000 req/sec. "
        "Watching Acme Corp tackle cross-region DynamoDB replication inspired this note.\n\n"
        "At NextGen, I redesigned our event-driven Kafka broker layer, cutting p99 tail latency from 450ms to 62ms while supporting 1.2M daily active users.\n\n"
        "If you are looking for someone to eliminate cache invalidation bottlenecks on your platform, let's schedule a 15-minute sync."
    )
    result = audit_cover_letter(opinionated_text, company="Acme Corp", job_title="Staff Platform Engineer")
    
    assert result.opener_check["has_cliche_opener"] is False
    assert result.opener_check["detected_opener"] is None
    assert result.swappability_score < 40
    assert result.swappability_level in ("Low Risk (Highly Specific)", "Moderate Risk")


def test_swappability_risk_index():
    completely_swappable = (
        "I am an experienced engineer who is results-driven and a great team player. "
        "I have worked with many technologies and always hit the ground running.\n\n"
        "In my previous role, I worked on software development and collaborated with cross-functional stakeholders.\n\n"
        "Please feel free to reach out to me for an interview."
    )
    result = audit_cover_letter(completely_swappable, company="Canva", job_title="Backend Engineer")
    
    # Missing company name, zero entity hooks, high cliché count -> high swappability
    assert result.swappability_score >= 70
    assert result.swappability_level == "Critical Risk (Completely Swappable)"
    assert result.company_mention_count == 0
    assert result.overall_verdict == "Fail - Terminal Genericism"


def test_three_paragraph_structure_analysis():
    two_paragraphs = (
        "Acme Corp is breaking ground in automated billing systems.\n\n"
        "I built the microservices pipeline for billing at FinTech Co, saving $2M in lost revenue."
    )
    result_two = audit_cover_letter(two_paragraphs, company="Acme Corp", job_title="Billing Engineer")
    assert len(result_two.paragraph_analysis) == 2
    assert any("Expected 3 paragraphs" in r for r in result_two.recommendations)

    three_paragraphs = (
        "Acme Corp's recent release of its GraphQL gateway marks a turning point for client performance.\n\n"
        "Over the last three years at TechFlow, I scaled our Apollo federation layer to 50 microservices while maintaining 99.99% uptime.\n\n"
        "Let's connect this week to discuss where your gateway roadmap is headed."
    )
    result_three = audit_cover_letter(three_paragraphs, company="Acme Corp", job_title="API Engineer")
    assert len(result_three.paragraph_analysis) == 3
    assert result_three.paragraph_analysis[0]["role"] == "The Hook (Company Trajectory & Context)"
    assert result_three.paragraph_analysis[1]["role"] == "The Proof Narrative (Quantified Impact)"
    assert result_three.paragraph_analysis[2]["role"] == "The Low-Friction Close (Confident Call to Action)"


def test_corporate_cliche_replacements():
    fluffy_text = (
        "I am a passionate and dynamic professional who brings synergy to high-performing teams.\n\n"
        "I think outside the box to deliver customer-centric outcomes and hit the ground running.\n\n"
        "Thank you in advance for your consideration."
    )
    result = audit_cover_letter(fluffy_text, company="Atlassian", job_title="Product Manager")
    
    cliche_phrases = [c["phrase"].lower() for c in result.cliches_found]
    assert "synergy" in cliche_phrases or "think outside the box" in cliche_phrases
    assert len(result.cliches_found) >= 3
    for cliche in result.cliches_found:
        assert len(cliche["fix"]) > 0


def test_generate_polarized_variants():
    job = {
        "title": "Senior Cloud Infrastructure Engineer",
        "company": "Canva",
        "description": "Scale our Kubernetes clusters across multi-region AWS environments, optimize Terraform pipelines, and manage 200M user load.",
    }
    profile = {
        "name": "Sam Ludwig",
        "title": "Principal Systems Engineer",
        "skills": ["AWS", "Kubernetes", "Terraform", "Python", "Prometheus"],
    }
    
    variants = generate_polarized_variants(job, profile)
    
    assert len(variants) == 3
    ids = [v["id"] for v in variants]
    assert "high_conviction" in ids
    assert "systems_architect" in ids
    assert "cultural_outlier" in ids

    for v in variants:
        assert len(v["paragraphs"]) == 3
        assert "Canva" in v["paragraphs"][0] or "Canva" in v["paragraphs"][1] or "Canva" in v["paragraphs"][2]
        assert len(v["hook_explanation"]) > 0


def test_audit_empty_text():
    result = audit_cover_letter("", company="TestCo", job_title="Dev")
    assert result.swappability_score == 100
    assert result.swappability_level == "Critical Risk (Completely Swappable)"
    assert len(result.recommendations) > 0


def test_cover_letter_polarizer_api_endpoints(tmp_path):
    import io
    import json
    from unittest.mock import MagicMock
    from job_dashboard.web import DashboardApp, make_handler
    from job_dashboard.models import Job

    app = DashboardApp(
        profile={
            "headline": "Senior Cloud Infrastructure Engineer",
            "about": "Cloud Engineer specializing in AWS, Terraform, and Python.",
            "coreSkills": ["AWS", "Terraform", "Python", "Kubernetes"],
        },
        sources=[],
        data_dir=tmp_path,
    )
    app.repository.replace_jobs([{
        "id": "test-cov-1",
        "title": "Staff Platform Engineer",
        "company": "Canva",
        "location": "Sydney, NSW",
        "description": "Scale Kubernetes, manage AWS and Terraform infrastructure.",
        "url": "https://example.com/job",
    }])
    handler_cls = make_handler(app)

    # 1. Test POST /api/cover-letter/audit
    payload = {
        "cover_letter": "I am writing to apply for the role at Canva.\n\nI have scaled Terraform and AWS systems.\n\nLet's talk.",
        "company": "Canva",
        "title": "Staff Platform Engineer",
        "description": "Scale Kubernetes, manage AWS and Terraform.",
    }
    body = json.dumps(payload).encode("utf-8")
    handler1 = handler_cls.__new__(handler_cls)
    handler1.path = "/api/cover-letter/audit"
    handler1.headers = {"Content-Length": str(len(body))}
    handler1.rfile = io.BytesIO(body)
    handler1.wfile = io.BytesIO()
    handler1.client_address = ("127.0.0.1", 12345)
    handler1.requestline = "POST /api/cover-letter/audit HTTP/1.1"
    handler1.request_version = "HTTP/1.1"
    handler1.command = "POST"
    handler1.send_response = MagicMock()
    handler1.send_header = MagicMock()
    handler1.end_headers = MagicMock()

    handler1.do_POST()
    response_data = json.loads(handler1.wfile.getvalue().decode("utf-8"))
    assert response_data["success"] is True
    assert "audit" in response_data
    assert response_data["audit"]["opener_check"]["has_cliche_opener"] is True

    # 2. Test GET /api/jobs/{id}/cover-letter-audit
    handler2 = handler_cls.__new__(handler_cls)
    handler2.path = "/api/jobs/test-cov-1/cover-letter-audit"
    handler2.headers = {}
    handler2.rfile = io.BytesIO()
    handler2.wfile = io.BytesIO()
    handler2.client_address = ("127.0.0.1", 12345)
    handler2.requestline = "GET /api/jobs/test-cov-1/cover-letter-audit HTTP/1.1"
    handler2.request_version = "HTTP/1.1"
    handler2.command = "GET"
    handler2.send_response = MagicMock()
    handler2.send_header = MagicMock()
    handler2.end_headers = MagicMock()

    handler2.do_GET()
    response_data2 = json.loads(handler2.wfile.getvalue().decode("utf-8"))
    assert response_data2["success"] is True
    assert response_data2["company"] == "Canva"
    assert len(response_data2["variants"]) == 3

    # 3. Test POST /api/cover-letter/polarize
    pol_body = json.dumps({
        "job": {"title": "Principal Architect", "company": "Atlassian"},
        "profile": {"skills": ["Distributed Systems", "Cloud"]},
    }).encode("utf-8")
    handler3 = handler_cls.__new__(handler_cls)
    handler3.path = "/api/cover-letter/polarize"
    handler3.headers = {"Content-Length": str(len(pol_body))}
    handler3.rfile = io.BytesIO(pol_body)
    handler3.wfile = io.BytesIO()
    handler3.client_address = ("127.0.0.1", 12345)
    handler3.requestline = "POST /api/cover-letter/polarize HTTP/1.1"
    handler3.request_version = "HTTP/1.1"
    handler3.command = "POST"
    handler3.send_response = MagicMock()
    handler3.send_header = MagicMock()
    handler3.end_headers = MagicMock()

    handler3.do_POST()
    response_data3 = json.loads(handler3.wfile.getvalue().decode("utf-8"))
    assert response_data3.get("success") is True
    assert len(response_data3["variants"]) == 3
