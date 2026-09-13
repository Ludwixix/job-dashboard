"""Unit tests for Australian Key Selection Criteria (KSC) Generator Subsystem."""

import json
from unittest.mock import MagicMock

from job_dashboard.ksc_generator import (
    CAPABILITY_PILLARS,
    KscReport,
    KscSolution,
    extract_ksc_from_jd,
    generate_ksc_report,
    generate_sao_statement,
    map_ksc_to_capability_framework,
)
from job_dashboard.web import make_handler


def test_extract_ksc_from_jd_with_numbered_criteria():
    jd = """
    About the Role
    Senior Project Delivery Manager with DFFH.
    
    Key Selection Criteria:
    1. Demonstrated experience in leading complex capital infrastructure projects.
    2. Proven ability to cultivate productive stakeholder relationships across government agencies.
    3. High-level analytical and strategic thinking capabilities to manage systemic project risks.
    4. Strong written and verbal communication skills for executive and ministerial briefings.
    
    How to apply:
    Submit resume and cover letter.
    """
    criteria = extract_ksc_from_jd(jd, "Senior Project Delivery Manager")
    assert len(criteria) == 4
    assert "capital infrastructure projects" in criteria[0]
    assert "stakeholder relationships" in criteria[1]


def test_extract_ksc_from_jd_with_bullet_points():
    jd = """
    Department of Education Victoria
    
    Key selection criteria
    • Proven experience managing multi-cloud AWS and Azure environments under strict SLA benchmarks.
    • Strong interpersonal skills with demonstrated capacity to mentor and lead technical teams.
    • Demonstrated commitment to public sector ethics, integrity, and Victorian child-safe standards.
    
    Why join us:
    Great salary packaging and flexible working.
    """
    criteria = extract_ksc_from_jd(jd, "Cloud Engineer")
    assert len(criteria) == 3
    assert any("AWS and Azure" in c for c in criteria)
    assert any("child-safe standards" in c for c in criteria)


def test_extract_ksc_fallback_for_empty_jd():
    criteria = extract_ksc_from_jd("", "Policy Advisor")
    assert len(criteria) >= 3
    assert any("Policy Advisor" in c for c in criteria)


def test_map_ksc_to_capability_framework():
    # 1. Stakeholder criterion -> RELATIONSHIPS
    mapping_rel = map_ksc_to_capability_framework("Demonstrated ability to consult with external partner agencies and build collaborative relationships.")
    assert mapping_rel["pillar"] == "RELATIONSHIPS"
    assert "Cultivates Productive Working Relationships" in mapping_rel["name"]

    # 2. Results criterion -> ACHIEVES_RESULTS
    mapping_res = map_ksc_to_capability_framework("Demonstrated project delivery experience, managing milestones, budgets, and KPI outcomes.")
    assert mapping_res["pillar"] == "ACHIEVES_RESULTS"

    # 3. Communication criterion -> COMMUNICATION
    mapping_com = map_ksc_to_capability_framework("Demonstrated capability in written executive briefings, cabinet submissions, and verbal presentations.")
    assert mapping_com["pillar"] == "COMMUNICATION"

    # 4. Integrity criterion -> INTEGRITY_DRIVE
    mapping_int = map_ksc_to_capability_framework("Commitment to public sector values, ethical governance, probity, and compliance.")
    assert mapping_int["pillar"] == "INTEGRITY_DRIVE"


def test_generate_sao_statement_structure():
    profile = {
        "name": "Sam Ludwig",
        "title": "Senior Solutions Architect",
        "experience": [
            {"company": "Telstra Enterprise", "title": "Lead Cloud Architect"}
        ],
        "skills": ["AWS", "Kubernetes", "Infrastructure as Code", "CI/CD"],
    }
    job = {
        "title": "Principal Infrastructure Engineer",
        "company": "Victorian Electoral Commission",
    }
    criterion = "Demonstrated ability to architect reliable enterprise systems and deploy modern infrastructure."
    
    solution = generate_sao_statement(criterion, profile, job, criterion_index=1, word_limit=300)
    
    assert isinstance(solution, KscSolution)
    assert solution.criterion_number == 1
    assert "**Situation:**" in solution.full_statement
    assert "**Action:**" in solution.full_statement
    assert "**Outcome:**" in solution.full_statement
    assert solution.word_count > 40
    assert "Telstra Enterprise" in solution.situation or "Lead Cloud Architect" in solution.situation
    assert "Victorian Electoral Commission" in solution.outcome


def test_generate_ksc_report_with_custom_criteria():
    profile = {
        "name": "Jane Doe",
        "title": "Principal Policy Officer",
        "experience": [{"company": "Department of Premier and Cabinet", "title": "Senior Policy Advisor"}],
        "skills": ["Policy Reform", "Strategic Planning", "Cabinet Briefings"],
    }
    job = {
        "id": "job_vps_999",
        "title": "Director of Strategic Policy",
        "company": "Department of Transport and Planning",
        "description": "Short description.",
    }
    custom_criteria = [
        "High-level capability to formulate strategic policy in complex regulatory landscapes.",
        "Demonstrated leadership in managing high-performing cross-functional teams.",
    ]
    
    report = generate_ksc_report(job, profile, custom_criteria=custom_criteria, word_limit=250)
    
    assert isinstance(report, KscReport)
    assert report.total_criteria == 2
    assert report.candidate_name == "Jane Doe"
    assert report.company == "Department of Transport and Planning"
    assert len(report.solutions) == 2
    assert "Key Selection Criteria Response Document" in report.master_document
    assert "Criterion 1:" in report.master_document
    assert "Criterion 2:" in report.master_document


def test_ksc_api_get_endpoint():
    app = MagicMock()
    app.repository.get_job.return_value = {
        "id": "job_123",
        "title": "Senior Project Officer",
        "company": "DFFH",
        "description": "Key Selection Criteria:\n1. Demonstrated ability to deliver complex social housing initiatives.\n2. Proven stakeholder engagement capabilities.",
    }
    app.repository.get_user_profile.return_value = {
        "name": "Alex Smith",
        "skills": ["Project Management", "Stakeholder Consultation"],
    }
    app.dashboard.profile = app.repository.get_user_profile.return_value

    handler_cls = make_handler(app)
    handler = handler_cls.__new__(handler_cls)
    handler.headers = {"Content-Length": "0"}
    handler.send_json = MagicMock()

    # GET /api/jobs/job_123/ksc
    handler.path = "/api/jobs/job_123/ksc"
    handler.do_GET()

    assert handler.send_json.called
    status_code, response_data = handler.send_json.call_args[0]
    assert status_code == 200
    assert response_data["success"] is True
    assert "report" in response_data
    assert response_data["report"]["company"] == "DFFH"
    assert len(response_data["report"]["solutions"]) >= 2


def test_ksc_api_post_solve_endpoint():
    app = MagicMock()
    app.repository.get_user_profile.return_value = {
        "name": "Alex Smith",
        "skills": ["Risk Management", "Governance"],
    }
    app.dashboard.profile = app.repository.get_user_profile.return_value

    handler_cls = make_handler(app)
    handler = handler_cls.__new__(handler_cls)
    handler.send_json = MagicMock()

    payload = {
        "job": {"title": "Risk & Compliance Manager", "company": "Monash University"},
        "criteria": [
            "Demonstrated experience in enterprise risk governance and compliance auditing.",
        ],
        "word_limit": 350,
    }
    raw_body = json.dumps(payload).encode("utf-8")
    
    from io import BytesIO
    handler.rfile = BytesIO(raw_body)
    handler.headers = {"Content-Length": str(len(raw_body))}
    handler.path = "/api/ksc/generate"
    handler.do_POST()

    assert handler.send_json.called
    status_code, response_data = handler.send_json.call_args[0]
    assert status_code == 200
    assert response_data["success"] is True
    assert response_data["report"]["company"] == "Monash University"
    assert len(response_data["report"]["solutions"]) == 1
    assert response_data["report"]["solutions"][0]["target_word_limit"] == 350


def test_ksc_custom_word_limits():
    profile = {"name": "Test Candidate", "skills": ["Governance"]}
    job = {"title": "Governance Officer", "company": "VPSC"}
    crit = "Demonstrated capacity to model public sector values and integrity."
    
    sol250 = generate_sao_statement(crit, profile, job, word_limit=250)
    sol500 = generate_sao_statement(crit, profile, job, word_limit=500)
    
    assert sol250.target_word_limit == 250
    assert sol500.target_word_limit == 500
    assert sol250.word_count > 30


def test_ksc_australian_localization():
    profile = {"name": "Test Candidate", "skills": ["Process Optimization"]}
    job = {"title": "Optimization Specialist", "company": "DEECA"}
    crit = "Demonstrated ability to drive strategic direction and policy reform."
    
    sol = generate_sao_statement(crit, profile, job)
    # Check that American -ize is converted to Australian -ise
    assert "prioritise" in sol.action.lower() or "prioritised" in sol.action.lower() or "prioritisation" in sol.action.lower() or "programme" in sol.situation.lower()

