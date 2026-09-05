from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from .applications import split_documents
from .cache import get_cache
from .content_library import ContentLibrary
from .documents import generate_documents as generate_fallback
from .logging import get_logger
from .models import Job
from .prompt_context import load_prompt_context
from .retry import API_RETRY_CONFIG, retry

logger = get_logger("job_dashboard.llm")


class OpenRouterDocumentGenerator:
    """Generate grounded application documents with the configured OpenRouter model."""

    def __init__(self, source_dir: str | Path, guidelines_dir: str | Path, model: str | None = None, api_key: str | None = None, examples_dir: str | Path | None = None):
        self.source_dir = Path(source_dir)
        self.guidelines_dir = Path(guidelines_dir)
        self.context = load_prompt_context(source_dir, guidelines_dir, examples_dir=examples_dir)
        self.reference_style = """Use the attached reference examples and Shared Voice Guide as the writing and presentation standard. Write in Sam Ludwig's confident, plain-spoken, technically precise voice. Use action-led achievement bullets, accurate metrics, Australian spelling, clean title-case headings, and generous whitespace. Cover letters must be natural business letters without visible section labels or meta commentary."""
        self.model = model or os.environ.get("LLM_MODEL", "deepseek/deepseek-v4-flash-0731")
        self.api_key = (
            api_key
            or os.environ.get("JOB_DASHBOARD_OPENROUTER_API_KEY", "")
            or os.environ.get("OPENROUTER_API_KEY", "")
            or self._config_key()
        )

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
        start_time = time.time()
        
        # Check cache first
        cache = get_cache()
        cache_key = self._generate_cache_key(job, profile)
        cached_result = cache.get_llm_response(cache_key, self.model)
        
        if cached_result:
            logger.info(f"Cache hit for LLM generation: {job.title} at {job.company}")
            try:
                result = json.loads(cached_result)
                result["cached"] = True
                result["generation_time"] = time.time() - start_time
                return result
            except json.JSONDecodeError:
                logger.warning("Failed to parse cached result, regenerating")
        
        key = self.api_key or self._config_key()
        if not key:
            return self._fallback(job, profile)
        
        # Generate prompt
        personal = profile.get("personal", {})
        prompt = self._create_prompt(job, profile, personal)
        
        # Make API call with retry
        try:
            response_data = self._make_api_call_with_retry(prompt, key)
            
            # Process response
            content = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")
            resume, cover, _ = split_documents(content)
            
            if not resume or not cover:
                logger.warning("Invalid response format from LLM, using fallback")
                return self._fallback(job, profile)
            
            # Create result
            result = self._create_result(job, resume, cover, response_data)
            result["generation_time"] = time.time() - start_time
            
            # Cache the result
            cache.cache_llm_response(cache_key, self.model, json.dumps(result), ttl_seconds=86400)
            logger.info(f"Generated documents for {job.title} at {job.company} in {result['generation_time']:.2f}s")
            
            return result
            
        except Exception as e:
            logger.error(f"LLM generation failed: {e!s}", exc_info=True)
            return self._fallback(job, profile)
    
    def _generate_cache_key(self, job: Job, profile: Mapping[str, Any]) -> str:
        """Generate cache key for LLM generation."""
        import hashlib
        
        job_data = {
            "title": job.title,
            "company": job.company,
            "description": job.description[:500] if job.description else "",
        }
        profile_data = {
            "skills": profile.get("skills", {}),
            "personal": profile.get("personal", {}),
        }
        
        key_data = {
            "job": job_data,
            "profile": profile_data,
            "model": self.model,
            "context_hash": hashlib.md5(str(self.context).encode()).hexdigest()[:16]
        }
        
        return hashlib.md5(json.dumps(key_data, sort_keys=True).encode()).hexdigest()
    
    def _create_prompt(self, job: Job, profile: Mapping[str, Any], personal: dict) -> str:
        """Create the LLM prompt."""
        return f"""Candidate profile JSON (verified facts only):
{json.dumps(profile, ensure_ascii=False, indent=2)}

Career data from every file in Source of truth/; construction instructions and examples from Guidelines/:
{self.context}

Reference formatting and style standard (do not copy the Master Resume layout):
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
    
    @retry(API_RETRY_CONFIG)
    def _make_api_call_with_retry(self, prompt: str, api_key: str) -> dict:
        """Make API call with retry logic."""
        model = self.model.removeprefix("openrouter/")
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You produce accurate, grounded job application documents."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 4000
        }
        
        request = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=json.dumps(payload).encode(),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
        )
        
        with urllib.request.urlopen(request, timeout=45) as response:
            data = json.loads(response.read().decode("utf-8"))
            logger.log_api_call(
                endpoint="/api/v1/chat/completions",
                method="POST",
                duration_seconds=response.info().get("X-Response-Time", 0)
            )
            return data
    
    def _create_result(self, job: Job, resume: str, cover: str, response_data: dict) -> dict[str, Any]:
        """Create result dictionary from LLM response."""
        audit = ContentLibrary(self.source_dir).validate_claims(
            resume + "\n" + cover
        ) if self.source_dir.exists() else {"verified": True, "issue_count": 0, "issues": []}
        
        application_id = re.sub(
            r"[^a-z0-9]+", "_",
            f"{job.company}_{job.title}".lower()
        ).strip("_")[:160]
        
        return {
            "resume": resume + "\n",
            "cover_letter": cover + "\n",
            "application_id": application_id,
            "audit": audit,
            "status": "draft_ready" if audit["verified"] else "needs_review",
            "usage": response_data.get("usage"),
            "cached": False
        }

    def _fallback(self, job: Job, profile: Mapping[str, Any]) -> dict[str, Any]:
        documents = generate_fallback(job, profile)
        documents["audit"] = ContentLibrary(self.source_dir).validate_claims(
            documents["resume"] + "\n" + documents["cover_letter"]
        ) if self.source_dir.exists() else {"verified": True, "issue_count": 0, "issues": []}
        documents["status"] = "draft_ready" if documents["audit"]["verified"] else "needs_review"
        return documents
