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
