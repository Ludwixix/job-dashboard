"""
Centralized configuration management for the job dashboard.
Simplified version that doesn't require pydantic-settings.
"""
import os
from pathlib import Path


class Settings:
    """Application settings loaded from environment variables."""
    
    def __init__(self):
        # Load from .env file if present
        self._load_dotenv()
        
        # Data directories
        self.data_dir = self._get_path("JOB_DASHBOARD_DATA_DIR", Path("data"))
        self.source_dir = self._get_path("JOB_DASHBOARD_SOURCE_DIR", Path("Source of truth"))
        self.guidelines_dir = self._get_path("JOB_DASHBOARD_GUIDELINES_DIR", Path("Guidelines"))
        self.examples_dir = self._get_optional_path("JOB_DASHBOARD_EXAMPLES_DIR")
        if self.examples_dir is None:
            self.examples_dir = self.data_dir / "Examples"
        
        # Server configuration
        self.host = os.getenv("JOB_DASHBOARD_HOST", "127.0.0.1")
        self.port = int(os.getenv("JOB_DASHBOARD_PORT", "8787"))
        
        # Job sources configuration
        self.seek_enabled = self._get_bool("JOB_DASHBOARD_SEEK_ENABLED", True)
        self.seek_api_endpoint = os.getenv("JOB_DASHBOARD_SEEK_API_ENDPOINT")
        self.seek_max_pages = int(os.getenv("JOB_DASHBOARD_SEEK_MAX_PAGES", "3"))
        self.seek_max_results = int(os.getenv("JOB_DASHBOARD_SEEK_MAX_RESULTS", "60"))
        self.seek_pause_seconds = float(os.getenv("JOB_DASHBOARD_SEEK_PAUSE_SECONDS", "1.5"))
        self.seek_browser_fallback = self._get_bool("JOB_DASHBOARD_SEEK_BROWSER_FALLBACK", True)
        self.seek_cache_fallback = self._get_bool("JOB_DASHBOARD_SEEK_CACHE_FALLBACK", True)
        self.seek_cache_path = self._get_optional_path("JOB_DASHBOARD_SEEK_CACHE_PATH")
        if self.seek_cache_path is None:
            project_root = Path(__file__).resolve().parents[2]
            self.seek_cache_path = project_root.parent / "job-dashboard-site" / "scrapers" / "jobs_seek.json"
        
        # LinkedIn configuration
        self.linkedin_enabled = self._get_bool("JOB_DASHBOARD_LINKEDIN_ENABLED", True)
        
        # LLM configuration
        self.llm_model = os.getenv("JOB_DASHBOARD_LLM_MODEL", "deepseek/deepseek-v4-flash-0731")
        self.openrouter_api_key = os.getenv("JOB_DASHBOARD_OPENROUTER_API_KEY")
        
        # Adzuna configuration
        self.adzuna_app_id = os.getenv("JOB_DASHBOARD_ADZUNA_APP_ID")
        self.adzuna_api_key = os.getenv("JOB_DASHBOARD_ADZUNA_API_KEY")
        
        # Gmail configuration
        self.gmail_username = os.getenv("JOB_DASHBOARD_GMAIL_USERNAME")
        self.gmail_app_password = os.getenv("JOB_DASHBOARD_GMAIL_APP_PASSWORD")
        
        # Application behavior
        self.sync_interval_seconds = int(os.getenv("JOB_DASHBOARD_SYNC_INTERVAL_SECONDS", "1800"))
        self.recent_job_days = int(os.getenv("JOB_DASHBOARD_RECENT_JOB_DAYS", "14"))

        # Persistent storage backup: Cloud Run's container filesystem is
        # ephemeral, so the local SQLite index is restored from this GCS
        # bucket on startup and backed up after each refresh, so scraped
        # jobs survive cold starts and redeploys instead of resetting to
        # whatever snapshot was baked into the container image.
        self.gcs_data_bucket = os.getenv("JOB_DASHBOARD_GCS_DATA_BUCKET")
    
    def _load_dotenv(self):
        """Load .env file if present."""
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass
    
    def _get_path(self, env_var: str, default: Path) -> Path:
        """Get a Path from environment variable or use default."""
        value = os.getenv(env_var)
        if value:
            return Path(value)
        return default
    
    def _get_optional_path(self, env_var: str) -> Path | None:
        """Get an optional Path from environment variable."""
        value = os.getenv(env_var)
        if value:
            return Path(value)
        return None
    
    def _get_bool(self, env_var: str, default: bool) -> bool:
        """Get a boolean from environment variable."""
        value = os.getenv(env_var)
        if value is None:
            return default
        value_lower = value.lower()
        return value_lower in ("1", "true", "yes", "on")


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get the global settings instance."""
    return settings