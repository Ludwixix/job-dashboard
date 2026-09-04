import json
from dataclasses import asdict, dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path


def split_documents(content: str) -> tuple[str, str, str]:
    """Split generated output into resume, cover letter, and embedded description."""
    marker = "===COVER_LETTER==="
    resume, separator, cover = content.partition(marker)
    if not separator:
        return content.strip(), "", ""
    description_marker = "===JOB_DESCRIPTION==="
    cover, description_separator, description = cover.partition(description_marker)
    return resume.strip(), cover.strip(), description.strip() if description_separator else ""


class ApplicationStatus(Enum):
    """Application status enum."""
    NEW = "new"
    REVIEW = "review"
    READY = "ready"
    APPLIED = "applied"
    INTERVIEW = "interview"
    OFFER = "offer"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class ApplicationType(Enum):
    """Application type enum."""
    DIRECT = "direct"
    LINKEDIN = "linkedin"
    INDEED = "indeed"
    SEEK = "seek"
    COMPANY_PORTAL = "company_portal"
    REFERRAL = "referral"
    OTHER = "other"


@dataclass
class SmartApplication:
    """Smart application tracking with AI-powered features."""
    application_id: str
    job_id: str
    job_title: str
    company: str
    status: ApplicationStatus
    application_type: ApplicationType
    created_at: datetime
    updated_at: datetime
    applied_at: datetime | None = None
    follow_up_date: datetime | None = None
    interview_date: datetime | None = None
    offer_date: datetime | None = None
    rejection_date: datetime | None = None
    notes: str = ""
    match_score: float = 0.0
    ai_analysis: dict | None = None
    generated_resume_path: str | None = None
    generated_cover_path: str | None = None
    application_url: str | None = None
    contact_email: str | None = None
    contact_name: str | None = None
    priority: int = 0  # 0=normal, 1=high, 2=urgent
    tags: list[str] = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        if isinstance(self.created_at, str):
            self.created_at = datetime.fromisoformat(self.created_at)
        if isinstance(self.updated_at, str):
            self.updated_at = datetime.fromisoformat(self.updated_at)
        if self.applied_at and isinstance(self.applied_at, str):
            self.applied_at = datetime.fromisoformat(self.applied_at)
        if self.follow_up_date and isinstance(self.follow_up_date, str):
            self.follow_up_date = datetime.fromisoformat(self.follow_up_date)
        if self.interview_date and isinstance(self.interview_date, str):
            self.interview_date = datetime.fromisoformat(self.interview_date)
        if self.offer_date and isinstance(self.offer_date, str):
            self.offer_date = datetime.fromisoformat(self.offer_date)
        if self.rejection_date and isinstance(self.rejection_date, str):
            self.rejection_date = datetime.fromisoformat(self.rejection_date)
        if isinstance(self.status, str):
            self.status = ApplicationStatus(self.status)
        if isinstance(self.application_type, str):
            self.application_type = ApplicationType(self.application_type)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        result = asdict(self)
        result["status"] = self.status.value
        result["application_type"] = self.application_type.value
        result["created_at"] = self.created_at.isoformat()
        result["updated_at"] = self.updated_at.isoformat()
        if self.applied_at:
            result["applied_at"] = self.applied_at.isoformat()
        if self.follow_up_date:
            result["follow_up_date"] = self.follow_up_date.isoformat()
        if self.interview_date:
            result["interview_date"] = self.interview_date.isoformat()
        if self.offer_date:
            result["offer_date"] = self.offer_date.isoformat()
        if self.rejection_date:
            result["rejection_date"] = self.rejection_date.isoformat()
        return result
    
    @classmethod
    def from_dict(cls, data: dict) -> "SmartApplication":
        """Create from dictionary."""
        return cls(**data)


class ApplicationTracker:
    """Advanced application tracking system with AI integration."""
    
    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir)
        self.applications_file = self.data_dir / "smart_applications.json"
        self.applications: dict[str, SmartApplication] = {}
        self._load_applications()
    
    def _load_applications(self) -> None:
        """Load applications from JSON file."""
        if not self.applications_file.exists():
            self.applications = {}
            return
        
        try:
            with open(self.applications_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.applications = {
                    app_id: SmartApplication.from_dict(app_data)
                    for app_id, app_data in data.get("applications", {}).items()
                }
        except (OSError, json.JSONDecodeError) as e:
            print(f"Error loading applications: {e}")
            self.applications = {}
    
    def _save_applications(self) -> None:
        """Save applications to JSON file."""
        try:
            data = {
                "applications": {
                    app_id: app.to_dict()
                    for app_id, app in self.applications.items()
                }
            }
            with open(self.applications_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except OSError as e:
            print(f"Error saving applications: {e}")
    
    def add_application(self, job_id: str, job_title: str, company: str, 
                       application_type: ApplicationType = ApplicationType.DIRECT,
                       match_score: float = 0.0,
                       application_url: str | None = None) -> SmartApplication:
        """Add a new application to track."""
        from uuid import uuid4
        application_id = str(uuid4())
        
        application = SmartApplication(
            application_id=application_id,
            job_id=job_id,
            job_title=job_title,
            company=company,
            status=ApplicationStatus.NEW,
            application_type=application_type,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            match_score=match_score,
            application_url=application_url,
            priority=1 if match_score >= 80 else 0  # High priority for good matches
        )
        
        self.applications[application_id] = application
        self._save_applications()
        return application
    
    def update_status(self, application_id: str, new_status: ApplicationStatus, 
                     notes: str | None = None) -> SmartApplication | None:
        """Update application status with automatic date tracking."""
        if application_id not in self.applications:
            return None
        
        app = self.applications[application_id]
        app.status = new_status
        app.updated_at = datetime.now()
        
        # Auto-set dates based on status
        if new_status == ApplicationStatus.APPLIED and not app.applied_at:
            app.applied_at = datetime.now()
        elif new_status == ApplicationStatus.INTERVIEW and not app.interview_date:
            app.interview_date = datetime.now()
        elif new_status == ApplicationStatus.OFFER and not app.offer_date:
            app.offer_date = datetime.now()
        elif new_status == ApplicationStatus.REJECTED and not app.rejection_date:
            app.rejection_date = datetime.now()
        
        if notes:
            app.notes = notes
        
        self._save_applications()
        return app
