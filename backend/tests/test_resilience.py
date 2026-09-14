from __future__ import annotations

import json
from job_dashboard.sources.resilience import (
    ADAPTIVE_BROWSER_EXTRACTOR_JS,
    extract_balanced_json,
    extract_embedded_state_jobs,
    extract_from_json_ld,
)
from job_dashboard.sources.base import SearchQuery
from job_dashboard.sources.indeed import IndeedJobSpySource


def test_extract_from_json_ld_single_and_graph():
    html = """
    <html>
    <head>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Senior Cloud Engineer",
            "hiringOrganization": {"@type": "Organization", "name": "Acme Australia"},
            "jobLocation": {
                "@type": "Place",
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": "Melbourne",
                    "addressRegion": "VIC",
                    "addressCountry": "AU"
                }
            },
            "description": "Design and automate AWS/Azure workloads.",
            "url": "https://example.com/jobs/123",
            "datePosted": "2026-09-14T01:00:00Z",
            "jobLocationType": "TELECOMMUTE"
        }
        </script>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "JobPosting",
                    "title": "Systems Administrator",
                    "hiringOrganization": {"name": "Tech Corp"},
                    "description": "Maintain servers and Intune endpoints.",
                    "url": "https://example.com/jobs/456",
                    "datePosted": "2026-09-13"
                }
            ]
        }
        </script>
    </head>
    <body><h1>Job Portal</h1></body>
    </html>
    """
    records = extract_from_json_ld(html)
    assert len(records) == 2

    # Job 1
    assert records[0]["title"] == "Senior Cloud Engineer"
    assert records[0]["company"] == "Acme Australia"
    assert "Melbourne" in records[0]["location"]
    assert records[0]["remote"] is True
    assert records[0]["url"] == "https://example.com/jobs/123"

    # Job 2
    assert records[1]["title"] == "Systems Administrator"
    assert records[1]["company"] == "Tech Corp"
    assert records[1]["url"] == "https://example.com/jobs/456"


def test_extract_balanced_json_nested():
    raw_script = 'const x = {"a": {"b": "val with {curly} and \\"quotes\\""}, "count": 42}; console.log("done");'
    extracted = extract_balanced_json(raw_script, 10)
    data = json.loads(extracted)
    assert data["count"] == 42
    assert data["a"]["b"] == 'val with {curly} and "quotes"'


def test_extract_embedded_state_jobs():
    mosaic_data = {
        "metaData": {
            "mosaicProviderJobCardsModel": {
                "results": [
                    {
                        "jobkey": "jk_123456",
                        "title": "DevOps Engineer",
                        "company": "FastTech",
                        "formattedLocation": "Sydney NSW",
                        "snippet": "Kubernetes and Terraform infrastructure.",
                        "viewJobLink": "/viewjob?jk=jk_123456",
                        "remoteLocation": True,
                    }
                ]
            }
        }
    }
    html = f"""
    <html>
    <script>
    window.mosaic.providerData["mosaic-provider-jobcards"]={json.dumps(mosaic_data)};
    </script>
    </html>
    """
    jobs = extract_embedded_state_jobs(html)
    assert len(jobs) == 1
    assert jobs[0]["title"] == "DevOps Engineer"
    assert jobs[0]["company"] == "FastTech"
    assert jobs[0]["remote"] is True
    assert jobs[0]["id"] == "indeed-jk_123456"


def test_adaptive_browser_extractor_js_validity():
    assert "ADAPTIVE_BROWSER_EXTRACTOR_JS" in globals()
    assert "linkSelectors" in ADAPTIVE_BROWSER_EXTRACTOR_JS
    assert "viewjob" in ADAPTIVE_BROWSER_EXTRACTOR_JS
    assert "data-jk" in ADAPTIVE_BROWSER_EXTRACTOR_JS


def test_indeed_graphql_gateway_live_or_fallback():
    source = IndeedJobSpySource(results_wanted=5)
    records = list(source._search_graphql(SearchQuery(term="Systems Engineer", location="Australia")))
    # Verify GraphQL gateway returns valid records
    assert len(records) > 0
    assert any("engineer" in r.title.lower() or "systems" in r.title.lower() or "it" in r.title.lower() for r in records)
    assert all(r.provider == "indeed" for r in records)
    assert all(r.url.startswith("http") for r in records)

