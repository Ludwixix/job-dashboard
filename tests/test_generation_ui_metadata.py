from job_dashboard.web import DashboardApp


def test_generate_persists_downloadable_document_links(tmp_path):
    profile = {
        "personal": {"full_name": "Test User"},
        "technical_expertise": {"cloud": ["azure"]},
        "experience": [],
        "certifications": [],
        "education": [],
        "professional_summary": "Platform engineer",
    }
    app = DashboardApp(profile, [], tmp_path)
    app.jobs = [{
        "id": "job-1",
        "title": "Cloud Engineer",
        "company": "Acme",
        "location": "Melbourne",
        "description": "Azure infrastructure work",
        "source": "Adzuna",
        "url": "https://example.com/job-1",
        "posted": "2026-08-25",
        "remote": False,
        "stream": "core-it",
    }]
    app.document_generator = lambda job, profile: {
        "resume": "Resume text",
        "cover_letter": "Cover letter text",
        "application_id": "job-1-app",
    }

    result = app.generate("job-1")

    assert result["application_id"] == "job-1-app"
    assert app.generated_documents["job-1"]["resume_pdf"].endswith("_resume.pdf")
    assert app.generated_documents["job-1"]["cover_letter_pdf"].endswith("_cover_letter.pdf")


def test_generate_persists_grounding_audit_metadata(tmp_path):
    app = DashboardApp({"personal": {"full_name": "Test User"}}, [], tmp_path)
    app.jobs = [{"id": "job-2", "title": "Engineer", "company": "Acme", "posted": "2026-08-25"}]
    app.document_generator = lambda job, profile: {
        "resume": "Resume text", "cover_letter": "Letter text", "application_id": "job-2-app",
        "status": "needs_review", "audit": {"verified": False, "issue_count": 1, "issues": ["unverified"]},
    }

    app.generate("job-2")

    assert app.generated_documents["job-2"]["status"] == "needs_review"
    assert app.generated_documents["job-2"]["audit"]["issue_count"] == 1


def test_generated_documents_restore_only_when_files_exist(tmp_path):
    app = DashboardApp({"personal": {}}, [], tmp_path)
    app.jobs = [{"id": "job-3", "title": "Engineer", "company": "Acme", "posted": "2026-08-25"}]
    app.document_generator = lambda job, profile: {
        "resume": "Resume", "cover_letter": "Letter", "application_id": "job-3-app",
    }
    app.generate("job-3")

    restored = DashboardApp({"personal": {}}, [], tmp_path)
    assert restored.generated_documents["job-3"]["application_id"] == "job-3-app"
