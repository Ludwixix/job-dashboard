from job_dashboard.prompt_context import load_prompt_context


def test_prompt_context_loads_and_labels_both_document_sets(tmp_path):
    source = tmp_path / "Source of truth"
    guidelines = tmp_path / "Guidelines"
    source.mkdir()
    guidelines.mkdir()
    (source / "Master Resume.md").write_text("verified experience", encoding="utf-8")
    (guidelines / "Voice.md").write_text("Australian spelling", encoding="utf-8")
    context = load_prompt_context(source, guidelines)
    assert "Guidelines/Voice.md" in context
    assert "Source of truth/Master Resume.md" in context
    assert "Every file in Source of truth/ contains career facts" in context
    assert "Do not copy any source-of-truth document's layout or formatting" in context
    assert "verified experience" in context
