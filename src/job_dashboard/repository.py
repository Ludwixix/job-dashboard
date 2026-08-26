from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

STATUSES = ("sourced", "shortlisted", "applied", "interviewing", "offer", "rejected")


class JobRepository:
    """SQLite persistence for jobs, Kanban status, and application events."""

    def __init__(self, path: str | Path):
        self.path = str(path)
        self.connection = sqlite3.connect(self.path, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self.connection.executescript("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, company TEXT NOT NULL,
                location TEXT, description TEXT, source TEXT, url TEXT, posted TEXT,
                remote INTEGER NOT NULL DEFAULT 0, stream TEXT, score INTEGER,
                data_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'sourced',
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS application_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL,
                from_status TEXT, to_status TEXT NOT NULL, occurred_at TEXT NOT NULL,
                FOREIGN KEY(job_id) REFERENCES jobs(id)
            );
        """)
        self.connection.commit()

    def replace_jobs(self, jobs: list[dict[str, Any]]) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self.connection:
            for job in jobs:
                self.connection.execute("""
                    INSERT INTO jobs (id,title,company,location,description,source,url,posted,remote,stream,score,data_json,created_at,updated_at)
                    VALUES (:id,:title,:company,:location,:description,:source,:url,:posted,:remote,:stream,:score,:data_json,:created_at,:updated_at)
                    ON CONFLICT(id) DO UPDATE SET title=excluded.title, company=excluded.company,
                    location=excluded.location, description=excluded.description, source=excluded.source,
                    url=excluded.url, posted=excluded.posted, remote=excluded.remote, stream=excluded.stream,
                    score=excluded.score, data_json=excluded.data_json, updated_at=excluded.updated_at
                """, {"id": job["id"], "title": job.get("title", ""), "company": job.get("company", ""), "location": job.get("location", ""), "description": job.get("description", ""), "source": job.get("source", ""), "url": job.get("url", ""), "posted": job.get("posted", ""), "remote": int(bool(job.get("remote", False))), "stream": job.get("stream", ""), "score": job.get("score", 0), "data_json": json.dumps(job, ensure_ascii=False), "created_at": now, "updated_at": now})

    def list_jobs(self, *, location="", salary_min=None, role="", source="", match_score_min=0, stream="", status="") -> list[dict[str, Any]]:
        clauses = ["score >= ?"]
        values: list[Any] = [match_score_min]
        for field, value in (("location", location), ("source", source), ("stream", stream), ("status", status)):
            if value:
                clauses.append(f"lower({field}) LIKE lower(?)")
                values.append(f"%{value}%")
        if role:
            clauses.append("(lower(title) LIKE lower(?) OR lower(company) LIKE lower(?) OR lower(description) LIKE lower(?))")
            values.extend([f"%{role}%", f"%{role}%", f"%{role}%"])
        rows = self.connection.execute(f"SELECT * FROM jobs WHERE {' AND '.join(clauses)} ORDER BY score DESC, posted DESC", values).fetchall()
        result = []
        for row in rows:
            job = json.loads(row["data_json"])
            if salary_min is not None and self._salary_amount(job.get("salary", "")) < salary_min:
                continue
            job["status"] = row["status"]
            result.append(job)
        return result

    @staticmethod
    def _salary_amount(value: Any) -> float:
        """Extract a comparable lower salary bound from provider text."""
        text = str(value or "")
        numbers = []
        for match in re.finditer(r"(\d[\d,]*(?:\.\d+)?)\s*(k|m)?", text, re.I):
            number = float(match.group(1).replace(",", ""))
            multiplier = match.group(2)
            if multiplier:
                number *= 1000 if multiplier.lower() == "k" else 1000000
            numbers.append(number)
        super_match = re.search(r"\d+(?:\.\d+)?\s*%\s*(?:super|superannuation)", text, re.I)
        if super_match:
            numbers = [number for number in numbers if number != float(re.search(r"\d+(?:\.\d+)?", super_match.group()).group())]
        return min(numbers) if numbers else 0.0

    def update_status(self, job_id: str, status: str) -> dict[str, Any]:
        if status not in STATUSES:
            raise ValueError(f"invalid status: {status}")
        row = self.connection.execute("SELECT status FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if row is None:
            raise KeyError(job_id)
        now = datetime.now(timezone.utc).isoformat()
        with self.connection:
            self.connection.execute("UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?", (status, now, job_id))
            self.connection.execute("INSERT INTO application_events (job_id,from_status,to_status,occurred_at) VALUES (?,?,?,?)", (job_id, row["status"], status, now))
        return {"job_id": job_id, "status": status}

    def metrics(self) -> dict[str, Any]:
        rows = self.connection.execute("SELECT status, COUNT(*) AS count FROM jobs GROUP BY status").fetchall()
        counts = {status: 0 for status in STATUSES}
        counts.update({row["status"]: row["count"] for row in rows})
        total = sum(counts.values())
        return {"total": total, "by_status": counts, "events": self.connection.execute("SELECT COUNT(*) FROM application_events").fetchone()[0]}
