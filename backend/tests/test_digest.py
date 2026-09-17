"""Tests for the Morning Opportunity Digest module (Phase 5.2)."""

from datetime import datetime, timezone, timedelta
import pytest
from job_dashboard.digest import (
    generate_morning_digest,
    format_slack_digest_blocks,
    format_markdown_digest,
    format_html_digest,
)


@pytest.fixture
def mock_jobs_pool():
    now = datetime.now(timezone.utc)
    return [
        {
            "id": "job-1",
            "title": "Principal Distributed Systems Engineer",
            "company": "Canva",
            "location": "Sydney, NSW (Hybrid)",
            "salary": "$220,000 - $260,000",
            "score": 94,
            "matchScore": 94,
            "tags": ["Go", "Kubernetes", "Kafka", "Distributed Systems"],
            "url": "https://careers.canva.com/jobs/1",
            "posted_date": (now - timedelta(hours=4)).isoformat(),
        },
        {
            "id": "job-2",
            "title": "Lead Cloud Infrastructure Architect",
            "company": "Atlassian",
            "location": "Remote, Australia",
            "salary": "$210,000 - $240,000",
            "score": 88,
            "matchScore": 88,
            "tags": ["AWS", "Terraform", "Python", "Security"],
            "url": "https://atlassian.com/careers/2",
            "posted_date": (now - timedelta(hours=10)).isoformat(),
        },
        {
            "id": "job-3",
            "title": "Senior Backend Software Engineer",
            "company": "SafetyCulture",
            "location": "Sydney, NSW",
            "salary": "$170,000 - $195,000",
            "score": 82,
            "matchScore": 82,
            "tags": ["Go", "Microservices"],
            "url": "https://safetyculture.com/careers/3",
            "posted_date": (now - timedelta(hours=18)).isoformat(),
        },
        {
            "id": "job-4",
            "title": "Junior Web Developer",
            "company": "Local Agency",
            "location": "Melbourne, VIC",
            "salary": "$75,000",
            "score": 50,
            "matchScore": 50,
            "tags": ["HTML", "CSS"],
            "url": "https://agency.com/careers/4",
            "posted_date": (now - timedelta(days=2)).isoformat(),
        },
    ]


def test_generate_morning_digest_filters_by_threshold(mock_jobs_pool):
    digest = generate_morning_digest(mock_jobs_pool, min_score=85, limit=5)

    assert digest["total_qualified_matches"] == 2
    assert digest["average_score"] == 91.0
    assert len(digest["top_opportunities"]) == 2
    assert digest["top_opportunities"][0]["company"] == "Canva"
    assert digest["top_opportunities"][1]["company"] == "Atlassian"
    assert "Go" in digest["top_skills"]
    assert "Kubernetes" in digest["top_skills"]


def test_generate_morning_digest_empty_graceful():
    digest = generate_morning_digest([], min_score=85)
    assert digest["total_qualified_matches"] == 0
    assert digest["average_score"] == 0.0
    assert digest["top_opportunities"] == []
    assert digest["top_skills"] == []


def test_format_slack_digest_blocks(mock_jobs_pool):
    digest = generate_morning_digest(mock_jobs_pool, min_score=85)
    blocks = format_slack_digest_blocks(digest)

    assert isinstance(blocks, list)
    assert len(blocks) >= 3

    # Check header
    header_block = blocks[0]
    assert header_block["type"] == "header"
    assert "Morning Opportunity Intelligence" in header_block["text"]["text"]

    # Check section content
    text_content = str(blocks)
    assert "Principal Distributed Systems Engineer" in text_content
    assert "Canva" in text_content
    assert "$220,000 - $260,000" in text_content


def test_format_markdown_digest(mock_jobs_pool):
    digest = generate_morning_digest(mock_jobs_pool, min_score=85)
    md = format_markdown_digest(digest)

    assert "# CAREER.AGENT — High-Yield Opportunity Digest" in md
    assert "Canva" in md
    assert "Principal Distributed Systems Engineer" in md
    assert "94%" in md
    assert "Top Market Skills" in md


def test_format_html_digest(mock_jobs_pool):
    digest = generate_morning_digest(mock_jobs_pool, min_score=85)
    html = format_html_digest(digest)

    assert "<!DOCTYPE html>" in html
    assert "CAREER.AGENT" in html
    assert "Canva" in html
    assert "Atlassian" in html
    assert "94%" in html

