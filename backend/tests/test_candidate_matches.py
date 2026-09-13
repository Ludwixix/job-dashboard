import io
import json
import tempfile
from pathlib import Path
from unittest.mock import MagicMock
import pytest

from job_dashboard.repository import JobRepository
from job_dashboard.web import DashboardApp, make_handler
from job_dashboard.models import Job


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


def test_candidate_matches_crud_and_migration():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_jobs.db"
        repo = JobRepository(db_path)

        # 1. Insert jobs
        repo.upsert_job({
            "id": "job_match_1",
            "title": "Senior Cloud Infrastructure Engineer",
            "company": "NextGen Systems",
            "location": "Sydney, NSW",
            "description": "AWS, Kubernetes, Terraform, Docker, Python specialist needed.",
            "source": "seek",
            "url": "https://example.com/job1",
            "posted": "2026-09-10"
        })
        repo.upsert_job({
            "id": "job_match_2",
            "title": "Junior Graphic Designer",
            "company": "Creative Media",
            "location": "Melbourne, VIC",
            "description": "Photoshop and Figma required.",
            "source": "indeed",
            "url": "https://example.com/job2",
            "posted": "2026-09-12"
        })

        # 2. Stage match
        match = repo.upsert_candidate_match(
            user_id="default_user",
            job_id="job_match_1",
            score=94,
            fit="strong",
            reasons=["High skill overlap in AWS, Terraform", "Title seniority aligned"],
            status="matched"
        )
        assert match["user_id"] == "default_user"
        assert match["score"] == 94
        assert match["fit"] == "strong"

        # 3. Retrieve matches
        matches = repo.get_candidate_matches("default_user")
        assert len(matches) == 1
        assert matches[0]["job"]["title"] == "Senior Cloud Infrastructure Engineer"
        assert matches[0]["score"] == 94

        # 4. Migrate default_user matches
        migrated = repo.migrate_default_user("usr_new_999")
        assert migrated >= 1

        assert len(repo.get_candidate_matches("default_user")) == 0
        new_matches = repo.get_candidate_matches("usr_new_999")
        assert len(new_matches) == 1
        assert new_matches[0]["job_id"] == "job_match_1"


def test_evaluate_and_stage_matches():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_jobs.db"
        repo = JobRepository(db_path)

        repo.upsert_job({
            "id": "job_aws_1",
            "title": "AWS DevOps Engineer",
            "company": "Atlassian",
            "location": "Sydney",
            "description": "Kubernetes, AWS, Terraform, Docker pipelines.",
            "source": "seek",
            "url": "https://example.com/aws1",
            "posted": "2026-09-12"
        })

        profile = {
            "title": "DevOps Engineer",
            "skills": ["AWS", "Kubernetes", "Terraform", "Docker", "Python"],
            "experience_years": 6
        }

        staged_count = repo.evaluate_and_stage_matches(user_id="usr_eval_1", profile=profile, min_score=60)
        assert staged_count >= 1

        matches = repo.get_candidate_matches("usr_eval_1")
        assert len(matches) >= 1
        assert matches[0]["job_id"] == "job_aws_1"
        assert matches[0]["score"] >= 60


def test_api_matches_endpoints(tmp_path):
    app = DashboardApp({}, [], tmp_path)
    app.repository.upsert_job({
        "id": "job_api_match_1",
        "title": "Cloud Architect",
        "company": "Canva",
        "location": "Sydney, NSW",
        "description": "Kubernetes and AWS architecture.",
        "source": "seek",
        "url": "https://example.com/canva",
        "posted": "2026-09-11"
    })
    handler_cls = make_handler(app)

    # Evaluate matches POST
    post_handler = create_mock_handler(
        handler_cls,
        "POST",
        "/api/matches/evaluate",
        body={
            "profile": {
                "title": "Cloud Architect",
                "skills": ["AWS", "Kubernetes", "Docker", "Terraform"],
                "experience_years": 8
            },
            "min_score": 50
        },
        headers={"X-User-Id": "usr_cand_1"}
    )
    post_handler.do_POST()
    assert post_handler.send_response.call_args[0][0] == 200
    res_post = parse_response(post_handler)
    assert res_post["success"] is True
    assert res_post["staged_count"] >= 1

    # Retrieve matches GET
    get_handler = create_mock_handler(
        handler_cls,
        "GET",
        "/api/matches",
        headers={"X-User-Id": "usr_cand_1"}
    )
    get_handler.do_GET()
    assert get_handler.send_response.call_args[0][0] == 200
    res_get = parse_response(get_handler)
    assert res_get["success"] is True
    assert len(res_get["matches"]) >= 1
    assert res_get["matches"][0]["job_id"] == "job_api_match_1"

