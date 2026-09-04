"""
Type definitions and error hierarchy for the job dashboard.

This module provides strict type definitions to replace the use of `Mapping[str, Any]`
and standardizes error handling across the application.
"""
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, NotRequired, TypedDict

# ============================================================================
# Type Definitions
# ============================================================================

class JobDict(TypedDict, total=False):
    """Strictly typed dictionary for job data from external sources."""
    id: NotRequired[str]
    job_id: NotRequired[str]
    title: str
    company: str
    location: NotRequired[str]
    description: NotRequired[str]
    why: NotRequired[str]
    tags: NotRequired[list[str]]
    remote: NotRequired[bool]
    source: NotRequired[str]
    url: NotRequired[str]
    application_url: NotRequired[str]
    subcategory: NotRequired[str]
    posted: NotRequired[str]
    date_posted: NotRequired[str]
    salary: NotRequired[str]
    salary_min: NotRequired[float]
    salary_max: NotRequired[float]
    salary_currency: NotRequired[str]
    employment_type: NotRequired[str]


class ProfileDict(TypedDict, total=False):
    """Strictly typed dictionary for user profile data."""
    skills: dict[str, str] | list[str]
    technical_expertise: NotRequired[dict[str, list[str]]]
    experience: NotRequired[list[dict[str, Any]]]
    education: NotRequired[list[dict[str, Any]]]
    certifications: NotRequired[list[str]]
    personal: NotRequired[dict[str, Any]]
    preferences: NotRequired[dict[str, Any]]


class ScoreDict(TypedDict, total=False):
    """Dictionary representation of ScoreResult."""
    score: int
    fit: str
    dimensions: dict[str, int]
    matched_skills: list[str]
    missing_skills: list[str]
    strengths: list[str]
    risks: list[str]
    confidence: float
    experience_level: str
    relevance: str
    score_breakdown: dict[str, int]


class AnalysisDict(TypedDict):
    """Dictionary representation of JobAnalysis."""
    job: JobDict
    stream: str
    score: ScoreDict
    fit_category: str


class SearchQueryDict(TypedDict, total=False):
    """Dictionary representation of SearchQuery."""
    term: str
    location: NotRequired[str]
    stream: NotRequired[str]
    group: NotRequired[str]
    weight: NotRequired[float]
    exclude_terms: NotRequired[list[str]]
    enabled: NotRequired[bool]


class ApplicationRecordDict(TypedDict, total=False):
    """Dictionary representation of ApplicationRecord."""
    application_id: str
    company: str
    title: str
    location: NotRequired[str]
    application_url: NotRequired[str]
    resume: NotRequired[str]
    cover: NotRequired[str]
    why: NotRequired[str]
    audit: NotRequired[dict[str, Any]]


# ============================================================================
# Enums
# ============================================================================

class StreamEnum(str, Enum):
    """Employment streams."""
    CORE_IT = "core-it"
    BRIDGE = "bridge"
    TRAINEESHIP = "traineeship"


class ExperienceLevelEnum(str, Enum):
    """Experience levels."""
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    EXECUTIVE = "executive"


class FitCategoryEnum(str, Enum):
    """Job fit categories."""
    NO_SKILL_MATCH = "no-skill-match"
    EXCELLENT_FIT = "excellent-fit"
    STRONG_FIT = "strong-fit"
    GOOD_FIT = "good-fit"
    PARTIAL_FIT = "partial-fit"
    WEAK_FIT = "weak-fit"


class JobStatusEnum(str, Enum):
    """Job application status."""
    NEW = "new"
    APPLIED = "applied"
    INTERVIEWING = "interviewing"
    REJECTED = "rejected"
    OFFERED = "offered"
    ACCEPTED = "accepted"
    ARCHIVED = "archived"


# ============================================================================
# Error Hierarchy
# ============================================================================

class JobDashboardError(Exception):
    """Base exception for all job dashboard errors."""
    
    def __init__(self, message: str, details: dict[str, Any] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}
        self.timestamp = datetime.now().isoformat()
    
    def to_dict(self) -> dict[str, Any]:
        """Convert exception to dictionary for API responses."""
        return {
            "error": self.__class__.__name__,
            "message": self.message,
            "details": self.details,
            "timestamp": self.timestamp
        }


class ConfigurationError(JobDashboardError):
    """Configuration-related errors."""


class ValidationError(JobDashboardError):
    """Data validation errors."""


class SourceError(JobDashboardError):
    """Job source/scraping errors."""


class ScoringError(JobDashboardError):
    """Job scoring errors."""


class ClassificationError(JobDashboardError):
    """Job classification errors."""


class NormalizationError(JobDashboardError):
    """Job data normalization errors."""


class DocumentGenerationError(JobDashboardError):
    """Document generation errors."""


class RepositoryError(JobDashboardError):
    """Data repository errors."""


class APIConnectionError(JobDashboardError):
    """External API connection errors."""


class AuthenticationError(JobDashboardError):
    """Authentication/authorization errors."""


# ============================================================================
# Validation Models
# ============================================================================

@dataclass
class ValidationResult:
    """Result of data validation."""
    is_valid: bool
    errors: list[str] = None
    warnings: list[str] = None
    
    def __post_init__(self):
        if self.errors is None:
            self.errors = []
        if self.warnings is None:
            self.warnings = []
    
    def add_error(self, error: str):
        """Add a validation error."""
        self.errors.append(error)
        self.is_valid = False
    
    def add_warning(self, warning: str):
        """Add a validation warning."""
        self.warnings.append(warning)
    
    def merge(self, other: 'ValidationResult') -> 'ValidationResult':
        """Merge another validation result into this one."""
        self.is_valid = self.is_valid and other.is_valid
        self.errors.extend(other.errors)
        self.warnings.extend(other.warnings)
        return self
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "is_valid": self.is_valid,
            "errors": self.errors,
            "warnings": self.warnings
        }


# ============================================================================
# Helper Functions
# ============================================================================

def validate_job_data(job_data: dict[str, Any]) -> ValidationResult:
    """Validate job data structure and content."""
    result = ValidationResult(is_valid=True)
    
    # Required fields
    required_fields = ["title", "company"]
    for field in required_fields:
        if field not in job_data:
            result.add_error(f"Missing required field: {field}")
        elif not isinstance(job_data[field], str) or not job_data[field].strip():
            result.add_error(f"Invalid value for field: {field}")
    
    # Optional field validation
    if "location" in job_data and not isinstance(job_data["location"], str):
        result.add_warning("Location should be a string")
    
    if "description" in job_data and not isinstance(job_data["description"], str):
        result.add_warning("Description should be a string")
    
    if "tags" in job_data:
        if not isinstance(job_data["tags"], (list, tuple)):
            result.add_warning("Tags should be a list or tuple")
        elif job_data["tags"] and not all(isinstance(tag, str) for tag in job_data["tags"]):
            result.add_warning("All tags should be strings")
    
    if "remote" in job_data and not isinstance(job_data["remote"], bool):
        result.add_warning("Remote should be a boolean")
    
    return result


def validate_profile_data(profile_data: dict[str, Any]) -> ValidationResult:
    """Validate profile data structure and content."""
    result = ValidationResult(is_valid=True)
    
    # Skills validation
    if "skills" not in profile_data:
        result.add_error("Missing required field: skills")
    else:
        skills = profile_data["skills"]
        if isinstance(skills, dict):
            for skill, level in skills.items():
                if not isinstance(skill, str):
                    result.add_warning(f"Skill name should be string: {skill}")
                if not isinstance(level, str):
                    result.add_warning(f"Skill level should be string: {level}")
        elif isinstance(skills, list):
            if not all(isinstance(skill, str) for skill in skills):
                result.add_warning("All skills should be strings when provided as a list")
        else:
            result.add_error("Skills must be either a dictionary or list")
    
    # Technical expertise validation (optional)
    if "technical_expertise" in profile_data:
        expertise = profile_data["technical_expertise"]
        if not isinstance(expertise, dict):
            result.add_warning("Technical expertise should be a dictionary")
        else:
            for category, skills in expertise.items():
                if not isinstance(category, str):
                    result.add_warning(f"Expertise category should be string: {category}")
                if not isinstance(skills, list):
                    result.add_warning(f"Expertise skills should be list for category: {category}")
                elif not all(isinstance(skill, str) for skill in skills):
                    result.add_warning(f"All expertise skills should be strings for category: {category}")
    
    return result