import json
import pytest
from job_dashboard.inbound_sourcing import (
    evaluate_boolean_query,
    generate_recruiter_boolean_queries,
    audit_linkedin_indexability,
    generate_boolean_optimized_headlines,
    generate_keyword_about_index,
)


def test_boolean_evaluator_simple_and():
    text = "Experienced Senior Cloud Engineer specializing in AWS and Terraform deployment."
    res = evaluate_boolean_query("AWS AND Terraform", text)
    assert res["is_match"] is True
    assert "AWS" in res["matched_terms"]
    assert "Terraform" in res["matched_terms"]

    res_fail = evaluate_boolean_query("AWS AND Kubernetes", text)
    assert res_fail["is_match"] is False
    assert "Kubernetes" in res_fail["missing_terms"]


def test_boolean_evaluator_quoted_phrases_and_or():
    text = "Lead Systems Architect with deep Microsoft Azure experience and PowerShell scripting."
    query = '"Systems Architect" AND (Azure OR AWS) AND PowerShell'
    res = evaluate_boolean_query(query, text)
    assert res["is_match"] is True
    assert "Systems Architect" in res["matched_terms"]
    assert "Azure" in res["matched_terms"]


def test_boolean_evaluator_not_operator():
    text = "Junior Systems Administrator with basic Linux and Python knowledge."
    query = "Systems Administrator NOT Junior"
    res = evaluate_boolean_query(query, text)
    assert res["is_match"] is False  # Fails because 'Junior' is present

    senior_text = "Senior Systems Administrator with extensive experience."
    res_senior = evaluate_boolean_query(query, senior_text)
    assert res_senior["is_match"] is True


def test_boolean_evaluator_nested_parentheses():
    text = "Full Stack Engineer proficient in TypeScript, React, and Node.js."
    query = '("Full Stack Engineer" OR "Software Developer") AND (TypeScript OR JavaScript) NOT Python'
    res = evaluate_boolean_query(query, text)
    assert res["is_match"] is True

    python_text = "Full Stack Engineer proficient in Python, TypeScript, React."
    res_fail = evaluate_boolean_query(query, python_text)
    assert res_fail["is_match"] is False  # Python excluded


def test_recruiter_queries_generator():
    queries = generate_recruiter_boolean_queries(
        title="Senior Cloud Infrastructure Engineer",
        skills=["Azure", "Terraform", "PowerShell", "Kubernetes"],
        industry="Technology"
    )
    assert len(queries) >= 4
    for q in queries:
        assert "query" in q
        assert "strategy" in q
        assert "AND" in q["query"] or "OR" in q["query"]


def test_indexability_audit_metrics():
    good_headline = "Senior Cloud Engineer | Azure, Terraform, PowerShell | Infrastructure Automation"
    good_about = "Experienced Cloud Engineer specializing in cloud infrastructure, Kubernetes, and DevSecOps. Core Skills: Azure, Terraform, CI/CD."
    
    audit_good = audit_linkedin_indexability(
        headline=good_headline,
        about=good_about,
        target_role="Senior Cloud Engineer",
        core_skills=["Azure", "Terraform", "PowerShell", "Kubernetes"]
    )
    assert audit_good["inbound_visibility_score"] >= 75
    assert len(audit_good["recommendations"]) >= 0

    vague_headline = "Passionate Guru & Rockstar Ninja innovating the digital future"
    vague_about = "I am a results-driven professional who loves teamwork and synergy."
    audit_vague = audit_linkedin_indexability(
        headline=vague_headline,
        about=vague_about,
        target_role="Cloud Engineer",
        core_skills=["Azure", "Terraform"]
    )
    assert audit_vague["inbound_visibility_score"] < 50
    assert any("literal" in r.lower() or "vague" in r.lower() or "headline" in r.lower() for r in audit_vague["recommendations"])


def test_curly_quotes_and_stop_word_warning():
    query_with_curly_quotes = '“Cloud Engineer” AND (Azure OR AWS)'
    res = evaluate_boolean_query(query_with_curly_quotes, "Cloud Engineer with Azure")
    assert res["has_curly_quotes_warning"] is True


def test_generate_headlines_and_about_index():
    headlines = generate_boolean_optimized_headlines(
        target_title="Systems & Cloud Engineer",
        core_skills=["Azure", "Intune", "PowerShell", "M365"],
        industry="Technology"
    )
    assert len(headlines) == 3
    for h in headlines:
        assert len(h) <= 220  # LinkedIn headline character limit
        assert "Engineer" in h

    about_index = generate_keyword_about_index(
        target_title="Systems & Cloud Engineer",
        core_skills=["Azure", "Intune", "PowerShell", "M365"],
        scale_metrics="5,000+ Endpoints, 99.9% Uptime"
    )
    assert "CORE COMPETENCIES" in about_index
    assert "TECHNICAL ECOSYSTEM" in about_index


def test_inbound_sourcing_api_endpoints(tmp_path):
    import io
    from unittest.mock import MagicMock
    from job_dashboard.web import DashboardApp, make_handler

    app = DashboardApp(
        profile={
            "headline": "Senior Cloud Infrastructure Engineer",
            "about": "Cloud Engineer specializing in Azure, Terraform, PowerShell, and CI/CD automation.",
            "coreSkills": ["Azure", "Terraform", "PowerShell", "Intune"],
        },
        sources=[],
        data_dir=tmp_path,
    )
    handler_cls = make_handler(app)

    # 1. Test GET /api/inbound-sourcing/queries
    handler1 = handler_cls.__new__(handler_cls)
    handler1.path = "/api/inbound-sourcing/queries?title=Cloud%20Engineer&industry=Technology"
    handler1.headers = {}
    handler1.rfile = io.BytesIO()
    handler1.wfile = io.BytesIO()
    handler1.client_address = ("127.0.0.1", 12345)
    handler1.send_response = MagicMock()
    handler1.send_header = MagicMock()
    handler1.end_headers = MagicMock()

    handler1.do_GET()
    res1 = json.loads(handler1.wfile.getvalue().decode("utf-8"))
    assert res1["success"] is True
    assert len(res1["queries"]) >= 4

    # 2. Test POST /api/inbound-sourcing/test-query
    post_body = json.dumps({
        "query": '"Cloud Engineer" AND (Azure OR AWS)',
        "text": "Experienced Cloud Engineer with deep Azure skills."
    }).encode("utf-8")
    handler2 = handler_cls.__new__(handler_cls)
    handler2.path = "/api/inbound-sourcing/test-query"
    handler2.headers = {"Content-Length": str(len(post_body))}
    handler2.rfile = io.BytesIO(post_body)
    handler2.wfile = io.BytesIO()
    handler2.client_address = ("127.0.0.1", 12345)
    handler2.send_response = MagicMock()
    handler2.send_header = MagicMock()
    handler2.end_headers = MagicMock()

    handler2.do_POST()
    res2 = json.loads(handler2.wfile.getvalue().decode("utf-8"))
    assert res2["success"] is True
    assert res2["result"]["is_match"] is True

    # 3. Test POST /api/inbound-sourcing/audit
    audit_body = json.dumps({
        "headline": "Senior Cloud Engineer | Azure, Terraform | DevSecOps",
        "about": "Cloud Engineer with Azure and Terraform expertise. Core Competencies: Infrastructure-as-Code.",
        "target_role": "Senior Cloud Engineer",
        "core_skills": ["Azure", "Terraform", "PowerShell"]
    }).encode("utf-8")
    handler3 = handler_cls.__new__(handler_cls)
    handler3.path = "/api/inbound-sourcing/audit"
    handler3.headers = {"Content-Length": str(len(audit_body))}
    handler3.rfile = io.BytesIO(audit_body)
    handler3.wfile = io.BytesIO()
    handler3.client_address = ("127.0.0.1", 12345)
    handler3.send_response = MagicMock()
    handler3.send_header = MagicMock()
    handler3.end_headers = MagicMock()

    handler3.do_POST()
    res3 = json.loads(handler3.wfile.getvalue().decode("utf-8"))
    assert res3["success"] is True
    assert "audit" in res3
    assert res3["audit"]["inbound_visibility_score"] >= 70
    assert len(res3["headlines"]) == 3

