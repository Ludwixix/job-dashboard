from job_dashboard.sources import ScrapePipeline, SearchQuery


class BrokenSource:
    name = "Broken"

    def search(self, query):
        raise RuntimeError("provider unavailable")


def test_one_provider_failure_does_not_abort_pipeline():
    pipeline = ScrapePipeline([BrokenSource()], days=14)
    assert pipeline.run([SearchQuery("cloud")]) == []
    assert pipeline.errors == ["Broken / cloud: provider unavailable"]


def test_public_jobs_hides_non_new_jobs_by_default(tmp_path):
    from job_dashboard.web import DashboardApp

    app = DashboardApp({}, [], tmp_path)
    app.sync_tracker = lambda: None
    app.jobs = [
        {"id": "new", "title": "New Role", "company": "Acme", "description": "Cloud", "posted": "2026-08-25", "url": "https://example.test/new"},
        {"id": "applied", "title": "Applied Role", "company": "Acme", "description": "Cloud", "posted": "2026-08-25", "url": "https://example.test/applied"},
    ]
    app.jobs = app.materialize_jobs(app.jobs)
    app.repository.replace_jobs(app.jobs)
    app.repository.update_status("applied", "applied")

    assert [job["id"] for job in app.public_jobs()] == ["new"]
    assert [job["id"] for job in app.public_jobs({"status": "applied"})] == ["applied"]
