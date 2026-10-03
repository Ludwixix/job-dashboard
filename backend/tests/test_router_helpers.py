import json
import pytest
from job_dashboard.router import get_json_body

class MockRFile:
    def __init__(self, data, fail=False):
        self.data = data
        self.fail = fail

    def read(self, length):
        if self.fail:
            raise Exception("Simulated read error")
        return self.data


class MockHandler:
    def __init__(self, headers=None, rfile=None):
        if headers is not None:
            self.headers = headers
        if rfile is not None:
            self.rfile = rfile


def test_get_json_body_cached():
    handler = MockHandler()
    handler._cached_json_body = {"key": "value"}
    assert get_json_body(handler) == {"key": "value"}


def test_get_json_body_missing_headers_or_rfile():
    handler = MockHandler()
    assert get_json_body(handler) == {}

    handler_no_rfile = MockHandler(headers={"Content-Length": "10"})
    assert get_json_body(handler_no_rfile) == {}

    handler_no_headers = MockHandler(rfile=MockRFile(b"{}"))
    assert get_json_body(handler_no_headers) == {}


def test_get_json_body_missing_content_length():
    handler = MockHandler(headers={}, rfile=MockRFile(b"{}"))
    assert get_json_body(handler) == {}
    assert hasattr(handler, "_cached_json_body")
    assert getattr(handler, "_cached_json_body") == {}


def test_get_json_body_valid_json_bytes():
    data = {"test": "data"}
    encoded = json.dumps(data).encode("utf-8")
    handler = MockHandler(
        headers={"Content-Length": str(len(encoded))},
        rfile=MockRFile(encoded)
    )
    assert get_json_body(handler) == data
    assert handler._cached_json_body == data


def test_get_json_body_valid_json_string():
    data = {"test": "data"}
    encoded = json.dumps(data)
    handler = MockHandler(
        headers={"Content-Length": str(len(encoded))},
        rfile=MockRFile(encoded)
    )
    assert get_json_body(handler) == data
    assert handler._cached_json_body == data


def test_get_json_body_invalid_json():
    encoded = b"{invalid_json"
    handler = MockHandler(
        headers={"Content-Length": str(len(encoded))},
        rfile=MockRFile(encoded)
    )
    assert get_json_body(handler) == {}
    assert handler._cached_json_body == {}


def test_get_json_body_read_exception():
    handler = MockHandler(
        headers={"Content-Length": "10"},
        rfile=MockRFile(b"", fail=True)
    )
    assert get_json_body(handler) == {}
    assert handler._cached_json_body == {}


def test_get_json_body_not_dict_or_list():
    # Number
    encoded = json.dumps(123).encode("utf-8")
    handler = MockHandler(
        headers={"Content-Length": str(len(encoded))},
        rfile=MockRFile(encoded)
    )
    assert get_json_body(handler) == {}

    # Needs a new handler since the previous one is cached
    # String
    encoded2 = json.dumps("string").encode("utf-8")
    handler2 = MockHandler(
        headers={"Content-Length": str(len(encoded2))},
        rfile=MockRFile(encoded2)
    )
    assert get_json_body(handler2) == {}

    # List (should be valid)
    encoded3 = json.dumps([1, 2, 3]).encode("utf-8")
    handler3 = MockHandler(
        headers={"Content-Length": str(len(encoded3))},
        rfile=MockRFile(encoded3)
    )
    assert get_json_body(handler3) == [1, 2, 3]
