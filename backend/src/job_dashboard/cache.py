"""
Caching module for the job dashboard.
Provides caching for LLM responses, scoring results, and other expensive operations.
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .types import JobDict, ProfileDict


@dataclass
class CacheEntry:
    """A single cache entry."""
    key: str
    value: Any
    created_at: float
    expires_at: float | None
    hit_count: int = 1
    last_accessed: float = time.time()
    metadata: dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class CacheManager:
    """
    Manages caching for various operations in the job dashboard.
    Supports both in-memory LRU cache and persistent SQLite cache.
    """
    
    def __init__(self, data_dir: Path, memory_cache_size: int = 1024):
        """
        Initialize the cache manager.
        
        Args:
            data_dir: Directory for persistent cache storage
            memory_cache_size: Maximum number of items in memory cache
        """
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # Persistent SQLite cache
        self.cache_db_path = self.data_dir / "cache.sqlite3"
        self._init_cache_db()
        
        # In-memory LRU caches
        self.llm_cache = self._create_lru_cache(memory_cache_size)
        self.scoring_cache = self._create_lru_cache(memory_cache_size)
        self.profile_cache = self._create_lru_cache(memory_cache_size)
    
    def _init_cache_db(self):
        """Initialize the SQLite cache database."""
        conn = sqlite3.connect(self.cache_db_path, check_same_thread=False)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS cache_entries (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                created_at REAL NOT NULL,
                expires_at REAL,
                hit_count INTEGER NOT NULL DEFAULT 1,
                last_accessed REAL NOT NULL,
                metadata TEXT NOT NULL DEFAULT '{}'
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_expires_at ON cache_entries(expires_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_last_accessed ON cache_entries(last_accessed)")
        conn.commit()
        conn.close()
    
    def _create_lru_cache(self, maxsize: int):
        """Create an LRU cache with the given maxsize."""
        return {}
    
    def _generate_cache_key(self, prefix: str, *args, **kwargs) -> str:
        """
        Generate a cache key from arguments.
        
        Args:
            prefix: Cache namespace prefix
            *args: Positional arguments to include in key
            **kwargs: Keyword arguments to include in key
        
        Returns:
            Cache key string
        """
        key_parts = [prefix]
        
        # Add positional arguments
        for arg in args:
            if isinstance(arg, (str, int, float, bool)):
                key_parts.append(str(arg))
            elif isinstance(arg, (dict, list)):
                key_parts.append(json.dumps(arg, sort_keys=True))
            else:
                key_parts.append(repr(arg))
        
        # Add keyword arguments
        if kwargs:
            sorted_kwargs = sorted(kwargs.items())
            for key, value in sorted_kwargs:
                if isinstance(value, (str, int, float, bool)):
                    key_parts.append(f"{key}={value}")
                elif isinstance(value, (dict, list)):
                    key_parts.append(f"{key}={json.dumps(value, sort_keys=True)}")
                else:
                    key_parts.append(f"{key}={value!r}")
        
        key_str = ":".join(key_parts)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def cache_llm_response(self, prompt: str, model: str, response: str, ttl_seconds: int = 3600) -> str:
        """
        Cache an LLM response.
        
        Args:
            prompt: The prompt sent to LLM
            model: The model used
            response: The LLM response
            ttl_seconds: Time to live in seconds
        
        Returns:
            Cache key
        """
        key = self._generate_cache_key("llm", prompt, model)
        expires_at = time.time() + ttl_seconds if ttl_seconds > 0 else None
        
        # Store in memory cache
        self.llm_cache[key] = response
        
        # Store in persistent cache
        self._store_in_db(key, response, expires_at, {"prompt_hash": hashlib.md5(prompt.encode()).hexdigest()[:16]})
        
        return key
    
    def get_llm_response(self, prompt: str, model: str) -> str | None:
        """
        Get a cached LLM response.
        
        Args:
            prompt: The prompt sent to LLM
            model: The model used
        
        Returns:
            Cached response or None
        """
        key = self._generate_cache_key("llm", prompt, model)
        
        # Try memory cache first
        if key in self.llm_cache:
            return self.llm_cache[key]
        
        # Try persistent cache
        cached = self._get_from_db(key)
        if cached is not None:
            # Also populate memory cache
            self.llm_cache[key] = cached
            return cached
        
        return None
    
    def cache_scoring_result(self, job: JobDict, profile: ProfileDict, result: dict[str, Any], ttl_seconds: int = 86400) -> str:
        """
        Cache a job scoring result.
        
        Args:
            job: Job dictionary
            profile: Profile dictionary
            result: Scoring result
            ttl_seconds: Time to live in seconds
        
        Returns:
            Cache key
        """
        # Create a simplified representation for caching
        job_repr = {k: v for k, v in job.items() if k in ["title", "company", "description", "skills"]}
        profile_repr = {k: v for k, v in profile.items() if k in ["skills", "technical_expertise"]}
        
        key = self._generate_cache_key("score", job_repr, profile_repr)
        expires_at = time.time() + ttl_seconds if ttl_seconds > 0 else None
        
        # Store in memory cache
        self.scoring_cache[key] = result
        
        # Store in persistent cache
        self._store_in_db(key, result, expires_at, {
            "job_title": job.get("title", ""),
            "job_company": job.get("company", ""),
            "profile_hash": hashlib.md5(json.dumps(profile, sort_keys=True).encode()).hexdigest()[:16]
        })
        
        return key
    
    def get_scoring_result(self, job: JobDict, profile: ProfileDict) -> dict[str, Any] | None:
        """
        Get a cached scoring result.
        
        Args:
            job: Job dictionary
            profile: Profile dictionary
        
        Returns:
            Cached scoring result or None
        """
        # Create a simplified representation for caching
        job_repr = {k: v for k, v in job.items() if k in ["title", "company", "description", "skills"]}
        profile_repr = {k: v for k, v in profile.items() if k in ["skills", "technical_expertise"]}
        
        key = self._generate_cache_key("score", job_repr, profile_repr)
        
        # Try memory cache first
        if key in self.scoring_cache:
            return self.scoring_cache[key]
        
        # Try persistent cache
        cached = self._get_from_db(key)
        if cached is not None:
            # Also populate memory cache
            self.scoring_cache[key] = cached
            return cached
        
        return None
    
    def cache_profile_data(self, profile: ProfileDict, data: Any, ttl_seconds: int = 86400) -> str:
        """
        Cache profile-related data.
        
        Args:
            profile: Profile dictionary
            data: Data to cache
            ttl_seconds: Time to live in seconds
        
        Returns:
            Cache key
        """
        profile_hash = hashlib.md5(json.dumps(profile, sort_keys=True).encode()).hexdigest()[:16]
        key = self._generate_cache_key("profile", profile_hash)
        expires_at = time.time() + ttl_seconds if ttl_seconds > 0 else None
        
        # Store in memory cache
        self.profile_cache[key] = data
        
        # Store in persistent cache
        self._store_in_db(key, data, expires_at, {"profile_hash": profile_hash})
        
        return key
    
    def get_profile_data(self, profile: ProfileDict) -> Any | None:
        """
        Get cached profile data.
        
        Args:
            profile: Profile dictionary
        
        Returns:
            Cached data or None
        """
        profile_hash = hashlib.md5(json.dumps(profile, sort_keys=True).encode()).hexdigest()[:16]
        key = self._generate_cache_key("profile", profile_hash)
        
        # Try memory cache first
        if key in self.profile_cache:
            return self.profile_cache[key]
        
        # Try persistent cache
        cached = self._get_from_db(key)
        if cached is not None:
            # Also populate memory cache
            self.profile_cache[key] = cached
            return cached
        
        return None
    
    def _store_in_db(self, key: str, value: Any, expires_at: float | None, metadata: dict[str, Any]):
        """Store a value in the SQLite cache."""
        try:
            conn = sqlite3.connect(self.cache_db_path, check_same_thread=False)
            conn.execute(
                """
                INSERT OR REPLACE INTO cache_entries 
                (key, value, created_at, expires_at, hit_count, last_accessed, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    key,
                    json.dumps(value, ensure_ascii=False),
                    time.time(),
                    expires_at,
                    1,
                    time.time(),
                    json.dumps(metadata, ensure_ascii=False)
                )
            )
            conn.commit()
            conn.close()
        except Exception:
            # Silently fail on cache storage errors
            pass
    
    def _get_from_db(self, key: str) -> Any | None:
        """Get a value from the SQLite cache."""
        try:
            conn = sqlite3.connect(self.cache_db_path, check_same_thread=False)
            cursor = conn.execute(
                """
                SELECT value, expires_at FROM cache_entries 
                WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)
                """,
                (key, time.time())
            )
            row = cursor.fetchone()
            conn.close()
            
            if row is not None:
                # Update hit count and last accessed
                self._update_cache_stats(key)
                return json.loads(row[0])
            
            return None
        except Exception:
            return None
    
    def _update_cache_stats(self, key: str):
        """Update cache statistics for a key."""
        try:
            conn = sqlite3.connect(self.cache_db_path, check_same_thread=False)
            conn.execute(
                """
                UPDATE cache_entries 
                SET hit_count = hit_count + 1, last_accessed = ?
                WHERE key = ?
                """,
                (time.time(), key)
            )
            conn.commit()
            conn.close()
        except Exception:
            pass
    
    def cleanup(self, max_age_days: int = 30):
        """
        Clean up expired cache entries.
        
        Args:
            max_age_days: Maximum age of cache entries to keep (days)
        """
        try:
            cutoff_time = time.time() - (max_age_days * 86400)
            
            conn = sqlite3.connect(self.cache_db_path, check_same_thread=False)
            # Delete expired entries
            conn.execute("DELETE FROM cache_entries WHERE expires_at IS NOT NULL AND expires_at < ?", (time.time(),))
            # Delete old entries (even if not expired)
            conn.execute("DELETE FROM cache_entries WHERE last_accessed < ?", (cutoff_time,))
            conn.commit()
            conn.close()
            
            # Clear memory caches
            self.llm_cache.clear()
            self.scoring_cache.clear()
            self.profile_cache.clear()
            
        except Exception:
            pass
    
    def get_stats(self) -> dict[str, Any]:
        """Get cache statistics."""
        try:
            conn = sqlite3.connect(self.cache_db_path, check_same_thread=False)
            
            # Total entries
            total = conn.execute("SELECT COUNT(*) FROM cache_entries").fetchone()[0]
            
            # Active entries (not expired)
            active = conn.execute(
                "SELECT COUNT(*) FROM cache_entries WHERE expires_at IS NULL OR expires_at > ?",
                (time.time(),)
            ).fetchone()[0]
            
            # Average hit count
            avg_hits = conn.execute("SELECT AVG(hit_count) FROM cache_entries").fetchone()[0] or 0
            
            # Size of cache
            size_bytes = conn.execute("SELECT SUM(LENGTH(value)) FROM cache_entries").fetchone()[0] or 0
            
            conn.close()
            
            return {
                "total_entries": total,
                "active_entries": active,
                "average_hits": round(avg_hits, 2),
                "size_bytes": size_bytes,
                "size_mb": round(size_bytes / (1024 * 1024), 2),
                "memory_cache_sizes": {
                    "llm": len(self.llm_cache),
                    "scoring": len(self.scoring_cache),
                    "profile": len(self.profile_cache)
                }
            }
            
        except Exception:
            return {"error": "Failed to get cache statistics"}


# Global cache instance
_cache_instance: CacheManager | None = None


def get_cache(data_dir: Path | None = None) -> CacheManager:
    """
    Get the global cache instance.
    
    Args:
        data_dir: Optional data directory for cache storage
    
    Returns:
        CacheManager instance
    """
    global _cache_instance
    
    if _cache_instance is None:
        if data_dir is None:
            from .config import settings
            data_dir = settings.data_dir
        
        _cache_instance = CacheManager(data_dir)
    
    return _cache_instance