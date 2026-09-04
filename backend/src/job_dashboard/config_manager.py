"""
Simple configuration management without pydantic dependency.
"""
import os
from pathlib import Path
from typing import Any

from .logging import get_logger

logger = get_logger("job_dashboard.config")


class SimpleSettings:
    """Simple settings without external dependencies."""
    def __init__(self):
        # Load from .env file if present
        self._load_dotenv()
        
        # Environment
        self.env = os.getenv("JOB_DASHBOARD_ENV", "development")
        self.debug = os.getenv("JOB_DASHBOARD_DEBUG", "true").lower() in ("1", "true", "yes")
        
        # Paths
        self.data_dir = Path(os.getenv("JOB_DASHBOARD_DATA_DIR", Path.home() / ".job_dashboard"))
        self.log_dir = Path(os.getenv("JOB_DASHBOARD_LOG_DIR", self.data_dir / "logs"))
        
        # Database
        self.database_url = os.getenv("JOB_DASHBOARD_DATABASE_URL", "sqlite:///jobs.sqlite3")
        
        # Web server
        self.host = os.getenv("JOB_DASHBOARD_HOST", "127.0.0.1")
        self.port = int(os.getenv("JOB_DASHBOARD_PORT", "8787"))
        
        # Security
        self.jwt_secret_key = os.getenv("JOB_DASHBOARD_JWT_SECRET_KEY", "development-secret-key-change-in-production")
        self.access_token_expire_minutes = int(os.getenv("JOB_DASHBOARD_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
        
        # Cache
        self.redis_url = os.getenv("JOB_DASHBOARD_REDIS_URL")
        self.cache_ttl = int(os.getenv("JOB_DASHBOARD_CACHE_TTL", "3600"))
        
        # LLM
        self.openai_api_key = os.getenv("JOB_DASHBOARD_OPENAI_API_KEY")
        self.openai_model = os.getenv("JOB_DASHBOARD_OPENAI_MODEL", "gpt-3.5-turbo")
        
        # Job scraping
        self.enable_scraping = os.getenv("JOB_DASHBOARD_ENABLE_SCRAPING", "true").lower() in ("1", "true", "yes")
        self.rate_limit_delay = float(os.getenv("JOB_DASHBOARD_RATE_LIMIT_DELAY", "1.0"))
        
        # Feature flags
        self.enable_advanced_analytics = os.getenv("JOB_DASHBOARD_ENABLE_ADVANCED_ANALYTICS", "true").lower() in ("1", "true", "yes")
        self.enable_smart_recommendations = os.getenv("JOB_DASHBOARD_ENABLE_SMART_RECOMMENDATIONS", "true").lower() in ("1", "true", "yes")
        
        # Monitoring
        self.prometheus_enabled = os.getenv("JOB_DASHBOARD_PROMETHEUS_ENABLED", "false").lower() in ("1", "true", "yes")
        self.metrics_port = int(os.getenv("JOB_DASHBOARD_METRICS_PORT", "9091"))
        
        # Performance
        self.max_workers = int(os.getenv("JOB_DASHBOARD_MAX_WORKERS", "4"))
        
        # Create directories
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)
    
    def _load_dotenv(self):
        """Load .env file if present."""
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass
    
    def dict(self) -> dict[str, Any]:
        """Return settings as dictionary."""
        return {
            k: v for k, v in vars(self).items() 
            if not k.startswith('_') and not callable(v)
        }


class ConfigManager:
    """Manages configuration."""
    
    def __init__(self):
        self.settings = SimpleSettings()
        self._overrides: dict[str, Any] = {}
        logger.info(f"Configuration loaded for {self.settings.env} environment")
    
    def get(self, key: str, default=None):
        """Get a configuration value."""
        return getattr(self.settings, key, default)
    
    def set(self, key: str, value: Any):
        """Override a configuration value."""
        if hasattr(self.settings, key):
            setattr(self.settings, key, value)
            self._overrides[key] = value
            logger.info(f"Configuration override: {key}={value}")
    
    def is_production(self) -> bool:
        return self.settings.env.lower() == "production"
    
    def is_development(self) -> bool:
        return self.settings.env.lower() == "development"
    
    def get_all(self) -> dict[str, Any]:
        """Get all configuration values (excluding sensitive data)."""
        config_dict = self.settings.dict()
        
        # Mask sensitive values
        sensitive_keys = ["jwt_secret_key", "openai_api_key"]
        for key in sensitive_keys:
            if config_dict.get(key):
                config_dict[key] = "***MASKED***"
        
        return config_dict


# Global instance
_config = None


def get_config() -> ConfigManager:
    global _config
    if _config is None:
        _config = ConfigManager()
    return _config


def get_settings() -> SimpleSettings:
    return get_config().settings