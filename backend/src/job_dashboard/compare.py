from __future__ import annotations

import hashlib
import json
import threading
import time
from collections.abc import Callable, Mapping
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from .content_library import ContentLibrary
from .llm import OpenRouterDocumentGenerator
from .models import Job

COMPARE_MODELS = (
    ("z-ai/glm-5.3-flash", "OxAlpha"),
    ("deepseek/deepseek-v4-flash-0731", "deepseek/deepseek-v4-flash-0731"),
    ("xiaomi/mimo-v2.5", "xiaomi/mimo-v2.5"),
)


class CompareRunner:
    """Run independent model workers and publish results as each completes."""

    def __init__(self, source_dir, generator_factory=None, timeout_seconds: float = 45.0):
        self.source_dir = source_dir
        self.generator_factory = generator_factory
        self.timeout_seconds = timeout_seconds
        self.executor = ThreadPoolExecutor(max_workers=len(COMPARE_MODELS), thread_name_prefix="cv-compare")
        self.timers: dict[tuple[str, str], threading.Timer] = {}
        self.timed_out: set[tuple[str, str]] = set()

    @staticmethod
    def cache_key(job: Job, profile: Mapping[str, Any], model_id: str) -> str:
        payload = json.dumps({"job": job.__dict__, "profile": profile, "model": model_id}, sort_keys=True, default=str)
        return hashlib.sha256(payload.encode()).hexdigest()

    def submit(self, comparison_id: str, job: Job, profile: Mapping[str, Any], cached: Mapping[str, Any], on_update: Callable[[str, str, dict[str, Any]], None], model_ids=None) -> None:
        selected_models = set(model_ids or (model_id for model_id, _ in COMPARE_MODELS))
        for model_id, display_name in COMPARE_MODELS:
            if model_id not in selected_models:
                continue
            key = self.cache_key(job, profile, model_id)
            cached_result = cached.get(key)
            if cached_result and time.time() - float(cached_result.get("generated_at_epoch", 0)) < 3600:
                on_update(model_id, key, {**cached_result, "display_name": display_name, "cached": True})
                continue
            on_update(model_id, key, {"model_id": model_id, "display_name": display_name, "status": "loading"})
            future = self.executor.submit(self._generate_one, model_id, display_name, job, profile)
            timer = threading.Timer(self.timeout_seconds, self._timeout, args=(comparison_id, model_id, key, on_update))
            timer.daemon = True
            self.timers[(comparison_id, model_id)] = timer
            timer.start()
            future.add_done_callback(lambda completed, comparison=comparison_id, model=model_id, cache=key, timeout=timer: self._complete(comparison, model, cache, completed, timeout, on_update))

    def _generate_one(self, model_id: str, display_name: str, job: Job, profile: Mapping[str, Any]) -> dict[str, Any]:
        started = time.perf_counter()
        generator = self.generator_factory(model_id) if self.generator_factory else OpenRouterDocumentGenerator(self.source_dir, self.source_dir, model=model_id)
        output = generator.generate(job, profile)
        resume = str(output.get("resume", ""))
        cover = str(output.get("cover_letter", ""))
        combined = resume + "\n" + cover
        audit = output.get("audit") or (ContentLibrary(self.source_dir).validate_claims(combined) if self.source_dir.exists() else {"verified": True, "issue_count": 0, "issues": []})
        return {"model_id": model_id, "display_name": display_name, "status": "completed", "resume_text": resume, "cover_letter_text": cover, "latency_ms": round((time.perf_counter() - started) * 1000), "audit": audit, "generated_at_epoch": time.time(), "token_usage": output.get("usage")}

    def _complete(self, comparison_id, model_id, cache_key, future, timer, on_update):
        timer.cancel()
        if (comparison_id, model_id) in self.timed_out:
            return
        try:
            result = future.result()
        except Exception as error:
            result = {"model_id": model_id, "status": "failed", "error": str(error), "latency_ms": 0, "generated_at_epoch": time.time()}
        on_update(model_id, cache_key, result)

    def _timeout(self, comparison_id, model_id, cache_key, on_update):
        self.timed_out.add((comparison_id, model_id))
        on_update(model_id, cache_key, {"model_id": model_id, "status": "timeout", "error": f"Model timed out after {self.timeout_seconds:g} seconds", "latency_ms": round(self.timeout_seconds * 1000), "generated_at_epoch": time.time()})
