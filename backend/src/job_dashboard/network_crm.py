"""Recruiter and Talent Network CRM Manager."""

import json
import sqlite3
import uuid
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from .db_pool import get_db_connection
from .logging import get_logger

logger = get_logger("job_dashboard.network_crm")

VALID_CONTACT_TYPES = {
    "agency_recruiter",
    "internal_talent",
    "hiring_manager",
    "peer_referral",
    "executive_search",
}

VALID_SECTORS = {
    "technology",
    "healthcare",
    "finance",
    "trades",
    "legal",
    "general",
}

VALID_HEALTH = {"active", "warm", "dormant"}


@dataclass
class NetworkContact:
    id: str = field(default_factory=lambda: f"rec-{uuid.uuid4().hex[:10]}")
    user_id: str = "default_user"
    name: str = ""
    role: str = ""
    organization: str = ""
    contact_type: str = "agency_recruiter"
    sector: str = "technology"
    email: str = ""
    phone: str = ""
    linkedin_url: str = ""
    notes: str = ""
    relationship_health: str = "warm"
    cadence_frequency_days: int = 14
    last_interaction_date: Optional[str] = None
    next_follow_up_date: Optional[str] = None
    associated_job_ids: List[str] = field(default_factory=list)
    interactions: List[Dict[str, Any]] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "NetworkContact":
        copied = dict(data)
        # Ensure list fields
        if isinstance(copied.get("associated_job_ids"), str):
            try:
                copied["associated_job_ids"] = json.loads(copied["associated_job_ids"])
            except Exception:
                copied["associated_job_ids"] = []
        if isinstance(copied.get("interactions"), str):
            try:
                copied["interactions"] = json.loads(copied["interactions"])
            except Exception:
                copied["interactions"] = []
        
        valid_fields = cls.__annotations__.keys()
        filtered = {k: v for k, v in copied.items() if k in valid_fields}
        return cls(**filtered)


AU_SEED_CONTACTS = [
    {
        "name": "Sarah Jenkins",
        "role": "Principal Consultant - Cloud & Platform",
        "organization": "Hays Australia",
        "contact_type": "agency_recruiter",
        "sector": "technology",
        "email": "sarah.jenkins@hays.com.au",
        "phone": "+61 2 8226 9600",
        "linkedin_url": "https://linkedin.com/in/sarah-jenkins-hays",
        "notes": "Handles Tier-1 Enterprise & Public Sector cloud infrastructure mandates across Sydney & Canberra.",
        "relationship_health": "warm",
        "cadence_frequency_days": 14,
    },
    {
        "name": "David Alverez",
        "role": "Associate Director - Executive & Legal Search",
        "organization": "Michael Page",
        "contact_type": "executive_search",
        "sector": "legal",
        "email": "david.alverez@michaelpage.com.au",
        "phone": "+61 3 9607 5600",
        "linkedin_url": "https://linkedin.com/in/david-alverez-mp",
        "notes": "Corporate governance, regulatory advisory, and in-house general counsel placements.",
        "relationship_health": "warm",
        "cadence_frequency_days": 21,
    },
    {
        "name": "Chloe Campbell",
        "role": "Practice Lead - Healthcare & Allied Health",
        "organization": "Davidson People",
        "contact_type": "agency_recruiter",
        "sector": "healthcare",
        "email": "chloe.campbell@davidsonwp.com",
        "phone": "+61 7 3023 1000",
        "linkedin_url": "https://linkedin.com/in/chloe-campbell-davidson",
        "notes": "AHPRA-registered clinician placements, clinical nurse leaders, and allied health directors.",
        "relationship_health": "warm",
        "cadence_frequency_days": 14,
    },
    {
        "name": "Liam Thorne",
        "role": "Director - Financial Services & Quant Risk",
        "organization": "Robert Walters",
        "contact_type": "agency_recruiter",
        "sector": "finance",
        "email": "liam.thorne@robertwalters.com.au",
        "phone": "+61 2 8289 3100",
        "linkedin_url": "https://linkedin.com/in/liam-thorne-rw",
        "notes": "Big-4 bank treasury, actuarial risk, and quantitative trading desks.",
        "relationship_health": "warm",
        "cadence_frequency_days": 21,
    },
    {
        "name": "Marcus Vance",
        "role": "Head of Engineering Talent",
        "organization": "Canva",
        "contact_type": "internal_talent",
        "sector": "technology",
        "email": "marcus.vance@canva.com",
        "phone": "+61 400 333 888",
        "linkedin_url": "https://linkedin.com/in/marcus-vance-canva",
        "notes": "Leads staff+ platform & systems engineering hiring.",
        "relationship_health": "active",
        "cadence_frequency_days": 14,
    },
    {
        "name": "Brendan O'Connor",
        "role": "Operations & Facilities Recruitment Lead",
        "organization": "Adecco Australia",
        "contact_type": "agency_recruiter",
        "sector": "trades",
        "email": "b.oconnor@adecco.com.au",
        "phone": "+61 2 9200 4500",
        "linkedin_url": "https://linkedin.com/in/brendan-oconnor-adecco",
        "notes": "HVAC supervisors, commercial electrical project managers, and civil construction leads.",
        "relationship_health": "warm",
        "cadence_frequency_days": 30,
    },
]


class NetworkCRMManager:
    """Manages SQLite storage and business logic for Recruiter & Talent CRM."""

    def __init__(self, db_path: str | Path):
        self.db_path = str(db_path)
        self.ensure_schema()

    def ensure_schema(self) -> None:
        """Create table and indices if they do not exist."""
        with get_db_connection(self.db_path) as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS network_contacts (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL DEFAULT 'default_user',
                    name TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT '',
                    organization TEXT NOT NULL DEFAULT '',
                    contact_type TEXT NOT NULL DEFAULT 'agency_recruiter',
                    sector TEXT NOT NULL DEFAULT 'technology',
                    email TEXT DEFAULT '',
                    phone TEXT DEFAULT '',
                    linkedin_url TEXT DEFAULT '',
                    notes TEXT DEFAULT '',
                    relationship_health TEXT NOT NULL DEFAULT 'warm',
                    cadence_frequency_days INTEGER NOT NULL DEFAULT 14,
                    last_interaction_date TEXT,
                    next_follow_up_date TEXT,
                    associated_job_ids_json TEXT NOT NULL DEFAULT '[]',
                    interactions_json TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_net_contacts_user ON network_contacts(user_id);
                CREATE INDEX IF NOT EXISTS idx_net_contacts_health ON network_contacts(relationship_health);
                CREATE INDEX IF NOT EXISTS idx_net_contacts_followup ON network_contacts(next_follow_up_date);
            """)

    def _row_to_contact(self, row: sqlite3.Row) -> NetworkContact:
        data = dict(row)
        associated_job_ids = []
        if data.get("associated_job_ids_json"):
            try:
                associated_job_ids = json.loads(data["associated_job_ids_json"])
            except Exception:
                associated_job_ids = []

        interactions = []
        if data.get("interactions_json"):
            try:
                interactions = json.loads(data["interactions_json"])
            except Exception:
                interactions = []

        data["associated_job_ids"] = associated_job_ids
        data["interactions"] = interactions
        return NetworkContact.from_dict(data)

    def get_contact(self, contact_id: str, user_id: str = "default_user") -> Optional[NetworkContact]:
        with get_db_connection(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM network_contacts WHERE id = ? AND user_id = ?",
                (contact_id, user_id),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_contact(row)

    def list_contacts(
        self,
        user_id: str = "default_user",
        sector: Optional[str] = None,
        contact_type: Optional[str] = None,
        health: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[NetworkContact]:
        with get_db_connection(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            query = "SELECT * FROM network_contacts WHERE user_id = ?"
            params: List[Any] = [user_id]

            if sector:
                query += " AND sector = ?"
                params.append(sector)
            if contact_type:
                query += " AND contact_type = ?"
                params.append(contact_type)
            if health:
                query += " AND relationship_health = ?"
                params.append(health)
            if search:
                query += " AND (name LIKE ? OR organization LIKE ? OR role LIKE ? OR notes LIKE ?)"
                pattern = f"%{search}%"
                params.extend([pattern, pattern, pattern, pattern])

            query += " ORDER BY updated_at DESC"
            cursor.execute(query, tuple(params))
            return [self._row_to_contact(r) for r in cursor.fetchall()]

    def upsert_contact(self, contact: NetworkContact | Dict[str, Any], user_id: str = "default_user") -> NetworkContact:
        if isinstance(contact, dict):
            c_obj = NetworkContact.from_dict(contact)
        else:
            c_obj = contact

        c_obj.user_id = user_id or c_obj.user_id
        if not c_obj.id:
            c_obj.id = f"rec-{uuid.uuid4().hex[:10]}"

        now_iso = datetime.now(timezone.utc).isoformat()
        if not c_obj.created_at:
            c_obj.created_at = now_iso
        c_obj.updated_at = now_iso

        # Auto-compute next follow up date if none set and cadence is present
        if not c_obj.next_follow_up_date:
            base_date = date.today()
            if c_obj.last_interaction_date:
                try:
                    base_date = date.fromisoformat(c_obj.last_interaction_date)
                except Exception:
                    pass
            c_obj.next_follow_up_date = (base_date + timedelta(days=c_obj.cadence_frequency_days or 14)).isoformat()

        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO network_contacts (
                    id, user_id, name, role, organization, contact_type,
                    sector, email, phone, linkedin_url, notes,
                    relationship_health, cadence_frequency_days,
                    last_interaction_date, next_follow_up_date,
                    associated_job_ids_json, interactions_json,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    role = excluded.role,
                    organization = excluded.organization,
                    contact_type = excluded.contact_type,
                    sector = excluded.sector,
                    email = excluded.email,
                    phone = excluded.phone,
                    linkedin_url = excluded.linkedin_url,
                    notes = excluded.notes,
                    relationship_health = excluded.relationship_health,
                    cadence_frequency_days = excluded.cadence_frequency_days,
                    last_interaction_date = excluded.last_interaction_date,
                    next_follow_up_date = excluded.next_follow_up_date,
                    associated_job_ids_json = excluded.associated_job_ids_json,
                    interactions_json = excluded.interactions_json,
                    updated_at = excluded.updated_at
                """,
                (
                    c_obj.id,
                    c_obj.user_id,
                    c_obj.name,
                    c_obj.role,
                    c_obj.organization,
                    c_obj.contact_type,
                    c_obj.sector,
                    c_obj.email,
                    c_obj.phone,
                    c_obj.linkedin_url,
                    c_obj.notes,
                    c_obj.relationship_health,
                    c_obj.cadence_frequency_days,
                    c_obj.last_interaction_date,
                    c_obj.next_follow_up_date,
                    json.dumps(c_obj.associated_job_ids),
                    json.dumps(c_obj.interactions),
                    c_obj.created_at,
                    c_obj.updated_at,
                ),
            )
            conn.commit()

        return self.get_contact(c_obj.id, user_id) or c_obj

    def delete_contact(self, contact_id: str, user_id: str = "default_user") -> bool:
        with get_db_connection(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM network_contacts WHERE id = ? AND user_id = ?",
                (contact_id, user_id),
            )
            conn.commit()
            return cursor.rowcount > 0

    def add_interaction(
        self,
        contact_id: str,
        interaction: Dict[str, Any],
        user_id: str = "default_user",
    ) -> NetworkContact:
        contact = self.get_contact(contact_id, user_id)
        if not contact:
            raise ValueError(f"Contact {contact_id} not found")

        inter_id = interaction.get("id") or f"int-{uuid.uuid4().hex[:8]}"
        inter_date = interaction.get("date") or date.today().isoformat()
        clean_interaction = {
            "id": inter_id,
            "date": inter_date,
            "type": interaction.get("type", "email_outreach"),
            "summary": interaction.get("summary", ""),
            "outcome": interaction.get("outcome", ""),
        }

        contact.interactions.append(clean_interaction)
        contact.last_interaction_date = inter_date
        
        # Advance next follow up date
        try:
            parsed_date = date.fromisoformat(inter_date)
        except Exception:
            parsed_date = date.today()
        cadence_days = contact.cadence_frequency_days or 14
        contact.next_follow_up_date = (parsed_date + timedelta(days=cadence_days)).isoformat()
        contact.relationship_health = "active"

        return self.upsert_contact(contact, user_id)

    def get_cadence_radar(
        self,
        user_id: str = "default_user",
        current_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        today = date.fromisoformat(current_date) if current_date else date.today()
        contacts = self.list_contacts(user_id=user_id)

        overdue_contacts = []
        due_today_contacts = []
        due_this_week_contacts = []
        upcoming_contacts = []

        health_counts = {"active": 0, "warm": 0, "dormant": 0}

        for c in contacts:
            # Count health
            h = c.relationship_health if c.relationship_health in health_counts else "warm"
            health_counts[h] += 1

            contact_dict = c.to_dict()
            if not c.next_follow_up_date:
                upcoming_contacts.append(contact_dict)
                continue

            try:
                follow_up = date.fromisoformat(c.next_follow_up_date)
            except Exception:
                upcoming_contacts.append(contact_dict)
                continue

            diff_days = (follow_up - today).days
            contact_dict["days_difference"] = diff_days

            if diff_days < 0:
                contact_dict["days_overdue"] = abs(diff_days)
                overdue_contacts.append(contact_dict)
            elif diff_days == 0:
                due_today_contacts.append(contact_dict)
            elif 0 < diff_days <= 7:
                due_this_week_contacts.append(contact_dict)
            else:
                upcoming_contacts.append(contact_dict)

        # Sort overdue by most overdue first
        overdue_contacts.sort(key=lambda x: x.get("days_overdue", 0), reverse=True)
        due_this_week_contacts.sort(key=lambda x: x.get("days_difference", 0))

        return {
            "current_date": today.isoformat(),
            "total_contacts": len(contacts),
            "overdue_count": len(overdue_contacts),
            "due_today_count": len(due_today_contacts),
            "due_this_week_count": len(due_this_week_contacts),
            "upcoming_count": len(upcoming_contacts),
            "health_distribution": health_counts,
            "overdue_contacts": overdue_contacts,
            "due_today_contacts": due_today_contacts,
            "due_this_week_contacts": due_this_week_contacts,
        }

    def seed_default_contacts(self, user_id: str = "default_user", force: bool = False) -> List[NetworkContact]:
        existing = self.list_contacts(user_id=user_id)
        if existing and not force:
            return existing

        seeded = []
        today = date.today()
        for idx, seed_data in enumerate(AU_SEED_CONTACTS):
            contact = NetworkContact.from_dict(seed_data)
            contact.id = f"seed-rec-{idx + 1}"
            contact.user_id = user_id
            contact.last_interaction_date = (today - timedelta(days=idx * 3 + 2)).isoformat()
            contact.next_follow_up_date = (today + timedelta(days=(idx % 5) - 2)).isoformat()
            contact.interactions = [
                {
                    "id": f"seed-int-{idx + 1}",
                    "date": contact.last_interaction_date,
                    "type": "linkedin_message" if idx % 2 == 0 else "phone_call",
                    "summary": f"Initial conversation regarding market trends and executive talent landscape at {contact.organization}.",
                    "outcome": "Warm rapport established; shared talent radar profile.",
                }
            ]
            saved = self.upsert_contact(contact, user_id=user_id)
            seeded.append(saved)

        return seeded

