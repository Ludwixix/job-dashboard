from __future__ import annotations

import base64
import email
import imaplib
import json
import re
import secrets
import time
import urllib.parse
import urllib.request
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.header import decode_header
from email.message import Message
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


@dataclass
class EmailMessage:
    subject: str
    snippet: str
    from_address: str
    received_at: str
    email_id: str
    body_preview: str = ""


def clean_email_text(raw: str) -> str:
    """Sanitize malformed text blocks, stripping HTML tags, HTML entities, and excessive whitespace."""
    if not raw:
        return ""
    text = re.sub(r"<[^>]+>", " ", str(raw))
    text = (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
    )
    return re.sub(r"\s+", " ", text).strip()


class EmailClassifier:
    """Read-only email classification without any modifications to the inbox."""

    clean_email_text = staticmethod(clean_email_text)

    PATTERNS = {
        "offer_extended": (
            r"(?:offer|position|role).*(?:pleased|happy|excited).*(?:extend|offer)",
            r"(?:congratulations|we.*offer).*(?:position|role|salary)",
            r"(?:letter of offer|employment contract|formal offer)",
        ),
        "interview_requested": (
            r"(?:interview|phone.*screening|technical.*test|coding.*assessment).*(?:schedule|next step|let.*know|invitation|loop|availability)",
            r"(?:next step|move forward|progress.*to|invite.*to|invitation.*to).*(?:interview|process|round|stage|conversation)",
            r"(?:kbr|sharepoint.*analyst).*(?:interview|schedule|meeting|discussion|loop)",
            r"(?:interview\s*loop|panel\s*interview|first\s*round\s*interview|video\s*interview)",
            r"(?:availability|timeslot|calendar|teams meeting|zoom|google meet).*(?:interview|chat|discussion|catch.*up)",
        ),
        "rejected": (
            r"(?:regret|unfortunately|not.*proceed|not.*moving forward|unsuccessful).*(?:candidate|application|role|position|candidacy|stage)",
            r"(?:decided|chosen|pursu(?:e|ing)).*(?:candidate|successful|other|another|different)",
            r"(?:racv|olympus|nextdc).*(?:not.*proceed|unsuccessful|other candidates|regret|careful consideration)",
            r"(?:not\s*been\s*successful|will\s*not\s*be\s*(?:progressing|moving forward)|chosen\s*not\s*to\s*progress)",
        ),
        "application_confirmed": (
            r"(?:application|submission|resume|cv).*(?:received|confirm|registered|thank you|acknowledg|receipt)",
            r"(?:congratulations|thank you|we.*receive|acknowledg).*(?:application|submission|resume)",
            r"(?:confirmation|receipt|acknowledgment)\s*(?:of|for)\s*(?:your\s*)?(?:application|submission)",
            r"(?:schoolbox|nexon|department of health).*(?:application|received|submission|acknowledg)",
            r"application\s*(?:submitted|received|confirmation|acknowledgment)",
        ),
        "recruiter_reply": (
            r"(?:follow up|checking in|interested).*(?:position|opportunity|role)",
            r"(?:would you|are you interested).*(?:opportunity|position)",
        ),
    }

    CATEGORY_PRIORITY = {
        "offer_extended": 10,
        "interview_requested": 8,
        "rejected": 6,
        "application_confirmed": 4,
        "recruiter_reply": 2,
    }

    def classify(self, email: EmailMessage) -> tuple[str, float]:
        """Classify a single email into one category with confidence score.

        Returns (category, confidence) where confidence is 0.0-1.0.
        Categories: application_confirmed, recruiter_reply, interview_requested, offer_extended, rejected.
        Applies strict category priority so definitive notices (offers, interviews, rejections)
        override generic application acknowledgments.
        """
        search_text = f"{email.subject} {email.snippet} {email.body_preview}".lower()
        best_match = "recruiter_reply"
        best_confidence = 0.0
        best_priority = -1

        for category, patterns in self.PATTERNS.items():
            category_priority = self.CATEGORY_PRIORITY.get(category, 0)
            for pattern in patterns:
                matches = re.findall(pattern, search_text, re.IGNORECASE)
                if matches:
                    confidence = 0.7 if len(matches) == 1 else 0.9
                    # Favor higher category priority when confidence is comparable
                    if (category_priority > best_priority and confidence >= 0.7) or (
                        confidence > best_confidence
                        and category_priority >= best_priority
                    ):
                        best_confidence = confidence
                        best_match = category
                        best_priority = category_priority
        return (best_match, best_confidence)

    def process_messages(self, messages: Iterable[EmailMessage]) -> dict[str, Any]:
        """Classify a batch of messages and return summary statistics."""
        results = {"total": 0, "classified": {}, "high_confidence": 0}
        for msg in messages:
            category, confidence = self.classify(msg)
            results["total"] += 1
            results["classified"].setdefault(category, []).append(
                {"subject": msg.subject, "confidence": round(confidence, 2)}
            )
            if confidence >= 0.8:
                results["high_confidence"] += 1
        return results


class GmailScanner:
    """Read recent Gmail application messages through a read-only IMAP session."""

    APPLICATION_CATEGORIES = {
        "application_confirmed",
        "interview_requested",
        "offer_extended",
        "rejected",
        "recruiter_reply",
    }

    def __init__(
        self,
        username: str,
        app_password: str,
        days: int = 7,
        host: str = "imap.gmail.com",
    ):
        self.username = username
        self.app_password = app_password
        self.days = days
        self.host = host

    def fetch_messages(self) -> list[EmailMessage]:
        since = (datetime.now(timezone.utc) - timedelta(days=self.days)).strftime(
            "%d-%b-%Y"
        )
        messages: list[EmailMessage] = []
        with imaplib.IMAP4_SSL(self.host) as mailbox:
            mailbox.login(self.username, self.app_password)
            mailbox.select("INBOX", readonly=True)
            status, data = mailbox.uid("search", None, f'(SINCE "{since}")')
            if status != "OK":
                return messages
            for message_id in data[0].split():
                status, fetched = mailbox.uid("fetch", message_id, "(RFC822)")
                if status != "OK" or not fetched or not isinstance(fetched[0], tuple):
                    continue
                message = email.message_from_bytes(fetched[0][1])
                messages.append(self._to_email_message(message, message_id.decode()))
        return messages

    def application_messages(self) -> list[tuple[EmailMessage, str, float]]:
        classifier = EmailClassifier()
        results = []
        for message in self.fetch_messages():
            category, confidence = classifier.classify(message)
            if category in self.APPLICATION_CATEGORIES and confidence >= 0.7:
                results.append((message, category, confidence))
        return results

    def scan_job_alerts(self, min_score: int = 60) -> list[dict[str, Any]]:
        """Scan inbox for multi-job alerts and parse them into structured job cards."""
        parser = JobAlertParser()
        jobs: list[dict[str, Any]] = []
        for message in self.fetch_messages():
            if parser.is_job_alert(message):
                jobs.extend(parser.parse_alert_email(message, min_score=min_score))
        return jobs

    def scan_updates_for_application(
        self, app_dict: dict[str, Any], days: int = 14
    ) -> dict[str, Any]:
        """Scan user inbox targeted specifically for updates regarding a single applied job."""
        company = (
            str(
                app_dict.get("company")
                or app_dict.get("job_data", {}).get("company")
                or ""
            )
            .strip()
            .lower()
        )
        current_status = str(app_dict.get("status") or "applied")
        job_id = app_dict.get("job_id") or app_dict.get("id")

        if not company or company in ("unknown", "gmail", "direct employer"):
            return {
                "updated": False,
                "job_id": job_id,
                "status": current_status,
                "reason": "No valid company to search",
            }

        classifier = EmailClassifier()
        status_map = {
            "application_confirmed": "Applied / Confirmation Received",
            "interview_requested": "Interview Scheduled",
            "offer_extended": "Offer Received",
            "rejected": "Unsuccessful",
            "recruiter_reply": "In Review / Recruiter Contacted",
        }

        # Fetch recent messages
        messages = self.fetch_messages()
        matching_updates = []

        for msg in messages:
            haystack = f"{msg.from_address} {msg.subject} {msg.snippet} {msg.body_preview}".lower()
            if company in haystack:
                category, confidence = classifier.classify(msg)
                if category in status_map and confidence >= 0.65:
                    new_status = status_map[category]
                    matching_updates.append(
                        {
                            "message": msg,
                            "category": category,
                            "new_status": new_status,
                            "confidence": confidence,
                            "date": msg.received_at,
                        }
                    )

        if not matching_updates:
            return {"updated": False, "job_id": job_id, "status": current_status}

        # Pick most recent and highest progression status
        matching_updates.sort(key=lambda x: x["date"], reverse=True)
        best = matching_updates[0]

        return {
            "updated": True,
            "job_id": job_id,
            "old_status": current_status,
            "new_status": best["new_status"],
            "email_subject": best["message"].subject,
            "email_snippet": best["message"].snippet,
            "email_date": best["message"].received_at,
            "email_thread_id": best["message"].email_id,
            "confidence": best["confidence"],
        }

    def scan_updates_for_all_applications(
        self, apps_list: list[dict[str, Any]], days: int = 14
    ) -> list[dict[str, Any]]:
        """Scan user inbox targeted across all tracked applications in a single IMAP connection."""
        classifier = EmailClassifier()
        status_map = {
            "application_confirmed": "Applied / Confirmation Received",
            "interview_requested": "Interview Scheduled",
            "offer_extended": "Offer Received",
            "rejected": "Unsuccessful",
            "recruiter_reply": "In Review / Recruiter Contacted",
        }

        messages = self.fetch_messages()
        results = []

        for app_dict in apps_list:
            company = (
                str(
                    app_dict.get("company")
                    or app_dict.get("job_data", {}).get("company")
                    or ""
                )
                .strip()
                .lower()
            )
            current_status = str(app_dict.get("status") or "applied")
            job_id = app_dict.get("job_id") or app_dict.get("id")

            if not company or company in ("unknown", "gmail", "direct employer"):
                continue

            app_updates = []
            for msg in messages:
                haystack = f"{msg.from_address} {msg.subject} {msg.snippet} {msg.body_preview}".lower()
                if company in haystack:
                    category, confidence = classifier.classify(msg)
                    if category in status_map and confidence >= 0.65:
                        app_updates.append(
                            {
                                "message": msg,
                                "new_status": status_map[category],
                                "confidence": confidence,
                                "date": msg.received_at,
                            }
                        )

            if app_updates:
                app_updates.sort(key=lambda x: x["date"], reverse=True)
                best = app_updates[0]
                results.append(
                    {
                        "updated": True,
                        "job_id": job_id,
                        "old_status": current_status,
                        "new_status": best["new_status"],
                        "email_subject": best["message"].subject,
                        "email_snippet": best["message"].snippet,
                        "email_date": best["message"].received_at,
                        "email_thread_id": best["message"].email_id,
                        "confidence": best["confidence"],
                    }
                )
            else:
                results.append(
                    {"updated": False, "job_id": job_id, "status": current_status}
                )

        return results

    @staticmethod
    def clean_email_text(raw: str) -> str:
        """Sanitize malformed text blocks, stripping HTML tags, HTML entities, and excessive whitespace."""
        if not raw:
            return ""
        text = re.sub(r"<[^>]+>", " ", str(raw))
        text = (
            text.replace("&nbsp;", " ")
            .replace("&amp;", "&")
            .replace("&quot;", '"')
            .replace("&#39;", "'")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
        )
        return re.sub(r"\s+", " ", text).strip()

    @staticmethod
    def _decode(value: str) -> str:
        parts = decode_header(value or "")
        return "".join(
            part.decode(charset or "utf-8", errors="replace")
            if isinstance(part, bytes)
            else part
            for part, charset in parts
        )

    @classmethod
    def _to_email_message(cls, message: Message, message_id: str) -> EmailMessage:
        body = ""
        if message.is_multipart():
            for part in message.walk():
                if part.get_content_type() == "text/plain" and not part.get(
                    "Content-Disposition"
                ):
                    body = part.get_payload(decode=True).decode(
                        part.get_content_charset() or "utf-8", errors="replace"
                    )
                    break
        else:
            payload = message.get_payload(decode=True)
            body = (
                payload.decode(
                    message.get_content_charset() or "utf-8", errors="replace"
                )
                if isinstance(payload, bytes)
                else str(payload or "")
            )
        received = message.get("Date", "")
        try:
            received = datetime.fromtimestamp(
                email.utils.mktime_tz(email.utils.parsedate_tz(received)), timezone.utc
            ).isoformat()
        except (TypeError, ValueError, OverflowError):
            received = datetime.now(timezone.utc).isoformat()
        cleaned_body = cls.clean_email_text(body)
        return EmailMessage(
            subject=cls.clean_email_text(cls._decode(message.get("Subject", ""))),
            snippet=cleaned_body[:1000],
            from_address=cls._decode(message.get("From", "")).strip(),
            received_at=received,
            email_id=message_id,
            body_preview=cleaned_body[:4000],
        )


class GmailApiScanner(GmailScanner):
    """Read recent Gmail application messages through the Gmail API OAuth flow."""

    SCOPES = ("https://www.googleapis.com/auth/gmail.readonly",)

    def __init__(self, credentials_path: str, token_path: str, days: int = 7):
        self.credentials_path = credentials_path
        self.token_path = token_path
        self.days = days

    def _service(self):
        token = Path(self.token_path)
        config = json.loads(Path(self.credentials_path).read_text(encoding="utf-8"))
        client = config.get("installed") or config.get("web")
        credentials = (
            json.loads(token.read_text(encoding="utf-8")) if token.exists() else None
        )
        if (
            credentials
            and credentials.get("refresh_token")
            and credentials.get("expires_at", 0) <= time.time() + 60
        ):
            body = urllib.parse.urlencode(
                {
                    "client_id": client["client_id"],
                    "client_secret": client["client_secret"],
                    "refresh_token": credentials["refresh_token"],
                    "grant_type": "refresh_token",
                }
            ).encode()
            request = urllib.request.Request(
                client["token_uri"], data=body, method="POST"
            )
            with urllib.request.urlopen(request, timeout=30) as response:
                refreshed = json.loads(response.read())
            credentials.update(refreshed)
            credentials["expires_at"] = time.time() + refreshed.get("expires_in", 3600)
            token.write_text(json.dumps(credentials), encoding="utf-8")
        if credentials and credentials.get("access_token"):
            return client, credentials["access_token"]

        state = secrets.token_urlsafe(24)
        redirect_uri = "http://localhost:8765/"
        query = urllib.parse.urlencode(
            {
                "client_id": client["client_id"],
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": " ".join(self.SCOPES),
                "access_type": "offline",
                "prompt": "consent",
                "state": state,
            }
        )
        authorization_url = f"{client['auth_uri']}?{query}"
        print(f"Authorize Gmail in your browser: {authorization_url}", flush=True)
        callback = {}

        class CallbackHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                callback.update(parse_qs(urlparse(self.path).query))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(
                    b"Gmail authorization received. You can close this tab."
                )

            def log_message(self, *_args):
                return

        server = HTTPServer(("localhost", 8765), CallbackHandler)
        while not callback:
            server.handle_request()
        server.server_close()
        if callback.get("state", [""])[0] != state or not callback.get("code"):
            raise RuntimeError("Gmail OAuth authorization was not completed")
        body = urllib.parse.urlencode(
            {
                "code": callback["code"][0],
                "client_id": client["client_id"],
                "client_secret": client["client_secret"],
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            }
        ).encode()
        request = urllib.request.Request(client["token_uri"], data=body, method="POST")
        with urllib.request.urlopen(request, timeout=30) as response:
            credentials = json.loads(response.read())
        credentials["expires_at"] = time.time() + credentials.get("expires_in", 3600)
        token.write_text(json.dumps(credentials), encoding="utf-8")
        return client, credentials["access_token"]

    def fetch_messages(self) -> list[EmailMessage]:
        client, access_token = self._service()
        headers = {"Authorization": f"Bearer {access_token}"}
        query = urllib.parse.urlencode(
            {
                "q": f'newer_than:{self.days}d {{application applied interview recruiter offer position candidate hiring "thank you for applying"}}',
                "maxResults": 100,
            }
        )
        request = urllib.request.Request(
            f"https://gmail.googleapis.com/gmail/v1/users/me/messages?{query}",
            headers=headers,
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            response_data = json.loads(response.read())
        messages = []
        for item in response_data.get("messages", []):
            request = urllib.request.Request(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{item['id']}?format=full",
                headers=headers,
            )
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read())
            messages.append(self._from_api_payload(payload))
        return messages

    def scan_job_alerts(self, min_score: int = 60) -> list[dict[str, Any]]:
        """Read recent Gmail job alerts and suggestion digests via Gmail API."""
        parser = JobAlertParser()
        client, access_token = self._service()
        headers = {"Authorization": f"Bearer {access_token}"}
        query = urllib.parse.urlencode(
            {
                "q": f'newer_than:{self.days}d (subject:"job alert" OR subject:"jobs recommended" OR subject:"recommended for you" OR subject:"new jobs" OR subject:"jobs for you" OR subject:"jobs you may" OR from:seek OR from:linkedin OR from:indeed)',
                "maxResults": 100,
            }
        )
        request = urllib.request.Request(
            f"https://gmail.googleapis.com/gmail/v1/users/me/messages?{query}",
            headers=headers,
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            response_data = json.loads(response.read())
        messages = []
        for item in response_data.get("messages", []):
            req = urllib.request.Request(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{item['id']}?format=full",
                headers=headers,
            )
            with urllib.request.urlopen(req, timeout=30) as res:
                payload = json.loads(res.read())
            messages.append(self._from_api_payload(payload))

        jobs: list[dict[str, Any]] = []
        for msg in messages:
            if parser.is_job_alert(msg):
                jobs.extend(parser.parse_alert_email(msg, min_score=min_score))
        return jobs

    @classmethod
    def _from_api_payload(cls, payload):
        headers = {
            header["name"].lower(): header["value"]
            for header in payload.get("payload", {}).get("headers", [])
        }
        body_parts = []

        def collect(part):
            if part.get("mimeType") == "text/plain" and part.get("body", {}).get(
                "data"
            ):
                body_parts.append(
                    base64.urlsafe_b64decode(part["body"]["data"] + "===").decode(
                        "utf-8", errors="replace"
                    )
                )
            for child in part.get("parts", []):
                collect(child)

        collect(payload.get("payload", {}))
        raw_body = "\n".join(body_parts)
        cleaned_body = cls.clean_email_text(raw_body)
        raw_date = headers.get("date", "")
        try:
            received = datetime.fromtimestamp(
                email.utils.mktime_tz(email.utils.parsedate_tz(raw_date)), timezone.utc
            ).isoformat()
        except (TypeError, ValueError, OverflowError):
            received = datetime.now(timezone.utc).isoformat()
        return EmailMessage(
            subject=cls.clean_email_text(cls._decode(headers.get("subject", ""))),
            snippet=cls.clean_email_text(payload.get("snippet", ""))[:1000]
            or cleaned_body[:1000],
            from_address=cls._decode(headers.get("from", "")).strip(),
            received_at=received,
            email_id=payload.get("id", ""),
            body_preview=cleaned_body[:4000],
        )


class JobAlertParser:
    """Parses multi-job alert emails from SEEK, LinkedIn, Indeed, and scores against target titles."""

    TARGET_TITLES = [
        "Senior Infrastructure Engineer",
        "Senior Systems Administrator",
        "Cloud Engineer",
        "Infrastructure Engineer",
        "Systems Administrator",
        "M365 Engineer",
        "Modern Workplace Engineer",
        "IT Systems Engineer",
        "Platform Engineer",
        "DevOps Engineer",
    ]

    NOISE_PATTERNS = [
        r"\b(level 1|l1|helpdesk|service desk analyst|service desk technician|desktop support technician|field technician|field service|eftpos|junior|intern|trainee|apprentice|sales|retail)\b",
    ]

    SENIOR_EXEMPTIONS = [
        r"\b(senior|lead|principal|head|manager|specialist|architect)\b",
    ]

    ALERT_KEYWORDS = [
        "job alert",
        "jobs recommended",
        "recommended for you",
        "jobs you might",
        "jobs you may",
        "new jobs for",
        "new jobs matching",
        "top job picks",
        "matches your profile",
        "new jobs in",
    ]

    def is_job_alert(self, msg: EmailMessage) -> bool:
        """Identify if an incoming message is a job alert or recommendation digest."""
        sub = (msg.subject or "").lower()
        from_addr = (msg.from_address or "").lower()
        if any(kw in sub for kw in self.ALERT_KEYWORDS):
            return True
        if "seek" in from_addr and (
            "alert" in sub or "jobs" in sub or "recommended" in sub
        ):
            return True
        if "linkedin" in from_addr and (
            "job" in sub or "alert" in sub or "opportunity" in sub
        ):
            return True
        if "indeed" in from_addr and ("job" in sub or "alert" in sub):
            return True
        return False

    def score_job_title(self, title: str) -> int:
        """Score role title against Sam Ludwig's 8 target career archetypes and penalize noise."""
        clean = (title or "").strip()
        clean_lower = clean.lower()

        # Check noise patterns (L1, helpdesk, technician)
        is_noise = any(re.search(pat, clean_lower) for pat in self.NOISE_PATTERNS)
        is_senior = any(re.search(pat, clean_lower) for pat in self.SENIOR_EXEMPTIONS)
        if is_noise and not is_senior:
            return 30

        # Exact target title match
        for target in self.TARGET_TITLES:
            if target.lower() == clean_lower:
                return 95

        # Strong keyword matches
        if "senior infrastructure" in clean_lower:
            return 93
        if "cloud engineer" in clean_lower or "cloud infrastructure" in clean_lower:
            return 92
        if (
            "senior systems administrator" in clean_lower
            or "senior sysadmin" in clean_lower
        ):
            return 90
        if "infrastructure engineer" in clean_lower:
            return 88
        if (
            "m365" in clean_lower
            or "modern workplace" in clean_lower
            or "microsoft 365" in clean_lower
        ):
            return 87
        if "systems administrator" in clean_lower or "sysadmin" in clean_lower:
            return 84
        if "systems engineer" in clean_lower or "it systems engineer" in clean_lower:
            return 82
        if "devops" in clean_lower or "platform engineer" in clean_lower:
            return 80
        if "infrastructure" in clean_lower or "cloud" in clean_lower:
            return 75
        if "support engineer" in clean_lower and is_senior:
            return 65

        return 45

    def parse_alert_email(
        self, msg: EmailMessage, min_score: int = 60
    ) -> list[dict[str, Any]]:
        """Extract individual job cards from a job alert email digest and score them."""
        text = msg.body_preview or msg.snippet or ""
        jobs: list[dict[str, Any]] = []

        url_pattern = re.compile(
            r"(https?://(?:www\.)?(?:[a-z0-9.-]*seek\.com\.au/job/\d+|[a-z0-9.-]*linkedin\.com/(?:comm/)?jobs/view/\d+|[a-z0-9.-]*indeed\.com/(?:rc/clk|viewjob)[^\s\"<>]*))",
            re.IGNORECASE,
        )

        matches = list(url_pattern.finditer(text))
        ignored_lines = {
            "view job",
            "view job:",
            "apply now",
            "save job",
            "see more jobs",
            "view details",
            "jobs recommended for you based on your activity:",
            "jobs recommended for you",
            "unsubscribe",
            "manage alerts",
            "privacy policy",
            "terms of service",
        }

        last_end = 0
        for match in matches:
            url = match.group(1).rstrip(".,;)>")
            start_pos = match.start()
            chunk = text[last_end:start_pos]
            last_end = match.end()

            raw_lines = [
                l.strip()
                for l in chunk.splitlines()
                if l.strip()
                and l.strip().lower() not in ignored_lines
                and not l.strip().lower().startswith("view job")
            ]

            # Filter out email header lines like "Sam, 3 new jobs for '...'"
            clean_lines = []
            for l in raw_lines:
                if re.search(r"^\s*[\w\s]+,\s*\d+\s+new jobs", l, re.IGNORECASE):
                    continue
                if re.search(r"^\s*jobs recommended for you", l, re.IGNORECASE):
                    continue
                clean_lines.append(l)

            if not clean_lines:
                continue

            title = clean_lines[0]
            company = ""
            location = "Melbourne VIC"
            salary = ""

            if len(clean_lines) > 1:
                second = clean_lines[1]
                if " - " in second:
                    c, loc = second.split(" - ", 1)
                    company = c.strip()
                    location = loc.strip()
                else:
                    company = second

            if len(clean_lines) > 2:
                for rem in clean_lines[2:]:
                    if any(s in rem for s in ["$", "k", "year", "annum"]):
                        salary = rem
                    elif not company:
                        company = rem
                    elif location == "Melbourne VIC" and any(
                        state in rem.upper()
                        for state in [
                            "VIC",
                            "NSW",
                            "QLD",
                            "WA",
                            "SA",
                            "TAS",
                            "ACT",
                            "AUSTRALIA",
                        ]
                    ):
                        location = rem

            provider = (
                "SEEK"
                if "seek.com" in url
                else ("LinkedIn" if "linkedin.com" in url else "Indeed")
            )
            id_match = re.search(r"/(\d{6,12})", url)
            job_id = id_match.group(1) if id_match else secrets.token_hex(6)

            score = self.score_job_title(title)
            if score >= min_score and title:
                jobs.append(
                    {
                        "id": f"gmail-alert-{provider.lower()}-{job_id}",
                        "title": title,
                        "company": company or "Direct Employer",
                        "location": location,
                        "salary": salary,
                        "url": url,
                        "source": "Gmail Alert",
                        "posted": msg.received_at[:10]
                        if msg.received_at
                        else datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                        "score": score,
                        "status": "sourced",
                        "description": f"Suggested via {provider} job alert ({msg.subject})",
                        "tags": ["gmail", "alert", provider.lower()],
                    }
                )

        # Fallback block parser if link regex was too restrictive or missing full URLs
        if not jobs:
            blocks = re.split(r"\n\s*\n", text)
            for block in blocks:
                block_lines = [l.strip() for l in block.splitlines() if l.strip()]
                if not block_lines:
                    continue
                first_line = block_lines[0]
                if re.search(
                    r"^\s*[\w\s]+,\s*\d+\s+new jobs", first_line, re.IGNORECASE
                ) or re.search(r"^\s*jobs recommended", first_line, re.IGNORECASE):
                    if len(block_lines) > 1:
                        first_line = block_lines[1]
                    else:
                        continue
                score = self.score_job_title(first_line)
                if score >= min_score:
                    company = (
                        block_lines[1]
                        if len(block_lines) > 1 and block_lines[1] != first_line
                        else "Direct Employer"
                    )
                    jobs.append(
                        {
                            "id": f"gmail-alert-digest-{secrets.token_hex(6)}",
                            "title": first_line,
                            "company": company,
                            "location": "Melbourne VIC",
                            "salary": "",
                            "url": "",
                            "source": "Gmail Alert",
                            "posted": msg.received_at[:10]
                            if msg.received_at
                            else datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                            "score": score,
                            "status": "sourced",
                            "description": f"Suggested role from email: {msg.subject}",
                            "tags": ["gmail", "alert"],
                        }
                    )

        return jobs
