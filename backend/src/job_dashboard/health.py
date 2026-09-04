"""
Health check module for monitoring the job dashboard.
"""
from __future__ import annotations

import sqlite3
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from .logging import get_logger

logger = get_logger("job_dashboard.health")


class HealthCheck:
    """
    Health check system for monitoring application components.
    """
    
    def __init__(self, data_dir: Path):
        """
        Initialize health check system.
        
        Args:
            data_dir: Data directory for storing health check data
        """
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # Health check database
        self.health_db_path = self.data_dir / "health.sqlite3"
        self._init_health_db()
        
        # Monitoring thread
        self._monitoring = False
        self._monitor_thread: threading.Thread | None = None
        
        logger.info("Health check system initialized")
    
    def _init_health_db(self):
        """Initialize health check database."""
        with sqlite3.connect(self.health_db_path, check_same_thread=False) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS health_checks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    component TEXT NOT NULL,
                    status TEXT NOT NULL,
                    duration REAL,
                    details TEXT NOT NULL DEFAULT '{}'
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON health_checks(timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_component ON health_checks(component)")
            conn.commit()
    
    def record_check(self, component: str, status: str, duration: float, details: dict[str, Any]) -> None:
        """Record a health check result."""
        try:
            import json
            
            with sqlite3.connect(self.health_db_path, check_same_thread=False) as conn:
                conn.execute(
                    """
                    INSERT INTO health_checks (timestamp, component, status, duration, details)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        datetime.now().isoformat(),
                        component,
                        status,
                        duration,
                        json.dumps(details, ensure_ascii=False)
                    )
                )
                conn.commit()
                
        except Exception as e:
            logger.error(f"Failed to record health check: {e!s}")

    def _record_check(self, component: str, status: str, duration: float, details: dict[str, Any]) -> None:
        """Backward-compatible alias for internal health check callers."""
        self.record_check(component, status, duration, details)
    
    def get_recent_checks(self, hours: int = 24, component: str | None = None) -> list[dict[str, Any]]:
        """
        Get recent health checks.
        
        Args:
            hours: Number of hours to look back
            component: Optional component to filter by
        
        Returns:
            List of health check records
        """
        cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()
        
        try:
            import json
            
            with sqlite3.connect(self.health_db_path, check_same_thread=False) as conn:
                query = "SELECT * FROM health_checks WHERE timestamp > ?"
                params = [cutoff]
                
                if component:
                    query += " AND component = ?"
                    params.append(component)
                
                query += " ORDER BY timestamp DESC"
                
                cursor = conn.execute(query, params)
                results = []
                
                for row in cursor.fetchall():
                    results.append({
                        "timestamp": row[1],
                        "component": row[2],
                        "status": row[3],
                        "duration": row[4],
                        "details": json.loads(row[5]) if row[5] else {}
                    })
                
                return results
                
        except Exception as e:
            logger.error(f"Failed to get recent health checks: {e!s}")
            return []
    
    def start_monitoring(self, interval_seconds: int = 300):
        """
        Start periodic health monitoring.
        
        Args:
            interval_seconds: Interval between checks in seconds
        """
        if self._monitoring:
            logger.warning("Monitoring already started")
            return
        
        self._monitoring = True
        
        def monitor():
            while self._monitoring:
                try:
                    self.check_system()
                    logger.info(f"Performed health check, next in {interval_seconds}s")
                except Exception as e:
                    logger.error(f"Health check failed: {e!s}")
                
                time.sleep(interval_seconds)
        
        self._monitor_thread = threading.Thread(target=monitor, daemon=True)
        self._monitor_thread.start()
        
        logger.info(f"Started health monitoring with {interval_seconds}s interval")
    
    def stop_monitoring(self):
        """Stop health monitoring."""
        self._monitoring = False
        
        if self._monitor_thread:
            self._monitor_thread.join(timeout=5)
        
        logger.info("Stopped health monitoring")
    
    def __del__(self):
        """Cleanup."""
        self.stop_monitoring()


# Global health check instance
_health_instance: HealthCheck | None = None


def get_health_check(data_dir: Path | None = None) -> HealthCheck:
    """
    Get the global health check instance.
    
    Args:
        data_dir: Optional data directory
    
    Returns:
        HealthCheck instance
    """
    global _health_instance
    
    if _health_instance is None:
        if data_dir is None:
            from .config import settings
            data_dir = settings.data_dir
        
        _health_instance = HealthCheck(data_dir)
    
    return _health_instance