---
name: auth-session-troubleshooting
description: Use when debugging or verifying Google OAuth / Identity Services (GIS), passkeys, JWT authentication, profile persistence, and dual-indexed session restoration across reloads.
---

# Authentication & Profile Persistence Troubleshooting Workflow

## Trigger Conditions
- User logs in via Google Identity Services or Passkey, but session is lost on page reload.
- Profile details (name, email, skills, target roles, career history) reset to default or get overwritten by fallback mock candidate data.
- 401 Unauthorized or 403 Forbidden responses on protected endpoints (`/api/profile`, `/api/applications`, `/api/documents`).
- Inconsistent session state between client `localStorage` and backend SQLite database.

## System Architecture & Dual-Indexing
1. **User Identity Resolution**:
   - Backend supports token-based JWT (`Authorization: Bearer <jwt>`) and user identity header (`X-User-Id`).
   - SQLite tables: `users` (core credentials / auth provider), `user_profiles` (full structured profile JSON indexed by `user_id` AND `email`).
2. **Dual-Index Profile Recovery**:
   - Google GIS users may have IDs formatted as numeric Google Subject IDs (`102938...`), UUIDs, or email addresses.
   - When retrieving profile, the backend first checks `user_id`, then falls back to `email` lookup to guarantee existing candidate profiles are never orphaned.
3. **Session Restoration Lifecycle**:
   - Frontend stores auth token in `localStorage['job_dashboard_auth_token']`.
   - On initial app boot, `authService.validateSession()` calls `GET /api/session`.
   - If valid, the authenticated user object is returned, profile is fetched from backend `/api/profile`, and `auth-changed` and `profile-updated` custom window events are dispatched to synchronize all React context hooks.

## Diagnostic Steps
1. **Inspect Token Validation**:
   - Check if JWT token has expired or is malformed:
     ```bash
     curl -v -H "Authorization: Bearer <TOKEN>" https://job-dashboard-6xrdvjlrcq-ts.a.run.app/api/session
     ```
2. **Verify Database Profile Persistence**:
   - Run the persistence test suite:
     ```bash
     cd /home/s/.openclaw/workspace/job-dashboard/backend
     python3 -m pytest tests/test_profile_persistence.py -v
     ```
3. **Inspect LocalStorage Keys**:
   - In browser DevTools Console, verify:
     - `localStorage.getItem('job_dashboard_auth_token')`
     - `localStorage.getItem('job_dashboard_user')`
     - `localStorage.getItem('career_agent_site_unlocked') === 'true'`
4. **Inspect Dual-Index Database State**:
   - Query SQLite directly if debugging local instance:
     ```bash
     sqlite3 data/jobs.sqlite3 "SELECT user_id, updated_at FROM user_profiles;"
     ```
