from job_dashboard.sources import SearchQuery
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


def test_search_criteria_persist_across_restart(tmp_path):
    app = DashboardApp({}, [], tmp_path)
    saved = app.update_search_queries([{"term": "azure engineer", "location": "Melbourne", "stream": "core-it"}])

    restored = DashboardApp({}, [], tmp_path, search_queries=[SearchQuery("default", "", "bridge")])

    assert saved == [{"term": "azure engineer", "location": "Melbourne", "stream": "core-it"}]
    assert restored.search_queries[0].term == "azure engineer"


def test_empty_search_criteria_persist_as_empty_list(tmp_path):
    app = DashboardApp({}, [], tmp_path, search_queries=[SearchQuery("default", "", "bridge")])
    app.update_search_queries([])

    restored = DashboardApp({}, [], tmp_path, search_queries=[SearchQuery("default", "", "bridge")])

    assert restored.search_queries == [SearchQuery("default", "", "bridge")]


def test_search_criteria_update_keeps_location_in_single_field(tmp_path):
    app = DashboardApp({}, [], tmp_path)
    app.update_search_queries([{"term": "Melbourne", "location": "Melbourne, VIC", "stream": "core-it"}])

    restored = DashboardApp({}, [], tmp_path)

    assert restored.search_queries[0].term == "Melbourne"
    assert restored.search_queries[0].location == "Melbourne, VIC"
    assert restored.search_queries[0].stream == "core-it"


def test_plain_search_term_does_not_gain_display_defaults(tmp_path):
    app = DashboardApp({}, [], tmp_path)
    app.update_search_queries([{"term": "help desk"}])
    restored = DashboardApp({}, [], tmp_path)

    assert restored.search_queries[0].term == "help desk"


def test_search_criteria_defaults_are_available():
    from job_dashboard.scrape_config import DEFAULT_QUERIES

    assert DEFAULT_QUERIES == ()


def test_search_criteria_suggestions_include_experience_roles(tmp_path):
    app = DashboardApp({"experience": [{"title": "SharePoint Developer"}]}, [], tmp_path)
    suggestions = app.suggested_search_queries()

    assert any(query["term"] == "SharePoint Developer" for query in suggestions)
    assert any(query["term"] == "Azure Administrator" for query in suggestions)
