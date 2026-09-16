import io
import json
import pytest
from unittest.mock import MagicMock
from job_dashboard.repository import JobRepository
from job_dashboard.web import make_handler, DashboardApp

@pytest.fixture
def test_app_and_handler(tmp_path):
    repo = JobRepository(str(tmp_path / "test.db"))
    app = DashboardApp(profile={}, sources=[], data_dir=tmp_path)
    app.repository = repo
    app.db = repo

    with repo.get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                google_id TEXT,
                picture TEXT,
                passkey_id TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id TEXT PRIMARY KEY,
                profile_data_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.commit()

    handler_cls = make_handler(app)
    return app, handler_cls

def create_mock_handler(handler_cls, method, path, body=None, headers=None):
    handler = handler_cls.__new__(handler_cls)
    handler.path = path
    headers_dict = headers.copy() if headers else {}
    if body is not None:
        payload = json.dumps(body).encode("utf-8") if isinstance(body, dict) else body.encode("utf-8")
        headers_dict["Content-Length"] = str(len(payload))
        handler.rfile = io.BytesIO(payload)
    else:
        handler.rfile = io.BytesIO()
    handler.headers = headers_dict
    handler.client_address = ("127.0.0.1", 12345)
    handler.wfile = io.BytesIO()
    handler.send_response = MagicMock()
    handler.send_header = MagicMock()
    handler.end_headers = MagicMock()
    return handler

def parse_response(handler):
    handler.wfile.seek(0)
    data = handler.wfile.read()
    if not data:
        return {}
    return json.loads(data.decode("utf-8"))

def test_user_registration_success(test_app_and_handler):
    app, handler_cls = test_app_and_handler

    handler = create_mock_handler(
        handler_cls,
        "POST",
        "/api/register",
        body={"name": "Alice Candidate", "email": "alice@example.com", "password": "SecurePassword123!"}
    )
    handler.do_POST()
    assert handler.send_response.call_args[0][0] == 200
    res = parse_response(handler)
    assert res["success"] is True
    assert "token" in res
    assert res["user"]["email"] == "alice@example.com"
    assert res["user"]["name"] == "Alice Candidate"

def test_user_registration_duplicate_email(test_app_and_handler):
    app, handler_cls = test_app_and_handler

    handler1 = create_mock_handler(
        handler_cls,
        "POST",
        "/api/register",
        body={"name": "Bob", "email": "bob@example.com", "password": "Password123"}
    )
    handler1.do_POST()
    assert handler1.send_response.call_args[0][0] == 200

    handler2 = create_mock_handler(
        handler_cls,
        "POST",
        "/api/register",
        body={"name": "Bob Duplicate", "email": "bob@example.com", "password": "DifferentPassword"}
    )
    handler2.do_POST()
    assert handler2.send_response.call_args[0][0] == 400
    res = parse_response(handler2)
    assert "already exists" in res["error"].lower()

def test_user_login_success_and_failure(test_app_and_handler):
    app, handler_cls = test_app_and_handler

    # 1. Register
    reg_handler = create_mock_handler(
        handler_cls,
        "POST",
        "/api/register",
        body={"name": "Charlie", "email": "charlie@example.com", "password": "CorrectPassword"}
    )
    reg_handler.do_POST()
    assert reg_handler.send_response.call_args[0][0] == 200

    # 2. Login wrong password -> 401
    bad_login = create_mock_handler(
        handler_cls,
        "POST",
        "/api/login",
        body={"email": "charlie@example.com", "password": "WrongPassword"}
    )
    bad_login.do_POST()
    assert bad_login.send_response.call_args[0][0] == 401

    # 3. Login correct password -> 200
    good_login = create_mock_handler(
        handler_cls,
        "POST",
        "/api/login",
        body={"email": "charlie@example.com", "password": "CorrectPassword"}
    )
    good_login.do_POST()
    assert good_login.send_response.call_args[0][0] == 200
    res = parse_response(good_login)
    assert res["success"] is True
    assert "token" in res
    assert res["user"]["email"] == "charlie@example.com"

def test_multi_user_profile_isolation(test_app_and_handler):
    """Verify that User B does not receive User A's private profile on registration or fetch."""
    app, handler_cls = test_app_and_handler

    # User A registers & saves profile
    reg_a = create_mock_handler(
        handler_cls,
        "POST",
        "/api/register",
        body={"name": "User A", "email": "usera@example.com", "password": "PasswordA123"}
    )
    reg_a.do_POST()
    token_a = parse_response(reg_a)["token"]
    user_a_id = parse_response(reg_a)["user"]["id"]

    prof_save_a = create_mock_handler(
        handler_cls,
        "POST",
        "/api/profile",
        body={"name": "User A", "email": "usera@example.com", "title": "Senior Secret Engineer", "phone": "0400000001"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    prof_save_a.do_POST()
    assert prof_save_a.send_response.call_args[0][0] == 200

    # User B registers
    reg_b = create_mock_handler(
        handler_cls,
        "POST",
        "/api/register",
        body={"name": "User B", "email": "userb@example.com", "password": "PasswordB123"}
    )
    reg_b.do_POST()
    token_b = parse_response(reg_b)["token"]
    user_b_id = parse_response(reg_b)["user"]["id"]

    # User B fetches profile -> must NOT see User A's title
    get_prof_b = create_mock_handler(
        handler_cls,
        "GET",
        "/api/profile",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    get_prof_b.do_GET()
    assert get_prof_b.send_response.call_args[0][0] == 200
    res_b = parse_response(get_prof_b)
    prof_b = res_b.get("profile") or {}
    assert prof_b.get("title") != "Senior Secret Engineer"
    assert prof_b.get("email") != "usera@example.com"

def test_link_google_account(test_app_and_handler):
    app, handler_cls = test_app_and_handler

    # Register email user
    reg = create_mock_handler(
        handler_cls,
        "POST",
        "/api/register",
        body={"name": "David", "email": "david@example.com", "password": "Password123"}
    )
    reg.do_POST()
    token = parse_response(reg)["token"]

    # Link Google account
    link_handler = create_mock_handler(
        handler_cls,
        "POST",
        "/api/link-google",
        body={"google_id": "google_sub_9999", "email": "david.google@gmail.com", "picture": "https://example.com/pic.jpg"},
        headers={"Authorization": f"Bearer {token}"}
    )
    link_handler.do_POST()
    assert link_handler.send_response.call_args[0][0] == 200
    link_res = parse_response(link_handler)
    assert link_res["success"] is True
    assert link_res["linked_email"] == "david.google@gmail.com"

def test_passkey_setup_and_login(test_app_and_handler):
    app, handler_cls = test_app_and_handler

    # 1. Register candidate user
    reg = create_mock_handler(
        handler_cls,
        "POST",
        "/api/register",
        body={"name": "Elena Passkey", "email": "elena@example.com", "password": "Password123"}
    )
    reg.do_POST()
    token = parse_response(reg)["token"]
    user_id = parse_response(reg)["user"]["id"]

    # 2. Setup passkey
    passkey_credential_id = "test_device_webauthn_raw_id_xyz789=="
    setup_handler = create_mock_handler(
        handler_cls,
        "POST",
        "/api/passkey-setup",
        body={"credential_id": passkey_credential_id, "credential_type": "webauthn_passkey"},
        headers={"Authorization": f"Bearer {token}"}
    )
    setup_handler.do_POST()
    assert setup_handler.send_response.call_args[0][0] == 200
    setup_res = parse_response(setup_handler)
    assert setup_res["success"] is True
    assert setup_res["credential_id"] == passkey_credential_id

    # 3. Authenticate with passkey without password
    login_handler = create_mock_handler(
        handler_cls,
        "POST",
        "/api/passkey-login",
        body={"credential_id": passkey_credential_id, "credential_type": "webauthn_passkey"}
    )
    login_handler.do_POST()
    assert login_handler.send_response.call_args[0][0] == 200
    login_res = parse_response(login_handler)
    assert login_res["success"] is True
    assert "token" in login_res
    assert login_res["user"]["email"] == "elena@example.com"
    assert login_res["user"]["name"] == "Elena Passkey"
    assert login_res["user"]["id"] == user_id

