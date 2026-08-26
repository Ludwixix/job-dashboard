from job_dashboard.repository import JobRepository


def test_repository_filters_and_logs_status_transition(tmp_path):
    repository = JobRepository(tmp_path / "jobs.sqlite3")
    repository.replace_jobs([{
        "id": "one", "title": "Cloud Engineer", "company": "Acme",
        "location": "Melbourne", "description": "Azure role", "source": "Seek",
        "url": "https://example.test/one", "salary": "$110,000 - $130,000", "score": 88,
    }])
    assert len(repository.list_jobs(source="Seek", match_score_min=80)) == 1
    assert len(repository.list_jobs(role="Acme", salary_min=100000)) == 1
    assert repository.list_jobs(salary_min=120000) == []
    assert repository._salary_amount("$90k to $110k + 11% super") == 90000
    repository.update_status("one", "shortlisted")
    assert repository.metrics()["by_status"]["shortlisted"] == 1
    assert repository.metrics()["events"] == 1