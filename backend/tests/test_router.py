import json
import os
from unittest.mock import MagicMock, patch

import pytest
import jwt

from job_dashboard.router import Router, get_json_body, get_query_params, get_auth_user_id


def test_router_initialization():
    router = Router()
    methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    for m in methods:
        assert m in router.static_routes
        assert m in router.regex_routes
        assert router.static_routes[m] == {}
        assert router.regex_routes[m] == []


def test_router_static_registration():
    router = Router()
    handler = MagicMock()

    router.register("GET", "/api/test", handler)

    # Check registration variations
    assert "/api/test" in router.static_routes["GET"]
    assert "/api/test/" in router.static_routes["GET"]

    router.register("POST", "/", handler)
    assert "/" in router.static_routes["POST"]


def test_router_regex_registration():
    router = Router()
    handler = MagicMock()

    router.register("GET", r"^/api/jobs/(?P<job_id>[^/]+)$", handler)

    # Verify it was added to regex routes, not static
    assert len(router.regex_routes["GET"]) == 1
    assert len(router.static_routes["GET"]) == 0

    pattern, registered_handler = router.regex_routes["GET"][0]
    assert pattern.pattern == r"^^/api/jobs/(?P<job_id>[^/]+)$$" or pattern.pattern == r"^/api/jobs/(?P<job_id>[^/]+)$" # Router wraps with ^ and $


def test_router_decorators():
    router = Router()

    @router.get("/get")
    def get_handler(): pass

    @router.post("/post")
    def post_handler(): pass

    @router.put("/put")
    def put_handler(): pass

    @router.delete("/delete")
    def delete_handler(): pass

    @router.patch("/patch")
    def patch_handler(): pass

    assert "/get" in router.static_routes["GET"]
    assert "/post" in router.static_routes["POST"]
    assert "/put" in router.static_routes["PUT"]
    assert "/delete" in router.static_routes["DELETE"]
    assert "/patch" in router.static_routes["PATCH"]


def test_router_dispatch_static():
    router = Router()
    handler_mock = MagicMock()
    request_mock = MagicMock()

    router.register("GET", "/api/data", handler_mock)

    # Dispatch with exact match
    assert router.dispatch(request_mock, "GET", "/api/data") is True
    handler_mock.assert_called_once_with(request_mock)

    handler_mock.reset_mock()

    # Dispatch with trailing slash match
    assert router.dispatch(request_mock, "GET", "/api/data/") is True
    handler_mock.assert_called_once_with(request_mock)

    # Dispatch to unknown route
    assert router.dispatch(request_mock, "GET", "/unknown") is False


def test_router_dispatch_regex():
    router = Router()
    handler_mock = MagicMock()
    request_mock = MagicMock()

    router.register("GET", r"/api/jobs/(?P<job_id>[0-9]+)", handler_mock)

    # Dispatch regex match
    assert router.dispatch(request_mock, "GET", "/api/jobs/123") is True
    handler_mock.assert_called_once_with(request_mock, job_id="123")

    handler_mock.reset_mock()

    # Dispatch regex mismatch
    assert router.dispatch(request_mock, "GET", "/api/jobs/abc") is False


def test_router_dispatch_with_query_params():
    router = Router()
    handler_mock = MagicMock()
    request_mock = MagicMock()

    router.register("GET", "/search", handler_mock)

    assert router.dispatch(request_mock, "GET", "/search?q=test&page=1") is True
    handler_mock.assert_called_once_with(request_mock)


def test_get_json_body_valid():
    handler = MagicMock(spec=["headers", "rfile"])
    # Delete mock auto-created property since hasattr(handler, "_cached_json_body") is true for MagicMock initially if we dont delete or spece
    if hasattr(handler, "_cached_json_body"):
        del handler._cached_json_body

    body_data = {"key": "value"}
    handler.headers = {"Content-Length": str(len(json.dumps(body_data)))}
    handler.rfile.read.return_value = json.dumps(body_data).encode("utf-8")

    result = get_json_body(handler)
    assert result == body_data

    # Check caching
    assert getattr(handler, "_cached_json_body") == body_data

    # Call again to verify cache is used (read not called again)
    handler.rfile.read.reset_mock()
    result2 = get_json_body(handler)
    assert result2 == body_data
    handler.rfile.read.assert_not_called()


def test_get_json_body_invalid_json():
    handler = MagicMock(spec=["headers", "rfile"])
    if hasattr(handler, "_cached_json_body"):
        del handler._cached_json_body
    handler.headers = {"Content-Length": "10"}
    handler.rfile.read.return_value = b"not json!"

    result = get_json_body(handler)
    assert result == {}


def test_get_json_body_no_content_length():
    handler = MagicMock(spec=["headers", "rfile"])
    if hasattr(handler, "_cached_json_body"):
        del handler._cached_json_body
    handler.headers = {}

    result = get_json_body(handler)
    assert result == {}


def test_get_query_params():
    handler = MagicMock()

    # Test valid query params
    handler.path = "/api/test?param1=value1&param2=value2&param2=value3"
    params = get_query_params(handler)
    assert params == {"param1": ["value1"], "param2": ["value2", "value3"]}

    # Test no query params
    handler.path = "/api/test"
    params = get_query_params(handler)
    assert params == {}

    # Test no path
    handler.path = None
    params = get_query_params(handler)
    assert params == {}


def test_get_auth_user_id_demo_mode(monkeypatch):
    monkeypatch.setenv("JOB_DASHBOARD_ENABLE_DEMO_AUTH", "1")
    handler = MagicMock()
    handler.headers = {}
    handler.path = "/api/test?demo=1"

    user_id = get_auth_user_id(handler)
    assert user_id == "demo_user"


def test_get_auth_user_id_invalid_demo_mode(monkeypatch):
    monkeypatch.setenv("JOB_DASHBOARD_ENABLE_DEMO_AUTH", "0")
    handler = MagicMock()
    handler.headers = {}
    handler.path = "/api/test?demo=1"

    user_id = get_auth_user_id(handler)
    assert user_id is None


@patch("job_dashboard.security.decode_token", create=True)
def test_get_auth_user_id_valid_token(mock_decode_token):
    mock_decode_token.return_value = {"sub": "user_123"}

    handler = MagicMock()
    handler.headers = {"Authorization": "Bearer valid_token"}

    user_id = get_auth_user_id(handler)
    assert user_id == "user_123"


@patch("job_dashboard.security.decode_token", create=True)
def test_get_auth_user_id_invalid_token(mock_decode_token):
    mock_decode_token.side_effect = Exception("Invalid token")

    handler = MagicMock()
    handler.headers = {"Authorization": "Bearer invalid_token"}

    # If job_dashboard.security.decode_token fails, it tries jwt.decode
    with patch("jwt.decode") as mock_jwt_decode:
        mock_jwt_decode.side_effect = Exception("Invalid token")
        user_id = get_auth_user_id(handler)
        assert user_id is None


def test_get_auth_user_id_missing_bearer():
    handler = MagicMock()
    handler.headers = {"Authorization": "Basic something"}

    user_id = get_auth_user_id(handler)
    assert user_id is None


@patch("job_dashboard.security.decode_token", create=True)
def test_get_auth_user_id_jwt_fallback(mock_decode_token):
    # Simulate security.decode_token failing or returning no sub
    mock_decode_token.side_effect = Exception("Module not found")

    handler = MagicMock()
    handler.headers = {"Authorization": "Bearer fallback_token"}

    with patch("jwt.decode") as mock_jwt_decode:
        mock_jwt_decode.return_value = {"sub": "fallback_user"}
        user_id = get_auth_user_id(handler)
        assert user_id == "fallback_user"
