import pytest

from job_dashboard.security import SecurityManager


def test_security_manager_creates_and_verifies_expiring_jwt(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret")
    manager = SecurityManager()

    token = manager.create_token({"sub": "user-1"}, expires_minutes=5)

    assert manager.verify_token(token)["sub"] == "user-1"


def test_security_manager_raises_in_production_without_jwt_secret(monkeypatch):
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")

    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY environment variable is required"):
        SecurityManager()


def test_security_manager_succeeds_in_production_with_jwt_secret(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET_KEY", "persistent-prod-secret-1234567890")

    manager = SecurityManager()
    assert manager.secret_key == "persistent-prod-secret-1234567890"


def test_password_hashing_uses_bcrypt_and_verifies():
    manager = SecurityManager()
    pwd = "SuperSecretPassword123!"
    hashed = manager.hash_password(pwd)
    assert hashed.startswith("$2")
    assert manager.verify_password(pwd, hashed) is True
    assert manager.verify_password("WrongPassword", hashed) is False


def test_password_hashing_fails_when_secure_libraries_unavailable(monkeypatch):
    import job_dashboard.security as sec
    monkeypatch.setattr(sec, "BCRYPT_AVAILABLE", False)
    monkeypatch.setattr(sec, "PASSLIB_AVAILABLE", False)

    manager = SecurityManager()
    with pytest.raises(RuntimeError, match="Insecure password hashing fallback is disabled"):
        manager.hash_password("password")


def test_request_identity_uses_bearer_subject_not_caller_supplied_ids(monkeypatch):
    from types import SimpleNamespace

    from job_dashboard import web
    from job_dashboard.router import get_auth_user_id

    monkeypatch.setattr(web, "JWT_SECRET", "test-handler-secret")
    spoofed_handler = SimpleNamespace(
        headers={"X-User-Id": "victim"},
        path="/api/profile?user_id=victim&demo=true",
    )

    assert web.resolve_user_id(spoofed_handler, {"user_id": ["victim"]}) is None
    assert get_auth_user_id(spoofed_handler) is None

    import jwt
    token = jwt.encode(
        {"sub": "verified-user"}, "test-handler-secret", algorithm="HS256"
    )
    authenticated_handler = SimpleNamespace(
        headers={"Authorization": f"Bearer {token}", "X-User-Id": "victim"},
        path="/api/profile?user_id=victim",
    )

    assert web.resolve_user_id(authenticated_handler, {"user_id": ["victim"]}) == "verified-user"
    assert get_auth_user_id(authenticated_handler) == "verified-user"


def test_decorated_route_identity_adapters_ignore_user_id_queries():
    from types import SimpleNamespace

    from job_dashboard.routes.ai import _resolve_user_id as resolve_ai_user_id
    from job_dashboard.routes.jobs import _resolve_user_id as resolve_job_user_id
    from job_dashboard.routes.scrape import _resolve_user_id as resolve_scrape_user_id

    handler = SimpleNamespace(
        headers={}, path="/api/private?user_id=victim"
    )
    spoofed_query = {"user_id": ["victim"]}

    assert resolve_ai_user_id(handler, spoofed_query) is None
    assert resolve_job_user_id(handler, spoofed_query) is None
    assert resolve_scrape_user_id(handler, spoofed_query) is None

