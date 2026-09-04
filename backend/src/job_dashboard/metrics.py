"""
Basic metrics module for production monitoring.
"""
from __future__ import annotations

try:
    from prometheus_client import Counter, Gauge, Histogram, generate_latest
    from prometheus_client.registry import CollectorRegistry
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    print("Note: Prometheus client not installed. Metrics will be limited.")

from .logging import get_logger

logger = get_logger("job_dashboard.metrics")


class JobDashboardMetrics:
    """Simple metrics collector."""
    
    def __init__(self):
        if PROMETHEUS_AVAILABLE:
            self.registry = CollectorRegistry()
            
            # HTTP metrics
            self.requests = Counter(
                'http_requests_total',
                'Total HTTP requests',
                ['method', 'endpoint', 'status'],
                registry=self.registry
            )
            
            self.request_duration = Histogram(
                'http_request_duration_seconds',
                'Request duration',
                ['method', 'endpoint'],
                registry=self.registry
            )
            
            # Job metrics
            self.jobs_total = Counter(
                'jobs_processed_total',
                'Total jobs processed',
                ['source'],
                registry=self.registry
            )
            
            # Cache metrics
            self.cache_hits = Counter('cache_hits_total', 'Cache hits', registry=self.registry)
            self.cache_misses = Counter('cache_misses_total', 'Cache misses', registry=self.registry)
        else:
            # Simple fallback
            self.requests_count = 0
            self.jobs_count = 0
            self.cache_hits_count = 0
            self.cache_misses_count = 0
        
        logger.info("Metrics initialized")
    
    def track_request(self, method: str, endpoint: str, status: str, duration: float):
        if PROMETHEUS_AVAILABLE:
            self.requests.labels(method, endpoint, status).inc()
            self.request_duration.labels(method, endpoint).observe(duration)
        else:
            self.requests_count += 1
    
    def track_job(self, source: str):
        if PROMETHEUS_AVAILABLE:
            self.jobs_total.labels(source).inc()
        else:
            self.jobs_count += 1
    
    def track_cache(self, hit: bool):
        if PROMETHEUS_AVAILABLE:
            if hit:
                self.cache_hits.inc()
            else:
                self.cache_misses.inc()
        else:
            if hit:
                self.cache_hits_count += 1
            else:
                self.cache_misses_count += 1
    
    def get_metrics(self):
        if PROMETHEUS_AVAILABLE:
            return generate_latest(self.registry).decode('utf-8')
        else:
            return f"""# Simple metrics (Prometheus not available)
requests_total {self.requests_count}
jobs_total {self.jobs_count}
cache_hits_total {self.cache_hits_count}
cache_misses_total {self.cache_misses_count}
"""


# Global instance
_metrics = None


def get_metrics() -> JobDashboardMetrics:
    global _metrics
    if _metrics is None:
        _metrics = JobDashboardMetrics()
    return _metrics