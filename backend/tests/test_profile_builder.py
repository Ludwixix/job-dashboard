import io
import json
from unittest.mock import MagicMock
import pytest
from pypdf import PageObject, PdfWriter

from job_dashboard.profile_builder import (
    extract_text_from_pdf,
    synthesize_profile_from_text,
    build_candidate_profile
)
from job_dashboard.web import DashboardApp, make_handler


def create_mock_handler(handler_cls, method, path, body=None, headers=None):
    handler = handler_cls.__new__(handler_cls)
    handler.path = path
    headers_dict = headers.copy() if headers else {}
    if body is not None:
        payload = json.dumps(body).encode("utf-8") if isinstance(body, dict) else body.encode("utf-8")
        headers_dict["Content-Length"] = str(len(payload))
        handler.rfile = io.BytesIO(payload)
    else:
        handler.rfile = io.BytesIO()
    handler.headers = headers_dict
    handler.client_address = ("127.0.0.1", 12345)
    handler.wfile = io.BytesIO()
    handler.send_response = MagicMock()
    handler.send_header = MagicMock()
    handler.end_headers = MagicMock()
    return handler


def parse_response(handler):
    handler.wfile.seek(0)
    data = handler.wfile.read()
    if not data:
        return {}
    return json.loads(data.decode("utf-8"))


def test_synthesize_profile_from_text_heuristic():
    sample_cv = """
    Jane Smith
    Senior Cloud & DevOps Engineer
    Sydney, NSW, Australia
    jane.smith@example.com

    Summary:
    Over 8 years of experience designing, architecting, and deploying enterprise AWS cloud infrastructure.
    Specializing in Kubernetes, Terraform, Docker, CI/CD, and Python automation.

    Skills:
    AWS, Azure, Kubernetes, Docker, Terraform, Python, Bash, CI/CD, GitHub Actions, Prometheus, Linux

    Experience:
    Lead Cloud Engineer at Tech Corp (2020 - Present)
    - Managed 50+ microservices on EKS using Terraform.
    """

    profile = synthesize_profile_from_text(sample_cv)
    assert "Jane Smith" in profile.get("name", "") or profile.get("title")
    assert "Cloud" in profile["title"] or "DevOps" in profile["title"]
    assert len(profile["skills"]) >= 3
    assert any("Kubernetes" in s or "AWS" in s or "Terraform" in s for s in profile["skills"])
    assert profile.get("summary")


def test_extract_text_from_pdf_stream():
    writer = PdfWriter()
    page = PageObject.create_blank_page(width=72, height=72)
    writer.add_page(page)
    pdf_bytes = io.BytesIO()
    writer.write(pdf_bytes)
    pdf_bytes.seek(0)

    text = extract_text_from_pdf(pdf_bytes.getvalue())
    assert isinstance(text, str)


def test_build_candidate_profile_end_to_end():
    sample_text = """
    Alex Taylor
    Staff Software Engineer
    Melbourne, VIC
    Skills: Python, React, TypeScript, GraphQL, PostgreSQL, Docker
    Summary: 10 years building high-scale distributed systems and web applications.
    """
    profile = build_candidate_profile(sample_text)
    assert profile["title"]
    assert len(profile["skills"]) >= 3
    assert profile["experience_years"] >= 5


def test_api_profile_auto_generate_endpoint(tmp_path):
    app = DashboardApp({}, [], tmp_path)
    handler_cls = make_handler(app)

    handler = create_mock_handler(
        handler_cls,
        "POST",
        "/api/profile/auto-generate",
        body={
            "raw_text": "Sam Developer\nSenior Full Stack Engineer\nSkills: React, Node.js, Python, PostgreSQL\nSummary: 6 years building modern web apps.",
            "save": True
        },
        headers={"X-User-Id": "usr_sam_101"}
    )
    handler.do_POST()
    assert handler.send_response.call_args[0][0] == 200
    res = parse_response(handler)
    assert res["success"] is True
    assert "Senior Full Stack" in res["profile"]["title"] or "Engineer" in res["profile"]["title"]
    assert "React" in res["profile"]["skills"]

    # Verify persisted in user_profiles
    persisted = app.repository.get_user_profile("usr_sam_101")
    assert persisted["title"] == res["profile"]["title"]
