import pytest
import tempfile
from pathlib import Path
from job_dashboard.network_crm import NetworkCRMManager, NetworkContact


@pytest.fixture
def crm_manager():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_crm.db"
        manager = NetworkCRMManager(db_path)
        yield manager


def test_contact_crud(crm_manager):
    contact = NetworkContact(
        id="test-1",
        name="Sarah Jenkins",
        role="Principal Tech Talent Partner",
        organization="Hays Technology",
        contact_type="agency_recruiter",
        sector="technology",
        email="sarah.jenkins@example.com",
        phone="+61 400 123 456",
        notes="Specializes in Cloud & Platform Engineering in Sydney.",
        cadence_frequency_days=14,
    )
    
    saved = crm_manager.upsert_contact(contact)
    assert saved.id == "test-1"
    assert saved.name == "Sarah Jenkins"
    assert saved.relationship_health == "warm"

    # Retrieve
    fetched = crm_manager.get_contact("test-1")
    assert fetched is not None
    assert fetched.organization == "Hays Technology"
    assert fetched.sector == "technology"

    # List
    contacts = crm_manager.list_contacts()
    assert len(contacts) == 1

    # Filter by sector
    tech_contacts = crm_manager.list_contacts(sector="technology")
    assert len(tech_contacts) == 1
    health_contacts = crm_manager.list_contacts(sector="healthcare")
    assert len(health_contacts) == 0

    # Delete
    deleted = crm_manager.delete_contact("test-1")
    assert deleted is True
    assert crm_manager.get_contact("test-1") is None


def test_interaction_logging_and_health(crm_manager):
    contact = NetworkContact(
        id="test-2",
        name="Marcus Vance",
        role="Talent Acquisition Director",
        organization="Canva",
        contact_type="internal_talent",
        sector="technology",
        cadence_frequency_days=14,
    )
    crm_manager.upsert_contact(contact)

    # Log an interaction
    interaction = {
        "id": "int-1",
        "date": "2026-09-01",
        "type": "coffee_catchup",
        "summary": "Met at Surry Hills cafe to discuss staff platform engineering roadmap.",
        "outcome": "Promised to flag when requisition opens next week."
    }
    updated = crm_manager.add_interaction("test-2", interaction)
    assert len(updated.interactions) == 1
    assert updated.last_interaction_date == "2026-09-01"
    assert updated.next_follow_up_date == "2026-09-15"  # +14 days
    assert updated.relationship_health == "active"


def test_cadence_radar_calculation(crm_manager):
    # Contact 1: Overdue
    crm_manager.upsert_contact(NetworkContact(
        id="overdue-1",
        name="Overdue Recruiter",
        role="Executive Search",
        organization="Korn Ferry",
        contact_type="executive_search",
        sector="finance",
        cadence_frequency_days=7,
        last_interaction_date="2026-08-10",
        next_follow_up_date="2026-08-17",
    ))

    # Contact 2: Upcoming
    crm_manager.upsert_contact(NetworkContact(
        id="upcoming-1",
        name="Future Contact",
        role="Engineering Manager",
        organization="Atlassian",
        contact_type="hiring_manager",
        sector="technology",
        cadence_frequency_days=30,
        last_interaction_date="2026-09-05",
        next_follow_up_date="2026-10-05",
    ))

    radar = crm_manager.get_cadence_radar(current_date="2026-09-06")
    assert radar["total_contacts"] == 2
    assert radar["overdue_count"] >= 1
    assert len(radar["overdue_contacts"]) >= 1
    assert radar["overdue_contacts"][0]["id"] == "overdue-1"


def test_seeding_default_contacts(crm_manager):
    seeded = crm_manager.seed_default_contacts()
    assert len(seeded) >= 5
    
    # Check that major sectors and organizations are represented
    orgs = {c.organization for c in seeded}
    assert any(o in orgs for o in ["Hays Australia", "Michael Page", "Robert Walters", "Davidson People"])

    # Calling seed again when contacts exist shouldn't duplicate
    reseeded = crm_manager.seed_default_contacts(force=False)
    assert len(reseeded) == len(seeded)


def test_search_and_associated_jobs(crm_manager):
    contact = NetworkContact(
        id="job-link-1",
        name="Elena Rostova",
        role="Senior Recruiter",
        organization="Macquarie Group",
        contact_type="internal_talent",
        sector="finance",
        associated_job_ids=["job-fin-99", "job-fin-100"],
        notes="High-frequency trading platform engineering mandates",
    )
    crm_manager.upsert_contact(contact)

    # Search by keyword
    results = crm_manager.list_contacts(search="Macquarie")
    assert len(results) == 1
    assert results[0].id == "job-link-1"
    assert "job-fin-99" in results[0].associated_job_ids

    # Search by note keyword
    results_notes = crm_manager.list_contacts(search="trading platform")
    assert len(results_notes) == 1

