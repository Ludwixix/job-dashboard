import io
import json
from unittest.mock import MagicMock
import pytest

from job_dashboard.repository import JobRepository
from job_dashboard.web import make_handler, DashboardApp


@pytest.fixture
def test_app_and_handler(tmp_path):
    repo = JobRepository(str(tmp_path / "test.db"))
    app = DashboardApp(profile={}, sources=[], data_dir=tmp_path)
    app.repository = repo
    app.db = repo
    handler_cls = make_handler(app)
    return app, handler_cls


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


def test_auto_apply_sync_endpoint(test_app_and_handler):
    _, handler_cls = test_app_and_handler
    payload = {
        "job": {
            "title": "Senior Cloud Engineer",
            "company": "Canva",
            "source": "SEEK",
            "portalLink": "https://seek.com.au/job/123"
        },
        "profile": {
            "name": "Sam Ludwig",
            "email": "sam.ludwig@gmail.com",
            "targetSalary": "$125,000"
        }
    }

    handler = create_mock_handler(handler_cls, "POST", "/api/auto-apply", body=payload)
    handler.do_POST()

    resp = parse_response(handler)
    assert resp.get("success") is True
    result = resp.get("pipeline_result", {})
    assert result.get("status") == "dispatched"
    assert result.get("job_title") == "Senior Cloud Engineer"
    assert result.get("company") == "Canva"
    assert result.get("submitted_fields", {}).get("Target Salary") == "$125,000"
    assert "dispatch_id" in result


def test_auto_apply_screening_healthcare_nurse():
    from job_dashboard.auto_apply import auto_apply_manager

    profile = {
        "name": "Sarah Jenkins",
        "email": "sarah.jenkins@health.vic.gov.au",
        "industry": "Healthcare & Medical",
        "location": "Geelong, VIC",
        "workRights": "Australian Citizen (Unrestricted)",
        "targetSalary": "$92,000 + Super",
    }
    job = {
        "title": "Registered Nurse - Emergency Department",
        "company": "Barwon Health",
        "industry": "Healthcare & Medical",
    }

    # AHPRA question
    q_ahpra = "Do you hold current registration with AHPRA as a Registered Nurse?"
    ans = auto_apply_manager.resolve_screening_answer(q_ahpra, profile, job)
    assert "AHPRA" in ans or "Registered Nurse" in ans or "Yes" in ans

    # WWCC question
    q_wwcc = "Do you have a current Working with Children Check (WWCC)?"
    ans = auto_apply_manager.resolve_screening_answer(q_wwcc, profile, job)
    assert "Yes" in ans or "WWCC" in ans

    # Immunisation question
    q_imm = "Are your occupational vaccinations and healthcare immunisations up to date?"
    ans = auto_apply_manager.resolve_screening_answer(q_imm, profile, job)
    assert "Yes" in ans or "compliant" in ans.lower()

    # Dynamic salary
    q_sal = "What is your expected annual remuneration or salary expectation?"
    ans = auto_apply_manager.resolve_screening_answer(q_sal, profile, job)
    assert "$92,000" in ans


def test_auto_apply_screening_finance_accountant():
    from job_dashboard.auto_apply import auto_apply_manager

    profile = {
        "name": "Michael Chen",
        "industry": "Finance & Accounting",
        "targetSalary": "$130,000",
    }
    job = {
        "title": "Senior Financial Accountant",
        "company": "PwC Australia",
    }

    q_cpa = "Are you a qualified CPA or CA member in Australia?"
    ans = auto_apply_manager.resolve_screening_answer(q_cpa, profile, job)
    assert "CPA" in ans or "CA" in ans or "Yes" in ans

    q_erp = "What is your proficiency level with ERP systems such as SAP or Xero?"
    ans = auto_apply_manager.resolve_screening_answer(q_erp, profile, job)
    assert "ERP" in ans or "SAP" in ans or "Xero" in ans or "Yes" in ans


def test_auto_apply_screening_construction_white_card():
    from job_dashboard.auto_apply import auto_apply_manager

    profile = {
        "name": "Dave Miller",
        "industry": "Construction & Trades",
    }
    job = {
        "title": "Commercial Site Supervisor",
        "company": "Lendlease",
    }

    q_wc = "Do you hold a current General Construction Induction Card (White Card)?"
    ans = auto_apply_manager.resolve_screening_answer(q_wc, profile, job)
    assert "White Card" in ans or "Yes" in ans


def test_auto_apply_dynamic_candidate_name_and_attachments():
    from job_dashboard.auto_apply import auto_apply_manager

    profile = {
        "name": "Elena Rostova-Smith",
        "email": "elena.smith@med.org.au",
        "location": "Brisbane, QLD",
        "targetSalary": "$95,000",
        "industry": "Healthcare & Medical",
    }
    job = {
        "title": "Clinical Nurse Consultant",
        "company": "Metro North Health",
        "source": "SEEK",
    }

    task = auto_apply_manager.create_task(job, profile)
    # Wait for the background worker simulation to complete
    import time
    for _ in range(30):
        if task.status in ("completed", "failed"):
            break
        time.sleep(0.2)

    assert task.status == "completed"
    receipt = task.receipt
    assert receipt is not None
    assert receipt["candidate"]["name"] == "Elena Rostova-Smith"
    assert receipt["candidate"]["location"] == "Brisbane, QLD"
    assert "Elena_Rostova_Smith_Tailored_Resume.pdf" in receipt["attachments"]
    assert "Elena_Rostova_Smith_Cover_Letter.pdf" in receipt["attachments"]
