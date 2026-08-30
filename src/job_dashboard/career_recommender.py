"""
Career path recommender for Phase 4B.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from .cache import get_cache
from .logging import get_logger
from .types import JobDict

logger = get_logger("job_dashboard.career_recommender")


class CareerRecommender:
    def __init__(self):
        self.cache = get_cache()
        self.paths = {
            "data_scientist": {"title": "Data Scientist", "skills": ["Python", "SQL", "Statistics"], "salary": (80000, 150000)},
            "devops": {"title": "DevOps Engineer", "skills": ["Linux", "Docker", "AWS"], "salary": (70000, 140000)},
            "fullstack": {"title": "Full Stack Developer", "skills": ["JavaScript", "React", "Node.js"], "salary": (60000, 130000)},
        }
        logger.info("Career recommender initialized")
    
    def analyze_skill_gap(self, user_skills: list[str], target_role: str, market_jobs: list[JobDict]) -> dict[str, Any]:
        cache_key = f"skill_gap:{hash(tuple(user_skills))}:{target_role}:{len(market_jobs)}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        
        path = None
        for path_data in self.paths.values():
            if target_role.lower() in path_data["title"].lower():
                path = path_data
                break
        
        if not path:
            path = list(self.paths.values())[0]
        
        user_set = set(s.lower() for s in user_skills)
        required_set = set(s.lower() for s in path["skills"])
        
        existing = list(required_set.intersection(user_set))
        missing = list(required_set - user_set)
        coverage = len(existing) / len(required_set) * 100 if required_set else 0
        
        result = {
            "target_role": target_role,
            "career_path": path["title"],
            "gap_analysis": {
                "existing": existing,
                "missing": missing,
                "coverage": round(coverage, 1)
            },
            "estimated_timeline": self._estimate_timeline(coverage),
            "generated_at": datetime.now().isoformat()
        }
        
        self.cache.set(cache_key, result, ttl=86400)
        return result
    
    def _estimate_timeline(self, coverage: float) -> dict[str, Any]:
        if coverage >= 80:
            return {"months": 0, "readiness": "Ready"}
        elif coverage >= 60:
            return {"months": 1, "readiness": "Almost Ready"}
        elif coverage >= 40:
            return {"months": 3, "readiness": "Some Preparation Needed"}
        else:
            return {"months": 6, "readiness": "Significant Learning Required"}
    
    def recommend_career_paths(self, user_skills: list[str], user_interests: list[str], market_jobs: list[JobDict]) -> list[dict[str, Any]]:
        cache_key = f"career_paths:{hash(tuple(user_skills))}:{hash(tuple(user_interests))}:{len(market_jobs)}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        
        user_set = set(s.lower() for s in user_skills)
        recommendations = []
        
        for path_id, path_data in self.paths.items():
            required_set = set(s.lower() for s in path_data["skills"])
            skill_match = len(user_set.intersection(required_set)) / len(required_set) if required_set else 0
            
            if skill_match >= 0.3:
                recommendations.append({
                    "path": path_data["title"],
                    "match_score": round(skill_match, 3),
                    "skill_gap": len(required_set - user_set),
                    "salary_range": path_data["salary"]
                })
        
        recommendations.sort(key=lambda x: x["match_score"], reverse=True)
        result = recommendations[:3]
        
        self.cache.set(cache_key, result, ttl=86400)
        return result


_career_recommender = None


def get_career_recommender() -> CareerRecommender:
    global _career_recommender
    if _career_recommender is None:
        _career_recommender = CareerRecommender()
    return _career_recommender