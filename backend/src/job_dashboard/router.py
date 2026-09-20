"""HTTP Router and request helpers for job dashboard."""

from __future__ import annotations

import json
import os
import re
import typing
from urllib.parse import parse_qs, urlparse

try:
    import jwt
except ImportError:
    jwt = None


class Router:
    """Lightweight HTTP Router supporting prioritized static routes and regex patterns."""

    def __init__(self):
        self.static_routes: dict[str, dict[str, typing.Callable]] = {
            "GET": {},
            "POST": {},
            "PUT": {},
            "DELETE": {},
            "OPTIONS": {},
        }
        self.regex_routes: dict[str, list[tuple[typing.Pattern, typing.Callable]]] = {
            "GET": [],
            "POST": [],
            "PUT": [],
            "DELETE": [],
            "OPTIONS": [],
        }

    def register(self, method: str, pattern: str, handler: typing.Callable):
        """
        Register a route handler.
        pattern can be an exact string (e.g., '/api/session') or a regex pattern (e.g., r'^/api/jobs/(?P<job_id>[^/]+)$').
        handler should be a function that accepts (request_handler, **kwargs).
        """
        method = method.upper()
        if method not in self.static_routes:
            self.static_routes[method] = {}
            self.regex_routes[method] = []

        # If pattern does not look like regex (no regex group or anchor syntax), treat as static
        is_regex = any(
            char in pattern for char in ("^", "$", "(?P", "(", ")", "[", "]", "*", "+", "?")
        )
        if not is_regex:
            norm_pattern = pattern.rstrip("/") if pattern != "/" else "/"
            self.static_routes[method][norm_pattern] = handler
            if norm_pattern != "/":
                self.static_routes[method][norm_pattern + "/"] = handler
            else:
                self.static_routes[method]["/"] = handler
        else:
            regex_str = pattern
            if not regex_str.startswith("^"):
                regex_str = f"^{regex_str}"
            if not regex_str.endswith("$"):
                regex_str = f"{regex_str}$"
            compiled = re.compile(regex_str)
            self.regex_routes[method].append((compiled, handler))

    def get(self, pattern: str):
        def decorator(func: typing.Callable):
            self.register("GET", pattern, func)
            return func

        return decorator

    def post(self, pattern: str):
        def decorator(func: typing.Callable):
            self.register("POST", pattern, func)
            return func

        return decorator

    def put(self, pattern: str):
        def decorator(func: typing.Callable):
            self.register("PUT", pattern, func)
            return func

        return decorator

    def delete(self, pattern: str):
        def decorator(func: typing.Callable):
            self.register("DELETE", pattern, func)
            return func

        return decorator

    def dispatch(self, request_handler, method: str, path: str) -> bool:
        """
        Attempt to route the request.
        Strips query parameters before matching and prioritizes static routes.
        Returns True if a handler was found and executed, False otherwise.
        """
        method = method.upper()
        clean_path = urlparse(path).path if path else "/"

        # 1. Prioritize static exact match
        if method in self.static_routes:
            handler_func = self.static_routes[method].get(clean_path)
            if not handler_func and clean_path.endswith("/") and clean_path != "/":
                handler_func = self.static_routes[method].get(clean_path.rstrip("/"))
            elif not handler_func and not clean_path.endswith("/"):
                handler_func = self.static_routes[method].get(clean_path + "/")

            if handler_func:
                handler_func(request_handler)
                return True

        # 2. Parameterized regex match
        if method in self.regex_routes:
            for compiled_pattern, handler_func in self.regex_routes[method]:
                match = compiled_pattern.match(clean_path)
                if match:
                    kwargs = match.groupdict()
                    if kwargs:
                        handler_func(request_handler, **kwargs)
                    else:
                        handler_func(request_handler)
                    return True

        return False


# Global router instance for the application
app_router = Router()


def get_json_body(handler) -> dict:
    """Safely extract and parse JSON body from request handler, caching on handler."""
    if hasattr(handler, "_cached_json_body"):
        return handler._cached_json_body

    body: dict = {}
    try:
        headers = getattr(handler, "headers", None)
        rfile = getattr(handler, "rfile", None)
        if headers is not None and rfile is not None:
            content_len = int(headers.get("Content-Length", "0"))
            if content_len > 0:
                raw = rfile.read(content_len)
                if raw:
                    if isinstance(raw, str):
                        body = json.loads(raw)
                    else:
                        body = json.loads(raw.decode("utf-8"))
    except Exception:
        body = {}

    if isinstance(body, (dict, list)):
        handler._cached_json_body = body
    else:
        body = {}
    return body


def get_query_params(handler) -> dict[str, list[str]]:
    """Extract query parameters as a dictionary of lists from handler.path."""
    try:
        path = getattr(handler, "path", "")
        if not path:
            return {}
        parsed = urlparse(path)
        return parse_qs(parsed.query)
    except Exception:
        return {}


def get_auth_user_id(handler) -> str | None:
    """
    Resolve authenticated user ID from Authorization header (Bearer token),
    X-User-Id header, or query parameters.
    """
    try:
        headers = getattr(handler, "headers", None)
        if headers:
            auth_header = headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1].strip()
                try:
                    from .security import decode_token

                    decoded = decode_token(token)
                    if decoded and decoded.get("sub"):
                        return str(decoded["sub"])
                except Exception:
                    pass

                try:
                    if jwt is not None:
                        jwt_secret = os.getenv("JWT_SECRET", "super-secret-key-fallback")
                        try:
                            from . import web

                            if hasattr(web, "JWT_SECRET"):
                                jwt_secret = web.JWT_SECRET
                        except Exception:
                            pass
                        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
                        sub = payload.get("sub")
                        if sub:
                            return str(sub)
                except Exception:
                    pass

            uid = headers.get("X-User-Id")
            if uid and str(uid).strip():
                return str(uid).strip()

        query_params = get_query_params(handler)
        if query_params and "user_id" in query_params:
            param_val = str(query_params["user_id"][0]).strip()
            if param_val:
                return param_val
        if query_params and query_params.get("demo", [""])[0].lower() in ("true", "1"):
            return "demo_user"
    except Exception:
        pass
    return None
