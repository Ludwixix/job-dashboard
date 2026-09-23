from job_dashboard.content_library import ContentLibrary
from job_dashboard.email_connector import EmailClassifier, EmailMessage


def test_content_library_validates_verified_claims():
    library = ContentLibrary()
    library.facts["companies"].add("Acme Corp")
    library.facts["titles"].add("Cloud Engineer")
    library.facts["dates"].add("2024-01")
    result = library.validate_claims("Worked as Cloud Engineer at Acme Corp in 2024-01")
    assert result["verified"], f"Expected verified but got issues: {result['issues']}"


def test_content_library_flags_unverified_company():
    library = ContentLibrary()
    library.facts["companies"].add("Real Inc")
    result = library.validate_claims("Worked at Fabricated Corp")
    assert not result["verified"]
    assert any("company" in issue for issue in result["issues"])


def test_email_classifier_detects_application_confirmation():
    classifier = EmailClassifier()
    email = EmailMessage(
        subject="Application received for Senior Engineer",
        snippet="Thank you for submitting your application. We have received it.",
        from_address="noreply@acme.test",
        received_at=str(int(__import__("time").time())),
        email_id="test-001",
        body_preview="We will review and contact you soon",
    )
    category, confidence = classifier.classify(email)
    assert category == "application_confirmed"
    assert confidence >= 0.7


def test_email_classifier_detects_interview_request():
    classifier = EmailClassifier()
    email = EmailMessage(
        subject="Next steps - Technical interview",
        snippet="We'd like to schedule a technical interview. Please let us know your availability.",
        from_address="recruiter@acme.test",
        received_at=str(int(__import__("time").time())),
        email_id="test-002",
        body_preview="When can you do a 60-minute phone screening?",
    )
    category, confidence = classifier.classify(email)
    assert category == "interview_requested"
    assert confidence >= 0.7


def test_email_classifier_detects_offer():
    classifier = EmailClassifier()
    email = EmailMessage(
        subject="Offer extended for Cloud Engineer role",
        snippet="Congratulations! We are pleased to offer you the position of Cloud Engineer.",
        from_address="hiring@acme.test",
        received_at=str(int(__import__("time").time())),
        email_id="test-003",
        body_preview="Please review the attached offer document",
    )
    category, confidence = classifier.classify(email)
    assert category == "offer_extended"
    assert confidence >= 0.7


def test_decomposed_job_index_service(tmp_path):
    from job_dashboard.services import JobIndexService

    service = JobIndexService(
        data_dir=tmp_path,
        initial_jobs=[
            {
                "id": "j1",
                "title": "DevOps Engineer",
                "company": "Canva",
                "url": "https://example.com/j1",
            },
            {
                "id": "j2",
                "title": "Staff Platform Engineer",
                "company": "Atlassian",
                "url": "https://example.com/j2",
            },
        ],
    )

    # Test O(1) dual lookups
    assert service.get_job("j1")["title"] == "DevOps Engineer"
    assert service.get_job_by_url("https://example.com/j2")["id"] == "j2"
    assert service.get_job("nonexistent") is None

    # Test materialization
    raw = [
        {"title": "Cloud Architect", "company": "Google", "description": "Cloud infra"}
    ]
    mat = service.materialize_jobs(raw)
    assert len(mat) == 1
    assert mat[0]["company"] == "Google"

    # Test upsert
    service.upsert_jobs(mat)
    assert len(service.get_jobs()) == 3


def test_decomposed_scrape_orchestration_service(tmp_path):
    from job_dashboard.repository import JobRepository
    from job_dashboard.services import ScrapeOrchestrationService, JobIndexService

    repo = JobRepository(str(tmp_path / "jobs.sqlite3"))
    index_service = JobIndexService(tmp_path, repository=repo, initial_jobs=[])
    scrape_service = ScrapeOrchestrationService(
        data_dir=tmp_path,
        repository=repo,
        job_index=index_service,
    )

    # Save and reload search queries
    scrape_service.save_search_queries()
    loaded_queries = scrape_service._load_search_queries()
    assert isinstance(loaded_queries, list)

    # Check coordinator access
    assert scrape_service.coordinator is not None
    assert scrape_service.coordinator.get_queue_depth() == 0


def test_decomposed_application_workflow_service(tmp_path):
    from job_dashboard.repository import JobRepository
    from job_dashboard.services import ApplicationWorkflowService

    repo = JobRepository(str(tmp_path / "jobs.sqlite3"))
    workflow_service = ApplicationWorkflowService(data_dir=tmp_path, repository=repo)

    # Update application status
    updated = workflow_service.update_application_status(
        user_id="user_test_1",
        job_id="job_test_1",
        status="applied",
        notes="Applied via company portal",
    )
    assert updated["status"] == "applied"

    # Verify event audit trail
    events = workflow_service.get_application_events("job_test_1")
    assert len(events) >= 1
    assert events[0]["to_status"] == "applied"
