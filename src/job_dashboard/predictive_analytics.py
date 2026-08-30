"""
Predictive analytics for Phase 4B.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from .cache import get_cache
from .logging import get_logger
from .types import JobDict

logger = get_logger("job_dashboard.predictive_analytics")


class PredictiveAnalytics:
    def __init__(self):
        self.cache = get_cache()
        logger.info("Predictive analytics initialized")
    
    def predict_market_trends(self, jobs: list[JobDict], forecast_days: int = 30) -> dict[str, Any]:
        if len(jobs) < 10:
            return {"error": "Insufficient data", "available": len(jobs), "minimum": 10}
        
        cache_key = f"market_predictions:{len(jobs)}:{forecast_days}"
        cached_result = self.cache.get(cache_key)
        if cached_result:
            logger.debug("Cache hit for market predictions")
            return cached_result
        
        result = {
            "forecast_days": forecast_days,
            "data_points": len(jobs),
            "market_health": self._assess_market_health(jobs),
            "skill_demand": self._analyze_skill_demand(jobs),
            "generated_at": datetime.now().isoformat()
        }
        
        self.cache.set(cache_key, result, ttl=43200)
        return result
    
    def _assess_market_health(self, jobs: list[JobDict]) -> dict[str, Any]:
        if len(jobs) < 3:
            return {"score": 50, "status": "insufficient_data"}
        
        posting_rate = len(jobs) / 30
        skill_diversity = len(set(skill for job in jobs for skill in job.get('skills', [])))
        
        volume_score = min(100, posting_rate * 10)
        diversity_score = min(100, skill_diversity / 5)
        health_score = (volume_score + diversity_score) / 2
        
        if health_score >= 70:
            status = "healthy"
        elif health_score >= 50:
            status = "moderate"
        else:
            status = "weak"
        
        return {
            "score": round(health_score, 1),
            "status": status,
            "volume_score": round(volume_score, 1),
            "diversity_score": round(diversity_score, 1)
        }
    
    def _analyze_skill_demand(self, jobs: list[JobDict]) -> dict[str, Any]:
        skill_counts = {}
        for job in jobs:
            for skill in job.get('skills', []):
                skill_counts[skill] = skill_counts.get(skill, 0) + 1
        
        if not skill_counts:
            return {"top_skills": [], "trending": []}
        
        sorted_skills = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)
        top_skills = [{"skill": skill, "count": count} for skill, count in sorted_skills[:10]]
        
        trending = []
        for skill, total_count in skill_counts.items():
            if total_count >= 2:
                trending.append({"skill": skill, "count": total_count})
        
        return {
            "top_skills": top_skills,
            "trending_skills": trending[:5],
            "total_skills": len(skill_counts)
        }
    
    def recommend_timing(self, jobs: list[JobDict]) -> dict[str, Any]:
        trends = self.predict_market_trends(jobs, forecast_days=7)
        return {
            "market_context": {
                "health": trends.get("market_health", {}).get("status", "unknown")
            },
            "recommendations": [
                "Check new postings early in the week",
                "Apply within 48 hours of job posting",
                "Follow up within 3-5 business days"
            ]
        }


_predictive_analytics = None


def get_predictive_analytics() -> PredictiveAnalytics:
    global _predictive_analytics
    if _predictive_analytics is None:
        _predictive_analytics = PredictiveAnalytics()
    return _predictive_analytics