from __future__ import annotations

import json
import re
import imaplib
import email
import base64
import secrets
import time
import urllib.request
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
from email.header import decode_header
from email.message import Message
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
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


class EmailClassifier:
    """Read-only email classification without any modifications to the inbox."""

    PATTERNS = {
        "application_confirmed": (
            r"(?:application|submission|resume|cv).*(?:received|confirm|registered|thank you)",
            r"(?:congratulations|thank you|we.*receive).*(?:application|submission|resume)",
        ),
        "interview_requested": (
            r"(?:interview|phone.*screening|technical.*test).*(?:schedule|next step|let.*know)",
            r"(?:next step|move forward|interview).*(?:process|round|stage)",
        ),
        "offer_extended": (
            r"(?:offer|position|role).*(?:pleased|happy|excited).*(?:extend|offer)",
            r"(?:congratulations|we.*offer).*(?:position|role|salary)",
        ),
        "rejected": (
            r"(?:regret|unfortunately|not.*proceed).*(?:candidate|application|role)",
            r"(?:decided|chosen).*(?:candidate|successful|other)",
        ),
        "recruiter_reply": (
            r"(?:follow up|checking in|interested).*(?:position|opportunity|role)",
            r"(?:would you|are you interested).*(?:opportunity|position)",
        ),
    }

    def classify(self, email: EmailMessage) -> tuple[str, float]:
        """Classify a single email into one category with confidence score.

        Returns (category, confidence) where confidence is 0.0-1.0.
        Categories: application_confirmed, recruiter_reply, interview_requested, offer_extended, rejected.
        """
        search_text = f"{email.subject} {email.snippet} {email.body_preview}".lower()
        best_match = "recruiter_reply"
        best_confidence = 0.0

        for category, patterns in self.PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, search_text, re.I):
                    confidence = 0.7 if len(re.findall(pattern, search_text, re.I)) == 1 else 0.9
                    if confidence > best_confidence:
                        best_confidence = confidence
                        best_match = category
        return (best_match, best_confidence)

    def process_messages(self, messages: Iterable[EmailMessage]) -> dict[str, Any]:
        """Classify a batch of messages and return summary statistics."""
        results = {"total": 0, "classified": {}, "high_confidence": 0}
        for msg in messages:
            category, confidence = self.classify(msg)
            results["total"] += 1
            results["classified"].setdefault(category, []).append({"subject": msg.subject, "confidence": round(confidence, 2)})
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

    def __init__(self, username: str, app_password: str, days: int = 7, host: str = "imap.gmail.com"):
        self.username = username
        self.app_password = app_password
        self.days = days
        self.host = host

    def fetch_messages(self) -> list[EmailMessage]:
        since = (datetime.now(timezone.utc) - timedelta(days=self.days)).strftime("%d-%b-%Y")
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

    @staticmethod
    def _decode(value: str) -> str:
        parts = decode_header(value or "")
        return "".join(part.decode(charset or "utf-8", errors="replace") if isinstance(part, bytes) else part for part, charset in parts)

    @classmethod
    def _to_email_message(cls, message: Message, message_id: str) -> EmailMessage:
        body = ""
        if message.is_multipart():
            for part in message.walk():
                if part.get_content_type() == "text/plain" and not part.get("Content-Disposition"):
                    body = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="replace")
                    break
        else:
            payload = message.get_payload(decode=True)
            body = payload.decode(message.get_content_charset() or "utf-8", errors="replace") if isinstance(payload, bytes) else str(payload or "")
        received = message.get("Date", "")
        try:
            received = datetime.fromtimestamp(email.utils.mktime_tz(email.utils.parsedate_tz(received)), timezone.utc).isoformat()
        except (TypeError, ValueError, OverflowError):
            received = datetime.now(timezone.utc).isoformat()
        return EmailMessage(
            subject=cls._decode(message.get("Subject", "")),
            snippet=re.sub(r"\s+", " ", body).strip()[:1000],
            from_address=cls._decode(message.get("From", "")),
            received_at=received,
            email_id=message_id,
            body_preview=body[:4000],
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
        credentials = json.loads(token.read_text(encoding="utf-8")) if token.exists() else None
        if credentials and credentials.get("refresh_token") and credentials.get("expires_at", 0) <= time.time() + 60:
            body = urllib.parse.urlencode({
                "client_id": client["client_id"], "client_secret": client["client_secret"],
                "refresh_token": credentials["refresh_token"], "grant_type": "refresh_token",
            }).encode()
            request = urllib.request.Request(client["token_uri"], data=body, method="POST")
            with urllib.request.urlopen(request, timeout=30) as response:
                refreshed = json.loads(response.read())
            credentials.update(refreshed)
            credentials["expires_at"] = time.time() + refreshed.get("expires_in", 3600)
            token.write_text(json.dumps(credentials), encoding="utf-8")
        if credentials and credentials.get("access_token"):
            return client, credentials["access_token"]

        state = secrets.token_urlsafe(24)
        redirect_uri = "http://localhost:8765/"
        query = urllib.parse.urlencode({
            "client_id": client["client_id"], "redirect_uri": redirect_uri,
            "response_type": "code", "scope": " ".join(self.SCOPES),
            "access_type": "offline", "prompt": "consent", "state": state,
        })
        authorization_url = f'{client["auth_uri"]}?{query}'
        print(f"Authorize Gmail in your browser: {authorization_url}", flush=True)
        callback = {}

        class CallbackHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                callback.update(parse_qs(urlparse(self.path).query))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"Gmail authorization received. You can close this tab.")

            def log_message(self, *_args):
                return

        server = HTTPServer(("localhost", 8765), CallbackHandler)
        while not callback:
            server.handle_request()
        server.server_close()
        if callback.get("state", [""])[0] != state or not callback.get("code"):
            raise RuntimeError("Gmail OAuth authorization was not completed")
        body = urllib.parse.urlencode({
            "code": callback["code"][0], "client_id": client["client_id"],
            "client_secret": client["client_secret"], "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }).encode()
        request = urllib.request.Request(client["token_uri"], data=body, method="POST")
        with urllib.request.urlopen(request, timeout=30) as response:
            credentials = json.loads(response.read())
        credentials["expires_at"] = time.time() + credentials.get("expires_in", 3600)
        token.write_text(json.dumps(credentials), encoding="utf-8")
        return client, credentials["access_token"]

    def fetch_messages(self) -> list[EmailMessage]:
        client, access_token = self._service()
        headers = {"Authorization": f"Bearer {access_token}"}
        query = urllib.parse.urlencode({"q": f'newer_than:{self.days}d {{application applied interview recruiter offer position candidate hiring "thank you for applying"}}', "maxResults": 100})
        request = urllib.request.Request(f"https://gmail.googleapis.com/gmail/v1/users/me/messages?{query}", headers=headers)
        with urllib.request.urlopen(request, timeout=30) as response:
            response_data = json.loads(response.read())
        messages = []
        for item in response_data.get("messages", []):
            request = urllib.request.Request(f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{item['id']}?format=full", headers=headers)
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read())
            messages.append(self._from_api_payload(payload))
        return messages

    @classmethod
    def _from_api_payload(cls, payload):
        headers = {header["name"].lower(): header["value"] for header in payload.get("payload", {}).get("headers", [])}
        body_parts = []

        def collect(part):
            if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
                body_parts.append(base64.urlsafe_b64decode(part["body"]["data"] + "===").decode("utf-8", errors="replace"))
            for child in part.get("parts", []):
                collect(child)

        collect(payload.get("payload", {}))
        return EmailMessage(
            subject=cls._decode(headers.get("subject", "")),
            snippet=payload.get("snippet", ""),
            from_address=cls._decode(headers.get("from", "")),
            received_at=headers.get("date", ""),
            email_id=payload.get("id", ""),
            body_preview="\n".join(body_parts)[:4000],
        )
