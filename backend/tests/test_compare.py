import threading
import time

from job_dashboard.compare import COMPARE_MODELS, CompareRunner
from job_dashboard.models import Job


class FakeGenerator:
    def __init__(self, model, delay=0):
        self.model = model
        self.delay = delay

    def generate(self, job, profile):
        time.sleep(self.delay)
        return {
            "resume": f"CV for {self.model}",
            "cover_letter": f"Letter for {self.model}",
            "audit": {"verified": True, "issue_count": 0, "issues": []},
        }


def test_compare_submits_all_models_concurrently(tmp_path):
    started = []
    done = threading.Event()
    updates = {}

    def factory(model):
        started.append(model)
        return FakeGenerator(model, 0.02)

    runner = CompareRunner(tmp_path, generator_factory=factory, timeout_seconds=1)
    runner.submit("cmp_job_1", Job("job", "Role", "Company"), {}, {}, lambda model, key, result: (updates.__setitem__(model, result), done.set() if len([item for item in updates.values() if item.get("status") == "completed"]) == 3 else None))
    assert done.wait(1)
    assert set(started) == {model_id for model_id, _ in COMPARE_MODELS}
    assert all(result["status"] == "completed" for result in updates.values())


def test_compare_timeout_is_independent(tmp_path):
    updates = {}

    def factory(model):
        return FakeGenerator(model, 0.2 if model == COMPARE_MODELS[0][0] else 0)

    runner = CompareRunner(tmp_path, generator_factory=factory, timeout_seconds=0.03)
    runner.submit("cmp_job_2", Job("job", "Role", "Company"), {}, {}, lambda model, key, result: updates.__setitem__(model, result))
    deadline = time.time() + 1
    while time.time() < deadline and sum(result.get("status") in {"completed", "timeout", "failed"} for result in updates.values()) < 3:
        time.sleep(0.01)
    assert updates[COMPARE_MODELS[0][0]]["status"] == "timeout"
    assert sum(result["status"] == "completed" for result in updates.values()) == 2


def test_compare_cache_key_is_stable(tmp_path):
    job = Job("job", "Role", "Company")
    assert CompareRunner.cache_key(job, {"skills": ["Azure"]}, "model") == CompareRunner.cache_key(job, {"skills": ["Azure"]}, "model")
