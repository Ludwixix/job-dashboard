"""
Basic background tasks.
"""
import time
from datetime import datetime
from typing import Any

from .logging import get_logger

logger = get_logger("job_dashboard.tasks")


def sync_jobs() -> dict[str, Any]:
    """Sync jobs from all sources."""
    try:
        logger.info("Starting job sync")
        start_time = time.time()
        
        # Import here to avoid circular imports
        from .repository import get_repository
        from .scraping import scrape_all_jobs
        
        repo = get_repository()
        initial_count = repo.count_jobs()
        
        jobs = scrape_all_jobs()
        new_jobs = []
        
        for job in jobs:
            existing = repo.get_job_by_url(job.get('url', ''))
            if not existing:
                job_id = repo.add_job(job)
                if job_id:
                    new_jobs.append(job_id)
        
        final_count = repo.count_jobs()
        duration = time.time() - start_time
        
        logger.info(f"Sync completed: {len(new_jobs)} new jobs")
        return {
            "new_jobs": len(new_jobs),
            "total_jobs": final_count,
            "duration": duration
        }
        
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise


def update_recommendations() -> dict[str, Any]:
    """Update recommendations."""
    try:
        logger.info("Updating recommendations")
        start_time = time.time()
        
        from .recommendations import get_recommendation_engine
        from .repository import get_repository
        
        repo = get_repository()
        engine = get_recommendation_engine()
        
        jobs = repo.get_all_jobs()
        sample_profile = {
            "skills": ["python", "machine learning"],
            "experience_years": 3,
            "preferred_locations": ["Remote"]
        }
        
        recs = engine.get_recommendations(sample_profile, jobs[:50])
        duration = time.time() - start_time
        
        logger.info(f"Recommendations updated: {len(recs)} recommendations")
        return {
            "recommendations": len(recs),
            "duration": duration
        }
        
    except Exception as e:
        logger.error(f"Recommendations update failed: {e}")
        raise


def generate_analytics() -> dict[str, Any]:
    """Generate analytics report."""
    try:
        logger.info("Generating analytics")
        start_time = time.time()
        
        from .analytics import get_analytics
        from .repository import get_repository
        
        repo = get_repository()
        analytics = get_analytics()
        
        jobs = repo.get_all_jobs()
        trends = analytics.analyze_market_trends(jobs)
        salaries = analytics.analyze_salary_distribution(jobs)
        
        duration = time.time() - start_time
        
        logger.info("Analytics generated")
        return {
            "total_jobs": len(jobs),
            "trends_analyzed": bool(trends),
            "salaries_analyzed": bool(salaries),
            "duration": duration,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Analytics failed: {e}")
        raise