"""
Smart recommendation engine for job dashboard.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from .cache import get_cache
from .logging import get_logger
from .types import JobDict

logger = get_logger("job_dashboard.recommendations")


@dataclass
class Recommendation:
    job: JobDict
    score: float
    explanation: str


class SmartRecommendationEngine:
    def __init__(self):
        self.cache = get_cache()
        logger.info("Recommendation engine initialized")
    
    def get_recommendations(
        self,
        profile: dict[str, Any],
        jobs: list[JobDict],
        limit: int = 10
    ) -> list[Recommendation]:
        if not jobs:
            return []
        
        # Cache key
        cache_key = f"recs:{hash(json.dumps(profile, sort_keys=True))}:{len(jobs)}"
        
        # Check cache
        cached = self.cache.get(cache_key)
        if cached:
            logger.debug("Cache hit for recommendations")
            return [Recommendation(**r) for r in cached]
        
        # Score jobs
        scored = []
        for job in jobs:
            score = self._score_job(job, profile)
            scored.append((job, score))
        
        # Sort and limit
        scored.sort(key=lambda x: x[1], reverse=True)
        recommendations = []
        
        for job, score in scored[:limit]:
            explanation = self._generate_explanation(job, profile, score)
            recommendations.append(Recommendation(job, score, explanation))
        
        # Cache
        self.cache.set(cache_key, [r.__dict__ for r in recommendations], ttl=21600)
        
        return recommendations
    
    def _score_job(self, job: JobDict, profile: dict[str, Any]) -> float:
        score = 50.0  # Base score
        
        # Skill match
        job_skills = set(job.get('skills', []))
        profile_skills = set(profile.get('skills', []))
        if job_skills and profile_skills:
            match = len(job_skills & profile_skills) / len(job_skills)
            score += match * 30
        
        # Location
        job_loc = job.get('location', '').lower()
        profile_loc = profile.get('location_preference', '').lower()
        if profile_loc and profile_loc in job_loc:
            score += 10
        if 'remote' in job_loc:
            score += 5
        
        # Salary
        salary_text = job.get('salary', '')
        expected = profile.get('salary_expectation', 0)
        if salary_text and expected:
            # Simple salary check
            import re
            nums = re.findall(r'\$?(\d[\d,]*)', salary_text)
            if nums:
                try:
                    salary = float(nums[0].replace(',', ''))
                    if 'k' in salary_text.lower():
                        salary *= 1000
                    if salary >= expected * 0.8:
                        score += 5
                except ValueError:
                    pass
        
        # Recency
        posted = job.get('posted')
        if posted:
            try:
                posted_date = datetime.fromisoformat(posted.replace('Z', '+00:00'))
                days_old = (datetime.now() - posted_date).days
                if days_old <= 7:
                    score += 5
                elif days_old <= 30:
                    score += 2
            except (ValueError, TypeError):
                pass
        
        return min(100, max(0, score))
    
    def _generate_explanation(self, job: JobDict, profile: dict[str, Any], score: float) -> str:
        if score >= 80:
            return "Excellent match based on your profile"
        elif score >= 60:
            return "Good match with most requirements"
        elif score >= 40:
            return "Moderate match, some gaps"
        else:
            return "Basic match, consider other options"


# Global instance
_recommendation_engine = None


def get_recommendation_engine() -> SmartRecommendationEngine:
    global _recommendation_engine
    if _recommendation_engine is None:
        _recommendation_engine = SmartRecommendationEngine()
    return _recommendation_engine