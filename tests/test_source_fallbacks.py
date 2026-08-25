import pytest

from job_dashboard.sources import SearchQuery, SeekApiSource, SeekUnavailableError, ensure_descriptions


class BlockedSeek(SeekApiSource):
    def _search_api(self, query):
        raise RuntimeError("403")


def test_seek_does_not_bypass_api_block_with_browser():
    with pytest.raises(SeekUnavailableError, match="public API unavailable"):
        list(BlockedSeek().search(SearchQuery("cloud engineer")))


def test_missing_description_gets_useful_fallback():
    jobs = ensure_descriptions([{"title": "Service Desk Analyst", "company": "Acme", "location": "Melbourne"}])
    assert jobs[0]["description"] == "Service Desk Analyst at Acme in Melbourne."
