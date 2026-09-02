from job_dashboard.security import SecurityManager


def test_security_manager_creates_and_verifies_expiring_jwt(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret")
    manager = SecurityManager()

    token = manager.create_token({"sub": "user-1"}, expires_minutes=5)

    assert manager.verify_token(token)["sub"] == "user-1"