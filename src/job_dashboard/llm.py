from __future__ import annotations

import json
import os
import re
import urllib.request
import urllib.error
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from .applications import split_documents
from .content_library import ContentLibrary
from .documents import generate_documents as generate_fallback
from .models import Job
from .prompt_context import load_prompt_context


class OpenRouterDocumentGenerator:
    """Generate grounded application documents with the configured OpenRouter model."""

    def __init__(self, source_dir: str | Path, guidelines_dir: str | Path, model: str | None = None, api_key: str | None = None):
        self.source_dir = Path(source_dir)
        self.context = load_prompt_context(source_dir, guidelines_dir)
        self.reference_style = """Use the attached reference examples and Shared Voice Guide as the writing and presentation standard. Write in Sam Ludwig's confident, plain-spoken, technically precise voice. Use action-led achievement bullets, accurate metrics, Australian spelling, clean title-case headings, and generous whitespace. Cover letters must be natural business letters without visible section labels or meta commentary."""
        self.model = model or os.environ.get("LLM_MODEL", "deepseek/deepseek-v4-flash-0731")
        self.api_key = api_key or os.environ.get("OPENROUTER_API_KEY", "")

    def _config_key(self) -> str:
        config_path = Path("/home/s/.openclaw/openclaw.json")
        if not config_path.exists():
            return ""
        try:
            config = json.loads(config_path.read_text(encoding="utf-8"))
            return str(config.get("models", {}).get("providers", {}).get("openrouter", {}).get("apiKey", ""))
        except OSError:
            return ""
        except (TypeError, ValueError, json.JSONDecodeError):
            return ""

    def generate(self, job: Job, profile: Mapping[str, Any]) -> dict[str, Any]:
        key = self.api_key or self._config_key()
        if not key:
            return self._fallback(job, profile)
        personal = profile.get("personal", {})
        prompt = f"""Candidate profile JSON (verified facts only):
{json.dumps(profile, ensure_ascii=False, indent=2)}

Source of truth and writing guidelines (Master Resume.md is authoritative):
{self.context}

Reference style standard:
{self.reference_style}

Target job:
Title: {job.title}
Company: {job.company}
Location: {job.location}
Description: {job.description}

Create a polished, modern, ATS-friendly CV and a professional cover letter using only verified candidate facts.
Use the attached guidelines as binding instructions. Tailor emphasis to the listing, but do not invent skills,
dates, employers, qualifications, metrics, licences, or responsibilities. Use Australian spelling and natural,
senior-professional wording. Do not include listing metadata, scratchpad notes, match commentary, or a target-role
heading that is not appropriate for a CV. The CV must use clear headings, concise achievement-led bullets, and
consistent date formatting. The cover letter must be 250-400 words, reference a specific detail from the listing,
and avoid generic boilerplate. Return the CV first, then exactly this separator on its own line:
===COVER_LETTER===
Then return only the cover letter. Do not add commentary outside the documents. Candidate name: {personal.get('full_name', 'Candidate')}"""
        model = self.model.removeprefix("openrouter/")
        payload = {"model": model, "messages": [{"role": "system", "content": "You produce accurate, grounded job application documents."}, {"role": "user", "content": prompt}], "temperature": 0.3, "max_tokens": 4000}
        request = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                data = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            return self._fallback(job, profile)
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        resume, cover, _ = split_documents(content)
        if not resume or not cover:
            return self._fallback(job, profile)
        audit = ContentLibrary(self.source_dir).validate_claims(resume + "\n" + cover) if self.source_dir.exists() else {"verified": True, "issue_count": 0, "issues": []}
        return {"resume": resume + "\n", "cover_letter": cover + "\n", "application_id": re.sub(r"[^a-z0-9]+", "_", f"{job.company}_{job.title}".lower()).strip("_")[:160], "audit": audit, "status": "draft_ready" if audit["verified"] else "needs_review"}

    def _fallback(self, job: Job, profile: Mapping[str, Any]) -> dict[str, Any]:
        documents = generate_fallback(job, profile)
        documents["audit"] = ContentLibrary(self.source_dir).validate_claims(
            documents["resume"] + "\n" + documents["cover_letter"]
        ) if self.source_dir.exists() else {"verified": True, "issue_count": 0, "issues": []}
        documents["status"] = "draft_ready" if documents["audit"]["verified"] else "needs_review"
        return documents
