from job_dashboard.sources import SearchQuery, ScrapePipeline


class BrokenSource:
    name = "Broken"

    def search(self, query):
        raise RuntimeError("provider unavailable")


def test_one_provider_failure_does_not_abort_pipeline():
    pipeline = ScrapePipeline([BrokenSource()], days=14)
    assert pipeline.run([SearchQuery("cloud")]) == []
    assert pipeline.errors == ["Broken / cloud: provider unavailable"]
