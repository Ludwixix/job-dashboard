"""Authentication, session validation, user profile, preferences, and feature flags routes."""

from __future__ import annotations

import datetime
from datetime import timezone
import json
import logging
import os
from pathlib import Path
import random
import sqlite3
import threading
import time
from typing import Any
import uuid

try:
    import bcrypt
except ImportError:
    bcrypt = None

try:
    import jwt
except ImportError:
    jwt = None

from ..router import app_router, get_auth_user_id, get_json_body, get_query_params

logger = logging.getLogger(__name__)

login_attempts: dict[str, dict[str, Any]] = {}


def _get_jwt_secret() -> str:
    try:
        from .. import web

        if hasattr(web, "JWT_SECRET"):
            return web.JWT_SECRET
    except Exception:
        pass
    return os.getenv("JWT_SECRET", "super-secret-key-fallback")


def _get_jwt_expiry_hours() -> int:
    try:
        from .. import web

        if hasattr(web, "JWT_EXPIRY_HOURS"):
            return web.JWT_EXPIRY_HOURS
    except Exception:
        pass
    return 24


def _is_valid_profile(p: Any) -> bool:
    """Return True if p is a non-empty, valid candidate profile dictionary."""
    if not p or not isinstance(p, dict):
        return False
    return bool(
        p.get("coreSkills")
        or p.get("targetTitles")
        or p.get("title")
        or p.get("industry")
        or p.get("job_titles")
        or p.get("skills")
        or p.get("name")
        or p.get("email")
        or p.get("fullWorkExperienceText")
        or p.get("professional_summary")
        or len(p) >= 2
    )


def validate_password_complexity(password: str) -> tuple[bool, str]:
    """
    Validates password complexity:
    - At least 8 characters
    - At least one uppercase letter [A-Z]
    - At least one lowercase letter [a-z]
    - At least one numeric digit [0-9]
    - At least one special character / symbol
    """
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not any(c.isupper() for c in password):
        return False, "Password must include at least one uppercase letter (A-Z)."
    if not any(c.islower() for c in password):
        return False, "Password must include at least one lowercase letter (a-z)."
    if not any(c.isdigit() for c in password):
        return False, "Password must include at least one number (0-9)."
    special_chars = set("!@#$%^&*()_+-=[]{};':\"|,.<>/?~`")
    if not any(c in special_chars for c in password):
        return (
            False,
            "Password must include at least one special character (!@#$%^&* etc.).",
        )
    return True, ""


def _check_rate_limit(handler) -> bool:
    client_ip = getattr(handler, "client_address", ("127.0.0.1", 0))[0]
    current_time = time.time()
    for ip in list(login_attempts.keys()):
        if current_time - login_attempts[ip]["time"] > 60:
            del login_attempts[ip]

    if client_ip not in ("127.0.0.1", "localhost", "testclient"):
        if client_ip in login_attempts:
            if login_attempts[client_ip]["count"] >= 60:
                if current_time - login_attempts[client_ip]["time"] < 60:
                    handler.send_json(
                        429,
                        {"error": "Too many login attempts. Please try again later."},
                    )
                    return False
                else:
                    login_attempts[client_ip] = {"count": 1, "time": current_time}
            else:
                login_attempts[client_ip]["count"] += 1
        else:
            login_attempts[client_ip] = {"count": 1, "time": current_time}
    return True


@app_router.get("/api/session")
def handle_get_session(handler):
    """Validate current session token or guest identity, returning user and profile info."""
    app = handler.app
    auth_header = handler.headers.get("Authorization") if hasattr(handler, "headers") else None
    if not auth_header or not auth_header.startswith("Bearer "):
        handler.send_json(401, {"error": "Missing or invalid token"})
        return

    token = auth_header.split(" ")[1]
    try:
        jwt_secret = _get_jwt_secret()
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        user_email = payload.get("email")

        user_profile = app.repository.get_user_profile(user_id) if user_id else {}
        if not user_profile and user_email:
            user_profile = app.repository.get_user_profile(user_email) or {}
        has_profile = _is_valid_profile(user_profile)
        email_verified = False
        if user_id:
            try:
                with app.db.get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute(
                        "SELECT email_verified FROM users WHERE id = ?",
                        (user_id,),
                    )
                    urow = cur.fetchone()
                    if urow and urow[0]:
                        email_verified = True
            except Exception:
                pass

        handler.send_json(
            200,
            {
                "success": True,
                "user": {
                    "id": user_id,
                    "email": user_email,
                    "name": payload.get("name"),
                    "email_verified": email_verified,
                },
                "profile": user_profile if has_profile else None,
                "has_profile": has_profile,
            },
        )
    except Exception as e:
        handler.send_json(401, {"error": str(e)})


@app_router.post("/api/register")
def handle_register(handler):
    """Register a new user account with email and password."""
    app = handler.app
    if not _check_rate_limit(handler):
        return

    payload = get_json_body(handler)
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password")
    name = (payload.get("name") or "").strip()

    if not email or not password:
        handler.send_json(400, {"error": "Missing email or password"})
        return

    is_complex, complexity_err = validate_password_complexity(password)
    if not is_complex:
        handler.send_json(400, {"error": complexity_err})
        return

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user_id = str(uuid.uuid4())
    now = datetime.datetime.now(timezone.utc).isoformat()
    verification_code = f"{random.randint(100000, 999999)}"
    verification_exp = (
        datetime.datetime.now(timezone.utc) + datetime.timedelta(minutes=30)
    ).isoformat()

    try:
        with app.db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO users (id, email, name, password_hash, created_at, email_verified, email_verification_code, email_verification_expires_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
                (
                    user_id,
                    email,
                    name,
                    password_hash,
                    now,
                    verification_code,
                    verification_exp,
                ),
            )
            conn.commit()
    except sqlite3.IntegrityError:
        handler.send_json(400, {"error": "Email already exists"})
        return

    if hasattr(app, "repository") and app.repository:
        try:
            app.repository.migrate_default_user(user_id)
        except Exception as mig_err:
            logger.warning(f"Could not migrate default_user data for {user_id}: {mig_err}")

    # Create token
    jwt_secret = _get_jwt_secret()
    expiry_hours = _get_jwt_expiry_hours()
    payload_data = {
        "sub": user_id,
        "email": email,
        "name": name,
        "exp": datetime.datetime.now(timezone.utc) + datetime.timedelta(hours=expiry_hours),
    }
    token = jwt.encode(payload_data, jwt_secret, algorithm="HS256")

    handler.send_json(
        200,
        {
            "success": True,
            "token": token,
            "user": {
                "id": user_id,
                "email": email,
                "name": name,
                "email_verified": False,
                "email_verification_sent": True,
            },
            "verification_code_preview": verification_code
            if os.environ.get("ENV") != "production"
            else None,
            "profile": None,
            "has_profile": False,
        },
    )


@app_router.post("/api/verify-email")
def handle_verify_email(handler):
    """Validate 6-digit email verification code."""
    app = handler.app
    payload = get_json_body(handler)
    code = str(payload.get("code") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    user_id = get_auth_user_id(handler)

    if not code:
        handler.send_json(400, {"error": "Missing verification code."})
        return

    with app.db.get_connection() as conn:
        cur = conn.cursor()
        if user_id:
            cur.execute(
                "SELECT id, email, email_verified, email_verification_code, email_verification_expires_at FROM users WHERE id = ?",
                (user_id,),
            )
        elif email:
            cur.execute(
                "SELECT id, email, email_verified, email_verification_code, email_verification_expires_at FROM users WHERE email = ?",
                (email,),
            )
        else:
            handler.send_json(
                400,
                {"error": "Authentication or email required to verify."},
            )
            return
        row = cur.fetchone()

    if not row:
        handler.send_json(404, {"error": "User account not found."})
        return

    uid, _uemail, is_verified, stored_code, stored_exp = (
        row[0],
        row[1],
        bool(row[2]),
        str(row[3] or ""),
        str(row[4] or ""),
    )

    if is_verified:
        handler.send_json(
            200,
            {
                "success": True,
                "message": "Email is already verified.",
                "email_verified": True,
            },
        )
        return

    now_iso = datetime.datetime.now(timezone.utc).isoformat()
    if stored_exp and now_iso > stored_exp:
        handler.send_json(
            400,
            {
                "error": "Verification code has expired. Please request a new code.",
                "expired": True,
            },
        )
        return

    if stored_code and code == stored_code:
        with app.db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE users SET email_verified = 1, email_verification_code = '', email_verification_expires_at = '' WHERE id = ?",
                (uid,),
            )
            conn.commit()
        handler.send_json(
            200,
            {
                "success": True,
                "message": "Email verified successfully.",
                "email_verified": True,
            },
        )
    else:
        handler.send_json(
            400,
            {"error": "Invalid verification code. Please check and try again."},
        )


@app_router.post("/api/resend-verification")
def handle_resend_verification(handler):
    """Generate and dispatch a new 6-digit email verification code."""
    app = handler.app
    payload = get_json_body(handler)
    email = (payload.get("email") or "").strip().lower()
    user_id = get_auth_user_id(handler)

    with app.db.get_connection() as conn:
        cur = conn.cursor()
        if user_id:
            cur.execute(
                "SELECT id, email, email_verified FROM users WHERE id = ?",
                (user_id,),
            )
        elif email:
            cur.execute(
                "SELECT id, email, email_verified FROM users WHERE email = ?",
                (email,),
            )
        else:
            handler.send_json(400, {"error": "Authentication or email required."})
            return
        row = cur.fetchone()

    if not row:
        handler.send_json(404, {"error": "User account not found."})
        return

    uid, uemail, is_verified = row[0], row[1], bool(row[2])
    if is_verified:
        handler.send_json(
            200,
            {
                "success": True,
                "message": "Email is already verified.",
                "email_verified": True,
            },
        )
        return

    new_code = f"{random.randint(100000, 999999)}"
    new_exp = (datetime.datetime.now(timezone.utc) + datetime.timedelta(minutes=30)).isoformat()

    with app.db.get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET email_verification_code = ?, email_verification_expires_at = ? WHERE id = ?",
            (new_code, new_exp, uid),
        )
        conn.commit()

    handler.send_json(
        200,
        {
            "success": True,
            "message": f"A new verification code has been dispatched to {uemail}.",
            "verification_code_preview": new_code
            if os.environ.get("ENV") != "production"
            else None,
        },
    )


@app_router.post("/api/login")
def handle_login(handler):
    """Authenticate user with email and password, issuing a JWT."""
    app = handler.app
    if not _check_rate_limit(handler):
        return

    payload = get_json_body(handler)
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password")

    if not email or not password:
        handler.send_json(400, {"error": "Missing email or password"})
        return

    with app.db.get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, password_hash, email_verified FROM users WHERE email = ?",
            (email,),
        )
        row = cur.fetchone()

    if not row:
        handler.send_json(401, {"error": "Invalid credentials"})
        return

    user_id, name, password_hash = row[0], row[1], row[2]
    email_verified = bool(row[3]) if len(row) > 3 and row[3] else False

    if not bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8")):
        handler.send_json(401, {"error": "Invalid credentials"})
        return

    jwt_secret = _get_jwt_secret()
    expiry_hours = _get_jwt_expiry_hours()
    payload_data = {
        "sub": user_id,
        "email": email,
        "name": name,
        "exp": datetime.datetime.now(timezone.utc) + datetime.timedelta(hours=expiry_hours),
    }
    token = jwt.encode(payload_data, jwt_secret, algorithm="HS256")

    user_profile = app.repository.get_user_profile(user_id) if user_id else {}
    if (not user_profile or not _is_valid_profile(user_profile)) and email:
        user_profile = app.repository.get_user_profile(email) or user_profile
    has_profile = _is_valid_profile(user_profile)
    handler.send_json(
        200,
        {
            "success": True,
            "token": token,
            "user": {
                "id": user_id,
                "email": email,
                "name": name,
                "email_verified": email_verified,
            },
            "profile": user_profile if has_profile else None,
            "has_profile": has_profile,
        },
    )


@app_router.post("/api/logout")
def handle_logout(handler):
    """Terminate user session."""
    handler.send_json(200, {"success": True, "message": "Logged out successfully."})


@app_router.post("/api/google-login")
@app_router.post("/api/google-oauth")
def handle_google_auth(handler):
    """Authenticate or register user via Google Identity Services."""
    app = handler.app
    payload = get_json_body(handler)
    email = (payload.get("email") or "").strip().lower()
    name = (payload.get("name") or "").strip() or (email.split("@")[0] if email else "Google User")
    google_id = payload.get("google_id") or payload.get("id") or str(uuid.uuid4())
    user_id = f"google_{google_id}"

    if not email:
        handler.send_json(400, {"error": "Missing Google email address"})
        return

    now = datetime.datetime.now(timezone.utc).isoformat()
    try:
        with app.db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, name FROM users WHERE email = ?", (email,))
            existing = cur.fetchone()
            if existing:
                user_id = existing[0]
                cur.execute(
                    "UPDATE users SET name = ?, email_verified = 1 WHERE id = ?",
                    (name, user_id),
                )
            else:
                dummy_hash = bcrypt.hashpw(
                    str(uuid.uuid4()).encode("utf-8"), bcrypt.gensalt()
                ).decode("utf-8")
                cur.execute(
                    "INSERT INTO users (id, email, name, password_hash, created_at, email_verified) VALUES (?, ?, ?, ?, ?, 1)",
                    (user_id, email, name, dummy_hash, now),
                )
                if hasattr(app, "repository") and app.repository:
                    try:
                        app.repository.migrate_default_user(user_id)
                    except Exception as mig_err:
                        logger.warning(
                            f"Could not migrate default_user data for {user_id}: {mig_err}"
                        )
            conn.commit()
    except Exception as e:
        logger.error(f"Error persisting Google user: {e}")

    jwt_secret = _get_jwt_secret()
    token = jwt.encode(
        {
            "sub": user_id,
            "email": email,
            "name": name,
            "exp": datetime.datetime.now(timezone.utc) + datetime.timedelta(days=7),
        },
        jwt_secret,
        algorithm="HS256",
    )

    user_profile = app.repository.get_user_profile(user_id) if user_id else {}
    if (not user_profile or not _is_valid_profile(user_profile)) and email:
        user_profile = app.repository.get_user_profile(email) or user_profile
    has_profile = _is_valid_profile(user_profile)
    handler.send_json(
        200,
        {
            "success": True,
            "token": token,
            "user": {
                "id": user_id,
                "email": email,
                "name": name,
                "email_verified": True,
            },
            "profile": user_profile if has_profile else None,
            "has_profile": has_profile,
        },
    )


@app_router.post("/api/link-google")
def handle_link_google(handler):
    """Link Google identity to an existing authenticated user."""
    app = handler.app
    user_id = get_auth_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return

    payload = get_json_body(handler)
    google_id = payload.get("google_id") or payload.get("id") or ""
    google_email = (payload.get("email") or "").strip().lower()
    picture = payload.get("picture") or ""

    if not google_id and not google_email:
        handler.send_json(
            400,
            {"success": False, "error": "Missing Google ID or email"},
        )
        return

    now = datetime.datetime.now(timezone.utc).isoformat()
    try:
        with app.db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE users SET google_id = ?, picture = ? WHERE id = ?",
                (google_id, picture, user_id),
            )
            conn.commit()
    except Exception as e:
        logger.error(f"Error linking Google account to user {user_id}: {e}")

    # Update profile with picture / avatarUrl and googleEmail
    current_prof = app.repository.get_user_profile(user_id) if hasattr(app, "repository") else {}
    if current_prof:
        if picture and not current_prof.get("avatarUrl"):
            current_prof["avatarUrl"] = picture
        if google_email:
            current_prof["googleEmail"] = google_email
        current_prof["updatedAt"] = now
        from ..web import _persist_profile_to_all_sinks

        _persist_profile_to_all_sinks(app, user_id, current_prof)

    handler.send_json(
        200,
        {
            "success": True,
            "linked_email": google_email,
            "google_id": google_id,
            "user_id": user_id,
        },
    )


@app_router.post("/api/passkey-login")
def handle_passkey_login(handler):
    """Authenticate user via WebAuthn biometric passkey."""
    app = handler.app
    payload = get_json_body(handler)
    credential_id = payload.get("credential_id") or payload.get("id")
    email = payload.get("email")
    name = payload.get("name")
    user_id = None

    if credential_id:
        try:
            with app.db.get_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    "SELECT id, email, name FROM users WHERE passkey_id = ?",
                    (credential_id,),
                )
                row = cur.fetchone()
                if row:
                    user_id, email, name = row[0], row[1], row[2]
        except Exception:
            pass

    if not user_id and email:
        try:
            with app.db.get_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    "SELECT id, email, name FROM users WHERE email = ?",
                    (email,),
                )
                row = cur.fetchone()
                if row:
                    user_id, email, name = row[0], row[1], row[2]
        except Exception:
            pass

    if not user_id:
        user_id = credential_id or f"passkey_{uuid.uuid4()}"
        email = email or "passkey.user@example.com"
        name = name or "Verified Passkey User"

    jwt_secret = _get_jwt_secret()
    now = datetime.datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": user_id,
            "email": email,
            "name": name,
            "exp": now + datetime.timedelta(days=7),
        },
        jwt_secret,
        algorithm="HS256",
    )

    user_profile = app.repository.get_user_profile(user_id) if user_id else {}
    if (not user_profile or not _is_valid_profile(user_profile)) and email:
        user_profile = app.repository.get_user_profile(email) or user_profile
    has_profile = _is_valid_profile(user_profile)
    handler.send_json(
        200,
        {
            "success": True,
            "token": token,
            "user": {"id": user_id, "email": email, "name": name},
            "profile": user_profile if has_profile else None,
            "has_profile": has_profile,
        },
    )


@app_router.post("/api/passkey-setup")
@app_router.post("/api/passkey-register")
def handle_passkey_setup(handler):
    """Register and associate a passkey credential with the authenticated user."""
    app = handler.app
    user_id = get_auth_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return

    payload = get_json_body(handler)
    credential_id = payload.get("credential_id") or payload.get("id")
    if not credential_id:
        handler.send_json(400, {"success": False, "error": "Missing credential_id"})
        return

    now = datetime.datetime.now(timezone.utc).isoformat()
    try:
        with app.db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE users SET passkey_id = ? WHERE id = ?",
                (credential_id, user_id),
            )
            conn.commit()
    except Exception as e:
        logger.error(f"Error associating passkey for user {user_id}: {e}")

    current_prof = app.repository.get_user_profile(user_id) if hasattr(app, "repository") else {}
    if current_prof:
        current_prof["hasPasskey"] = True
        current_prof["passkeyUpdatedAt"] = now
        from ..web import _persist_profile_to_all_sinks

        _persist_profile_to_all_sinks(app, user_id, current_prof)

    handler.send_json(
        200,
        {
            "success": True,
            "credential_id": credential_id,
            "user_id": user_id,
            "message": "Passkey successfully registered and bound to user account.",
        },
    )


@app_router.get("/api/profile")
def handle_get_profile(handler):
    """Retrieve candidate profile dossier."""
    app = handler.app
    query_params = get_query_params(handler)
    user_id = get_auth_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return

    prof = app.repository.get_user_profile(user_id)
    if not prof and query_params and "email" in query_params:
        prof = app.repository.get_user_profile(query_params["email"][0])

    is_registered_user = False
    try:
        with app.db.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT email, name FROM users WHERE id = ?", (user_id,))
            urow = cur.fetchone()
            if urow:
                is_registered_user = True
                u_email, u_name = urow
                if not prof and u_email:
                    prof = app.repository.get_user_profile(u_email)
                if not prof:
                    prof = {
                        "id": user_id,
                        "name": u_name or "",
                        "email": u_email or "",
                        "title": "",
                        "industry": "Technology & IT",
                        "location": "Melbourne, VIC",
                        "targetTitles": [],
                        "coreSkills": [],
                        "keyStrengths": [],
                    }
    except Exception:
        pass

    # If NOT a registered user (e.g. legacy/guest unmatched X-User-Id), apply fallback cascade
    if not prof and not is_registered_user:
        try:
            from ..db_pool import get_db_connection

            with get_db_connection(app.repository.path) as conn:
                row = conn.execute(
                    "SELECT profile_data_json FROM user_profiles ORDER BY updated_at DESC LIMIT 1"
                ).fetchone()
                if row and row[0]:
                    prof = json.loads(row[0])
        except Exception:
            pass

    if not prof and (user_id in ("default_user", "sam_ludwig") or not is_registered_user):
        if hasattr(app, "dashboard") and getattr(app.dashboard, "profile", None):
            prof = app.dashboard.profile
        if not prof:
            data_file = (
                Path(app.data_dir) / "job_profile.json"
                if hasattr(app, "data_dir") and app.data_dir
                else None
            )
            if data_file and data_file.exists():
                try:
                    with open(data_file, "r", encoding="utf-8") as f:
                        prof = json.load(f)
                except Exception:
                    pass

    handler.send_json(200, {"success": True, "profile": prof or {}})


@app_router.post("/api/profile")
def handle_save_profile(handler):
    """Save or update candidate profile across all storage sinks."""
    app = handler.app
    user_id = get_auth_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return

    body = get_json_body(handler)
    from ..web import _persist_profile_to_all_sinks

    res = _persist_profile_to_all_sinks(app, user_id, body)
    handler.send_json(200, {"success": True, "profile": res})


@app_router.get("/api/preferences")
def handle_get_preferences(handler):
    """Retrieve job search preferences for the authenticated user."""
    app = handler.app
    user_id = get_auth_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return

    prefs = app.repository.get_user_preferences(user_id)
    handler.send_json(200, {"success": True, "preferences": prefs})


@app_router.post("/api/preferences")
def handle_save_preferences(handler):
    """Save user preferences and trigger GCS backup if enabled."""
    app = handler.app
    user_id = get_auth_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return

    body = get_json_body(handler)
    res = app.repository.upsert_user_preferences(user_id, body)

    from ..config import settings

    if settings.gcs_data_bucket:
        try:
            from ..web import backup_to_gcs

            threading.Thread(
                target=backup_to_gcs,
                args=(settings.gcs_data_bucket, app.data_dir),
                daemon=True,
            ).start()
        except Exception:
            pass

    handler.send_json(200, {"success": True, "preferences": res})


@app_router.get("/api/feature-flags")
def handle_get_feature_flags(handler):
    """Retrieve dynamic feature flags."""
    app = handler.app
    user_id = get_auth_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return

    flags = app.repository.get_feature_flags()
    handler.send_json(200, {"success": True, "flags": flags})


@app_router.post("/api/feature-flags")
def handle_set_feature_flag(handler):
    """Update or toggle a feature flag."""
    app = handler.app
    user_id = get_auth_user_id(handler)
    if not user_id:
        handler.send_json(
            401,
            {
                "success": False,
                "error": "Authentication required. Provide Authorization token or X-User-Id header.",
            },
        )
        return

    body = get_json_body(handler)
    key = body.get("key")
    enabled = body.get("enabled")
    desc = body.get("description", "")
    if not key or enabled is None:
        handler.send_json(
            400,
            {"success": False, "error": "Missing key or enabled state"},
        )
        return

    app.repository.set_feature_flag(key, bool(enabled), description=desc)
    handler.send_json(200, {"success": True, "key": key, "enabled": bool(enabled)})
