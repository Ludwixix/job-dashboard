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

