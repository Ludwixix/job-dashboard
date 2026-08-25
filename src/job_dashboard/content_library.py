from __future__ import annotations

import re
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from .models import Job


class ContentLibrary:
    """Structured fact base extracted from Source of Truth documents."""

    def __init__(self, source_dir: str | Path | None = None):
        self.source_dir = Path(source_dir) if source_dir else None
        self.facts: dict[str, Any] = {
            "companies": set(),
            "titles": set(),
            "dates": set(),
            "skills": set(),
            "metrics": set(),
            "achievements": set(),
        }
        if self.source_dir and self.source_dir.exists():
            self._parse_source_documents()

    def _parse_source_documents(self) -> None:
        """Extract structured facts from markdown/text files in the source directory."""
        if not self.source_dir:
            return
        files = [
            file for pattern in ("**/*.md", "**/*.txt", "**/*.markdown")
            for file in self.source_dir.glob(pattern)
        ]
        for file in files:
            try:
                text = file.read_text(encoding="utf-8")
                # Extract company names (assume they appear after "Company:" or in section headers)
                companies = re.findall(r"(?:Company|Employer):\s*([^\n]+)", text, re.I)
                self.facts["companies"].update(companies)
                # Extract job titles
                titles = re.findall(r"(?:Title|Role|Position):\s*([^\n]+)", text, re.I)
                self.facts["titles"].update(titles)
                # Extract dates in common formats
                dates = re.findall(r"\b(?:19|20)\d{2}[-/]\d{2}\b", text)
                self.facts["dates"].update(dates)
                # Extract skills (assume comma-separated lists after "Skills:")
                skills_match = re.search(r"(?:Technical )?Skills?:\s*([^\n]+(?:\n[^\n]*)*?)(?=\n\n|\n[A-Z]|$)", text, re.I)
                if skills_match:
                    skill_text = skills_match.group(1)
                    skills = re.findall(r"[A-Z][A-Za-z\s\-\.\/\+#\(\)]+", skill_text)
                    self.facts["skills"].update(s.strip() for s in skills if len(s) > 2)
                # Extract quantified achievements (numbers + nouns)
                metrics = re.findall(r"\b(\d+[%$KM]?)\s+(?:of\s+)?([a-z\s]+)(?:\s+(?:increased|decreased|improved|reduced))?", text, re.I)
                self.facts["metrics"].update(f"{m[0]} {m[1]}" for m in metrics)
                # Extract common achievement phrases
                achievements = re.findall(r"[-•]\s+([^.\n]+)", text)
                self.facts["achievements"].update(a.strip() for a in achievements if len(a) > 10)
            except Exception:
                pass

    def validate_claims(self, text: str) -> dict[str, Any]:
        """Check that every factual claim in the text traces to the content library."""
        issues: list[str] = []
        # Check for company names
        for company_pattern in re.findall(r"(?:at|for|with)\s+([A-Z][A-Za-z\s&]+?)(?:\s+(?:where|as|during)|\.|$)", text):
            if company_pattern.strip() and not any(company_pattern.lower() in c.lower() for c in self.facts["companies"]):
                issues.append(f"company_name_not_verified: '{company_pattern}'")
        # Check for job titles
        for title_pattern in re.findall(r"(?:as|role of|position of)\s+([A-Z][A-Za-z\s]+?)(?:\s+(?:at|in|with)|\.|$)", text):
            if title_pattern.strip() and not any(title_pattern.lower() in t.lower() for t in self.facts["titles"]):
                issues.append(f"title_not_verified: '{title_pattern}'")
        # Check for dates
        found_dates = re.findall(r"\b(?:19|20)\d{2}[-/]\d{2}\b", text)
        for date in found_dates:
            if date not in self.facts["dates"]:
                issues.append(f"date_not_verified: '{date}'")
        # Check for metrics/numbers
        for metric_phrase in re.findall(r"\b\d+[%$KM]?\s+(?:of\s+)?(?:[a-z\s]+)", text, re.I):
            if metric_phrase.strip() and not any(metric_phrase in m for m in self.facts["metrics"]):
                issues.append(f"metric_not_verified: '{metric_phrase}'")
        return {"verified": len(issues) == 0, "issue_count": len(issues), "issues": issues}
