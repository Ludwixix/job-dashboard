from job_dashboard.sources import clean_description, ensure_descriptions


def test_html_description_becomes_compact_readable_text():
    result = clean_description("<p>Build <strong>reliable</strong> systems.</p><p>Own delivery.</p>")
    assert result == "Build reliable systems.\n\nOwn delivery."
    assert "<" not in result


def test_saved_description_is_cleaned_too():
    result = ensure_descriptions([{"title": "Engineer", "company": "Acme", "description": "<div>Azure&nbsp;platform</div>"}])
    assert result[0]["description"] == "Azure platform"