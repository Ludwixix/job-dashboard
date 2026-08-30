"""
Retry module with exponential backoff for external API calls.
"""
from __future__ import annotations

import logging
import random
import time
from collections.abc import Callable
from dataclasses import dataclass
from functools import wraps
from typing import TypeVar

T = TypeVar("T")


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_retries: int = 3
    base_delay: float = 1.0  # seconds
    max_delay: float = 30.0  # seconds
    jitter: bool = True
    retry_on_exceptions: tuple[type[Exception], ...] = (Exception,)
    backoff_factor: float = 2.0


class RetryManager:
    """
    Manages retry logic with exponential backoff for external API calls.
    """
    
    def __init__(self, config: RetryConfig | None = None):
        """
        Initialize the retry manager.
        
        Args:
            config: Optional retry configuration
        """
        self.config = config or RetryConfig()
        self.logger = logging.getLogger(__name__)
    
    def execute_with_retry(self, func: Callable[..., T], *args, **kwargs) -> T:
        """
        Execute a function with retry logic.
        
        Args:
            func: Function to execute
            *args: Positional arguments for the function
            **kwargs: Keyword arguments for the function
        
        Returns:
            Result of the function
        
        Raises:
            Exception: If all retries fail
        """
        last_exception: Exception | None = None
        
        for attempt in range(self.config.max_retries + 1):
            try:
                if attempt > 0:
                    self.logger.info(f"Retry attempt {attempt}/{self.config.max_retries} for {func.__name__}")
                
                return func(*args, **kwargs)
                
            except self.config.retry_on_exceptions as e:
                last_exception = e
                
                # Check if we should retry
                if attempt == self.config.max_retries:
                    self.logger.error(f"All retries exhausted for {func.__name__}: {e!s}")
                    raise
                
                # Calculate delay with exponential backoff
                delay = self._calculate_delay(attempt)
                
                self.logger.warning(
                    f"Attempt {attempt + 1} failed for {func.__name__}: {e!s}. "
                    f"Retrying in {delay:.2f} seconds..."
                )
                
                time.sleep(delay)
        
        # This should never be reached, but just in case
        raise last_exception or Exception("Retry failed without exception")
    
    def _calculate_delay(self, attempt: int) -> float:
        """
        Calculate delay with exponential backoff and optional jitter.
        
        Args:
            attempt: Current attempt number (0-based)
        
        Returns:
            Delay in seconds
        """
        delay = min(
            self.config.base_delay * (self.config.backoff_factor ** attempt),
            self.config.max_delay
        )
        
        if self.config.jitter:
            # Add random jitter (±25%)
            jitter = random.uniform(-0.25, 0.25)
            delay = delay * (1 + jitter)
        
        return delay
    
    def create_decorator(self, config: RetryConfig | None = None):
        """
        Create a decorator for retry logic.
        
        Args:
            config: Optional retry configuration for this decorator
        
        Returns:
            Decorator function
        """
        retry_config = config or self.config
        
        def decorator(func: Callable[..., T]) -> Callable[..., T]:
            @wraps(func)
            def wrapper(*args, **kwargs) -> T:
                return self.execute_with_retry(func, *args, **kwargs)
            return wrapper
        
        return decorator


# Default retry configurations
DEFAULT_RETRY_CONFIG = RetryConfig(
    max_retries=3,
    base_delay=1.0,
    max_delay=30.0,
    jitter=True,
    retry_on_exceptions=(Exception,),
    backoff_factor=2.0
)

HTTP_RETRY_CONFIG = RetryConfig(
    max_retries=3,
    base_delay=2.0,
    max_delay=60.0,
    jitter=True,
    retry_on_exceptions=(ConnectionError, TimeoutError, IOError),
    backoff_factor=2.0
)

API_RETRY_CONFIG = RetryConfig(
    max_retries=5,
    base_delay=1.0,
    max_delay=120.0,
    jitter=True,
    retry_on_exceptions=(Exception,),
    backoff_factor=1.5
)


# Global retry manager instance
_retry_instance: RetryManager | None = None


def get_retry_manager(config: RetryConfig | None = None) -> RetryManager:
    """
    Get the global retry manager instance.
    
    Args:
        config: Optional retry configuration
    
    Returns:
        RetryManager instance
    """
    global _retry_instance
    
    if _retry_instance is None:
        _retry_instance = RetryManager(config)
    
    return _retry_instance


def retry(config: RetryConfig | None = None):
    """
    Decorator for retry logic.
    
    Args:
        config: Optional retry configuration
    
    Returns:
        Decorator function
    """
    return get_retry_manager(config).create_decorator(config)


# Example usage:
# @retry(HTTP_RETRY_CONFIG)
# def make_http_request(url: str) -> str:
#     response = requests.get(url)
#     response.raise_for_status()
#     return response.text