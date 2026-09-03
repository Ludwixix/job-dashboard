from __future__ import annotations

from abc import ABC, abstractmethod

from models import StandardJob


class ProviderUnavailable(RuntimeError):
    """Base exception for provider availability or execution issues."""


class TierBlockedException(ProviderUnavailable):
    """Raised when a scraper encounters HTTP 403, Cloudflare, CAPTCHA, or bot challenge."""


class TierRateLimitedException(ProviderUnavailable):
    """Raised when a scraper receives HTTP 429 or hits request rate limits."""


class QuotaExhaustedException(ProviderUnavailable):
    """Raised when an external API service returns HTTP 402 or runs out of credits."""


class JobProviderBase(ABC):
    """Abstract Base Class for tiered job scrapers."""
    name: str

    @abstractmethod
    async def search(self, query: str, location: str, limit: int = 25) -> list[StandardJob]:
        """Execute a job search and return a list of standardized job postings."""
        raise NotImplementedError

    async def close(self) -> None:
        """Cleanup any open network sessions, browser instances, or clients."""
        return

