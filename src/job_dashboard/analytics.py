"""
Advanced analytics and insights for job dashboard.
Provides market trends, salary analysis, and performance metrics.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any

import numpy as np

from .cache import get_cache
from .logging import get_logger
from .types import JobDict

logger = get_logger("job_dashboard.analytics")


class JobAnalytics:
    """Advanced analytics for job market insights."""
    
    def __init__(self):
        self.cache = get_cache()
        logger.info("Job analytics initialized")
    
    def analyze_market_trends(
        self,
        jobs: list[JobDict],
        timeframe_days: int = 30
    ) -> dict[str, Any]:
        """
        Analyze job market trends over time.
        
        Args:
            jobs: List of job data dictionaries
            timeframe_days: Number of days to analyze
            
        Returns:
            Dictionary with market trend insights
        """
        cache_key = f"market_trends:{len(jobs)}:{timeframe_days}"
        
        # Check cache
        cached_result = self.cache.get(cache_key)
        if cached_result:
            logger.debug("Cache hit for market trends")
            return cached_result
        
        if not jobs:
            return {
                "error": "No jobs to analyze",
                "trends": {},
                "summary": {}
            }
        
        # Parse dates
        dated_jobs = []
        for job in jobs:
            posted = job.get('posted')
            if posted:
                try:
                    posted_date = datetime.fromisoformat(posted.replace('Z', '+00:00'))
                    dated_jobs.append((posted_date, job))
                except (ValueError, TypeError):
                    continue
        
        # Filter by timeframe
        cutoff_date = datetime.now() - timedelta(days=timeframe_days)
        recent_jobs = [(date, job) for date, job in dated_jobs if date >= cutoff_date]
        
        # Calculate trends
        trends = {
            "daily_postings": self._calculate_daily_postings(recent_jobs),
            "weekly_trend": self._calculate_weekly_trend(recent_jobs),
            "top_skills": self._calculate_top_skills([job for _, job in recent_jobs]),
            "salary_distribution": self._analyze_salary_distribution([job for _, job in recent_jobs]),
            "remote_work_trend": self._analyze_remote_work_trend(recent_jobs),
            "company_distribution": self._analyze_company_distribution([job for _, job in recent_jobs])
        }
        
        # Generate summary
        summary = self._generate_market_summary(trends, len(recent_jobs), timeframe_days)
        
        result = {
            "timeframe_days": timeframe_days,
            "total_jobs_analyzed": len(recent_jobs),
            "trends": trends,
            "summary": summary,
            "generated_at": datetime.now().isoformat()
        }
        
        # Cache result (6 hours)
        self.cache.set(cache_key, result, ttl=21600)
        
        return result
    
    def _calculate_daily_postings(self, dated_jobs: list[tuple[datetime, JobDict]]) -> dict[str, int]:
        """Calculate daily job postings."""
        daily_counts = defaultdict(int)
        
        for date, _ in dated_jobs:
            day_key = date.strftime("%Y-%m-%d")
            daily_counts[day_key] += 1
        
        # Sort by date
        sorted_counts = dict(sorted(daily_counts.items()))
        
        return sorted_counts
    
    def _calculate_weekly_trend(self, dated_jobs: list[tuple[datetime, JobDict]]) -> dict[str, Any]:
        """Calculate weekly posting trends."""
        weekly_counts = defaultdict(int)
        
        for date, _ in dated_jobs:
            week_key = date.strftime("%Y-W%W")
            weekly_counts[week_key] += 1
        
        # Calculate trend
        weeks = sorted(weekly_counts.keys())
        counts = [weekly_counts[week] for week in weeks]
        
        if len(counts) >= 2:
            # Simple linear trend
            if counts[-1] > counts[-2]:
                trend = "increasing"
            elif counts[-1] < counts[-2]:
                trend = "decreasing"
            else:
                trend = "stable"
            
            percentage_change = ((counts[-1] - counts[-2]) / counts[-2] * 100) if counts[-2] > 0 else 0
        else:
            trend = "insufficient_data"
            percentage_change = 0
        
        return {
            "weekly_counts": dict(sorted(weekly_counts.items())),
            "trend": trend,
            "percentage_change": round(percentage_change, 1),
            "current_week": weeks[-1] if weeks else None,
            "current_count": counts[-1] if counts else 0
        }
    
    def _calculate_top_skills(self, jobs: list[JobDict], top_n: int = 10) -> list[dict[str, Any]]:
        """Calculate top in-demand skills."""
        skill_counter = Counter()
        
        for job in jobs:
            skills = job.get('skills', [])
            if isinstance(skills, list):
                for skill in skills:
                    skill_counter[skill.lower().strip()] += 1
        
        top_skills = []
        for skill, count in skill_counter.most_common(top_n):
            percentage = (count / len(jobs) * 100) if jobs else 0
            top_skills.append({
                "skill": skill.title(),
                "count": count,
                "percentage": round(percentage, 1),
                "demand_level": self._classify_demand_level(percentage)
            })
        
        return top_skills
    
    def _classify_demand_level(self, percentage: float) -> str:
        """Classify skill demand level."""
        if percentage >= 50:
            return "very_high"
        elif percentage >= 30:
            return "high"
        elif percentage >= 15:
            return "medium"
        elif percentage >= 5:
            return "low"
        else:
            return "niche"
    
    def _analyze_salary_distribution(self, jobs: list[JobDict]) -> dict[str, Any]:
        """Analyze salary distribution."""
        salaries = []
        
        for job in jobs:
            salary_text = job.get('salary', '')
            if salary_text:
                # Simple extraction - just take first number
                import re
                match = re.search(r'\$?(\d[\d,]*\.?\d*)', salary_text)
                if match:
                    try:
                        salary = float(match.group(1).replace(',', ''))
                        
                        # Handle k/m suffixes
                        if 'k' in salary_text.lower():
                            salary *= 1000
                        elif 'm' in salary_text.lower():
                            salary *= 1000000
                        
                        salaries.append(salary)
                    except (ValueError, AttributeError):
                        continue
        
        if not salaries:
            return {
                "error": "No salary data available",
                "count": 0,
                "distribution": {}
            }
        
        # Calculate statistics
        salaries_array = np.array(salaries)
        
        return {
            "count": len(salaries),
            "min": float(np.min(salaries_array)),
            "max": float(np.max(salaries_array)),
            "mean": float(np.mean(salaries_array)),
            "median": float(np.median(salaries_array)),
            "std": float(np.std(salaries_array)),
            "percentiles": {
                "25th": float(np.percentile(salaries_array, 25)),
                "50th": float(np.percentile(salaries_array, 50)),
                "75th": float(np.percentile(salaries_array, 75)),
                "90th": float(np.percentile(salaries_array, 90))
            },
            "salary_brackets": self._calculate_salary_brackets(salaries_array)
        }
    
    def _calculate_salary_brackets(self, salaries: np.ndarray) -> dict[str, int]:
        """Calculate salary distribution brackets."""
        if len(salaries) == 0:
            return {}
        
        max_salary = np.max(salaries)
        
        # Define brackets
        brackets = {
            "under_50k": 0,
            "50k_100k": 0,
            "100k_150k": 0,
            "150k_200k": 0,
            "200k_300k": 0,
            "over_300k": 0
        }
        
        for salary in salaries:
            if salary < 50000:
                brackets["under_50k"] += 1
            elif salary < 100000:
                brackets["50k_100k"] += 1
            elif salary < 150000:
                brackets["100k_150k"] += 1
            elif salary < 200000:
                brackets["150k_200k"] += 1
            elif salary < 300000:
                brackets["200k_300k"] += 1
            else:
                brackets["over_300k"] += 1
        
        # Calculate percentages
        total = len(salaries)
        percentages = {}
        for key, count in brackets.items():
            percentages[f"{key}_pct"] = round((count / total) * 100, 1) if total > 0 else 0
        
        return {**brackets, **percentages}
    
    def _analyze_remote_work_trend(self, dated_jobs: list[tuple[datetime, JobDict]]) -> dict[str, Any]:
        """Analyze remote work trend over time."""
        remote_by_week = defaultdict(int)
        total_by_week = defaultdict(int)
        
        for date, job in dated_jobs:
            week_key = date.strftime("%Y-W%W")
            total_by_week[week_key] += 1
            
            if job.get('remote', False):
                remote_by_week[week_key] += 1
        
        # Calculate percentages
        remote_percentages = {}
        for week in sorted(total_by_week.keys()):
            total = total_by_week[week]
            remote = remote_by_week.get(week, 0)
            remote_percentages[week] = round((remote / total) * 100, 1) if total > 0 else 0
        
        # Overall trend
        if len(remote_percentages) >= 2:
            weeks = sorted(remote_percentages.keys())
            if remote_percentages[weeks[-1]] > remote_percentages[weeks[-2]]:
                trend = "increasing"
            elif remote_percentages[weeks[-1]] < remote_percentages[weeks[-2]]:
                trend = "decreasing"
            else:
                trend = "stable"
        else:
            trend = "insufficient_data"
        
        return {
            "remote_percentages": remote_percentages,
            "current_remote_pct": remote_percentages[list(remote_percentages.keys())[-1]] if remote_percentages else 0,
            "trend": trend,
            "average_remote_pct": round(np.mean(list(remote_percentages.values())), 1) if remote_percentages else 0
        }
    
    def _analyze_company_distribution(self, jobs: list[JobDict]) -> dict[str, Any]:
        """Analyze company posting distribution."""
        company_counter = Counter()
        
        for job in jobs:
            company = job.get('company', 'Unknown')
            if company:
                company_counter[company] += 1
        
        top_companies = []
        for company, count in company_counter.most_common(10):
            percentage = (count / len(jobs) * 100) if jobs else 0
            top_companies.append({
                "company": company,
                "job_count": count,
                "percentage": round(percentage, 1)
            })
        
        return {
            "top_companies": top_companies,
            "unique_companies": len(company_counter),
            "concentration": self._calculate_concentration_index(company_counter, len(jobs))
        }
    
    def _calculate_concentration_index(self, counter: Counter, total: int) -> float:
        """Calculate market concentration index (Herfindahl-Hirschman Index)."""
        if total == 0:
            return 0.0
        
        hhi = 0.0
        for count in counter.values():
            share = count / total
            hhi += share * share
        
        return round(hhi * 10000, 2)  # Scale to typical HHI range
    
    def _generate_market_summary(self, trends: dict[str, Any], total_jobs: int, timeframe_days: int) -> dict[str, Any]:
        """Generate human-readable market summary."""
        summary_parts = []
        
        # Job volume summary
        daily_avg = round(total_jobs / timeframe_days, 1) if timeframe_days > 0 else 0
        summary_parts.append(f"Average of {daily_avg} jobs posted per day over {timeframe_days} days")
        
        # Trend summary
        weekly_trend = trends.get('weekly_trend', {})
        if weekly_trend.get('trend') == 'increasing':
            summary_parts.append(f"Job postings increasing ({weekly_trend.get('percentage_change', 0)}% this week)")
        elif weekly_trend.get('trend') == 'decreasing':
            summary_parts.append(f"Job postings decreasing ({weekly_trend.get('percentage_change', 0)}% this week)")
        
        # Top skills summary
        top_skills = trends.get('top_skills', [])
        if top_skills:
            top_skill = top_skills[0]['skill']
            top_percentage = top_skills[0]['percentage']
            summary_parts.append(f"Most in-demand skill: {top_skill} ({top_percentage}% of jobs)")
        
        # Remote work summary
        remote_trend = trends.get('remote_work_trend', {})
        remote_pct = remote_trend.get('current_remote_pct', 0)
        summary_parts.append(f"{remote_pct}% of jobs offer remote work")
        
        # Salary summary
        salary_dist = trends.get('salary_distribution', {})
        if salary_dist.get('count', 0) > 0:
            median_salary = salary_dist.get('median', 0)
            if median_salary >= 100000:
                median_str = f"${median_salary/1000:.0f}k"
            else:
                median_str = f"${median_salary:,.0f}"
            summary_parts.append(f"Median salary: {median_str}")
        
        return {
            "text": ". ".join(summary_parts),
            "key_metrics": {
                "daily_average": daily_avg,
                "weekly_trend": weekly_trend.get('trend', 'unknown'),
                "top_skill": top_skills[0]['skill'] if top_skills else None,
                "remote_percentage": remote_pct,
                "median_salary": salary_dist.get('median', 0) if salary_dist.get('count', 0) > 0 else None
            }
        }
    
    def analyze_skills_gap(
        self,
        profile_skills: list[str],
        job_skills: list[list[str]],
        top_n: int = 5
    ) -> dict[str, Any]:
        """
        Analyze skills gap between profile and job market.
        
        Args:
            profile_skills: List of user's skills
            job_skills: List of job skill requirements
            top_n: Number of top missing skills to identify
            
        Returns:
            Skills gap analysis
        """
        cache_key = f"skills_gap:{len(profile_skills)}:{len(job_skills)}"
        
        cached_result = self.cache.get(cache_key)
        if cached_result:
            logger.debug("Cache hit for skills gap analysis")
            return cached_result
        
        profile_skills_set = set(skill.lower() for skill in profile_skills)
        
        # Count skill occurrences across jobs
        market_skill_counter = Counter()
        for job_skill_list in job_skills:
            if isinstance(job_skill_list, list):
                for skill in job_skill_list:
                    market_skill_counter[skill.lower()] += 1
        
        # Identify missing skills
        missing_skills = []
        for skill, count in market_skill_counter.most_common():
            if skill not in profile_skills_set:
                percentage = (count / len(job_skills) * 100) if job_skills else 0
                missing_skills.append({
                    "skill": skill.title(),
                    "job_count": count,
                    "percentage": round(percentage, 1),
                    "priority": self._calculate_skill_priority(percentage, count)
                })
        
        # Take top N missing skills
        top_missing_skills = missing_skills[:top_n]
        
        # Calculate coverage metrics
        total_market_skills = sum(market_skill_counter.values())
        covered_skills = sum(count for skill, count in market_skill_counter.items() if skill in profile_skills_set)
        
        coverage_percentage = (covered_skills / total_market_skills * 100) if total_market_skills > 0 else 0
        
        result = {
            "profile_skill_count": len(profile_skills),
            "market_skill_count": len(market_skill_counter),
            "coverage_percentage": round(coverage_percentage, 1),
            "top_missing_skills": top_missing_skills,
            "skill_gap_score": self._calculate_skill_gap_score(coverage_percentage, len(top_missing_skills)),
            "recommendations": self._generate_skill_recommendations(top_missing_skills, coverage_percentage)
        }
        
        # Cache result (12 hours)
        self.cache.set(cache_key, result, ttl=43200)
        
        return result
    
    def _calculate_skill_priority(self, percentage: float, count: int) -> str:
        """Calculate priority level for missing skill."""
        if percentage >= 30 or count >= 10:
            return "high"
        elif percentage >= 20 or count >= 5:
            return "medium"
        else:
            return "low"
    
    def _calculate_skill_gap_score(self, coverage_percentage: float, missing_count: int) -> float:
        """Calculate skill gap score (0-100, higher is better)."""
        # Coverage contributes 70%, missing count contributes 30%
        coverage_score = min(100, coverage_percentage * 1.4)  # Scale to 100
        
        # Missing count penalty (0-5 missing = good, 10+ = poor)
        missing_penalty = min(30, missing_count * 3)
        
        return max(0, min(100, coverage_score - missing_penalty))
    
    def _generate_skill_recommendations(
        self,
        missing_skills: list[dict[str, Any]],
        coverage_percentage: float
    ) -> list[str]:
        """Generate skill development recommendations."""
        recommendations = []
        
        if coverage_percentage >= 70:
            recommendations.append("Your skills are well-aligned with the job market")
        elif coverage_percentage >= 50:
            recommendations.append("Consider developing 1-2 key missing skills to improve your competitiveness")
        else:
            recommendations.append("Significant skills gap identified - focus on developing in-demand skills")
        
        if missing_skills:
            top_skills = [skill['skill'] for skill in missing_skills[:3]]
            recommendations.append(f"Top skills to learn: {', '.join(top_skills)}")
        
        return recommendations


# Global instance
_analytics = None


def get_analytics() -> JobAnalytics:
    """Get the global analytics instance."""
    global _analytics
    if _analytics is None:
        _analytics = JobAnalytics()
    return _analytics