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
    repository.update_status("one", "shortlisted")
    assert repository.metrics()["by_status"]["shortlisted"] == 1
    assert repository.metrics()["events"] == 1


def test_upsert_pagination_and_user_applications(tmp_path):
    repo = JobRepository(tmp_path / "test_jobs.sqlite3")
    
    # 1. Test upsert with deduplication
    raw_jobs = [
        {"title": "M365 Admin", "company": "Contoso", "url": "https://job.test/1", "stream": "core-it", "remote": True, "score": 90},
        {"title": "M365 Admin", "company": "Contoso", "url": "https://job.test/1", "stream": "core-it", "remote": True, "score": 92}, # Duplicate
        {"title": "Azure Consultant", "company": "Fabrikam", "url": "https://job.test/2", "stream": "cloud", "remote": False, "score": 85}
    ]
    upsert_count = repo.upsert_scraped_jobs(raw_jobs)
    assert upsert_count == 3
    
    # 2. Test paginated query
    result = repo.query_jobs_paginated(page=1, page_size=10, search="Contoso")
    assert result["total"] == 1
    assert len(result["jobs"]) == 1
    assert result["jobs"][0]["company"] == "Contoso"
    assert result["jobs"][0]["score"] == 92 # Updated score
    
    # Test remote filter
    remote_res = repo.query_jobs_paginated(page=1, page_size=10, remote=True)
    assert remote_res["total"] == 1
    assert remote_res["jobs"][0]["company"] == "Contoso"

    # 3. Test user applications isolation
    user_id = "user_abc_123"
    job_id = result["jobs"][0]["id"]
    
    repo.upsert_user_application(user_id, job_id, {
        "status": "applied",
        "notes": "Submitted custom resume via portal",
        "resume_text": "Experienced M365 Admin..."
    })
    
    apps = repo.get_user_applications(user_id)
    assert len(apps) == 1
    assert apps[0]["job_id"] == job_id
    assert apps[0]["status"] == "applied"
    assert "Submitted custom resume" in apps[0]["notes"]
    
    # Other users should see empty applications
    other_apps = repo.get_user_applications("different_user")
    assert len(other_apps) == 0