import json
import pytest
from pathlib import Path
from job_dashboard.scrape import resolve_cli_queries
from job_dashboard.sources import SearchQuery, detect_query_stream


def test_detect_query_stream():
    assert detect_query_stream("Registered Nurse") == "healthcare"
    assert detect_query_stream("Clinical Nurse Consultant") == "healthcare"
    assert detect_query_stream("Aged Care Nurse") == "healthcare"
    assert detect_query_stream("Senior Financial Accountant") == "finance"
    assert detect_query_stream("Tax Manager CPA") == "finance"
    assert detect_query_stream("Site Supervisor") == "trades"
    assert detect_query_stream("Construction Project Manager") == "trades"
    assert detect_query_stream("Corporate Legal Counsel") == "legal"
    assert detect_query_stream("Commercial Solicitor") == "legal"
    assert detect_query_stream("Cloud Solutions Architect") == "technology"
    assert detect_query_stream("PowerShell Automation Engineer") == "technology"
    assert detect_query_stream("Executive Office Assistant") == "general"


def test_resolve_cli_queries_with_explicit_queries():
    queries = resolve_cli_queries(["Registered Nurse", "Clinical Care"], location="Sydney, NSW")
    assert len(queries) == 2
    assert queries[0].term == "Registered Nurse"
    assert queries[0].location == "Sydney, NSW"
    assert queries[0].stream == "healthcare"
    assert queries[1].term == "Clinical Care"
    assert queries[1].stream == "healthcare"


def test_resolve_cli_queries_with_profile_json(tmp_path: Path):
    profile_file = tmp_path / "nurse_profile.json"
    profile_data = {
        "name": "Sarah Connor",
        "location": "Brisbane, QLD",
        "targetTitles": [
            "Registered Nurse - Emergency",
            "Clinical Care Lead"
        ]
    }
    profile_file.write_text(json.dumps(profile_data), encoding="utf-8")

    queries = resolve_cli_queries(None, profile_path=profile_file)
    assert len(queries) == 2
    assert queries[0].term == "Registered Nurse - Emergency"
    assert queries[0].location == "Brisbane, QLD"
    assert queries[0].stream == "healthcare"
    assert queries[1].term == "Clinical Care Lead"
    assert queries[1].stream == "healthcare"


def test_resolve_cli_queries_defaults_to_multi_sector_discovery():
    queries = resolve_cli_queries(None, location="Melbourne, VIC")
    assert len(queries) >= 4
    streams = {q.stream for q in queries}
    assert "healthcare" in streams
    assert "finance" in streams
    assert "trades" in streams
    assert "legal" in streams
