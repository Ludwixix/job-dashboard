"""Default search query configuration.

DEFAULT_QUERIES is used only as a last-resort fallback when
``search_queries.json`` does not yet exist on disk (i.e. the very first
server boot before a profile has been onboarded).

In normal operation the profile-onboarding pipeline
(``frontend/src/services/profileOnboardingPipeline.js``) pushes
profile-derived, industry-aware queries to ``POST /api/search-criteria``
on every profile save, which persists them to ``search_queries.json``.
Those persisted queries take full precedence over this fallback.

Keeping this empty means a fresh install never accidentally scrapes
IT-only results on behalf of a nurse, lawyer, or any other profession
before the user has completed onboarding.
"""

from .sources import SearchQuery

DEFAULT_QUERIES: tuple[SearchQuery, ...] = ()
