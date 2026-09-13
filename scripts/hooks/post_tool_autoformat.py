#!/usr/bin/env python3
"""Post-tool auto-formatter hook.

Automatically formats Python files with ruff and JavaScript/JSX files
with prettier after edit/write tool calls, fulfilling the project rule:
"Formatting: Never manually waste steps fixing whitespace, quotes, or
trailing commas. Commit your logical changes and let the pre-commit
auto-formatter handle syntax styling."
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

RUFF_BIN = shutil.which("ruff") or os.path.expanduser("~/.local/bin/ruff")


def format_file(file_path: str):
    path = Path(file_path)
    if not path.exists() or not path.is_file():
        return

    ext = path.suffix.lower()

    if ext == ".py":
        if os.path.exists(RUFF_BIN) and os.access(RUFF_BIN, os.X_OK):
            try:
                subprocess.run(
                    [RUFF_BIN, "format", "--isolated", str(path)],
                    capture_output=True,
                    timeout=5,
                    check=False,
                )
            except Exception as e:
                sys.stderr.write(f"ruff format error: {e}\n")

    elif ext in [".js", ".jsx", ".ts", ".tsx", ".css"]:
        # Only run prettier if node/npx is available
        try:
            subprocess.run(
                ["npx", "--no-install", "prettier", "--write", str(path)],
                capture_output=True,
                timeout=5,
                check=False,
            )
        except Exception:
            pass


def main():
    try:
        raw_input = sys.stdin.read()
        if raw_input.strip():
            payload = json.loads(raw_input)
            tool_call = payload.get("toolCall", {})
            args = tool_call.get("args", {})
            target_file = args.get("TargetFile")
            if target_file:
                format_file(str(target_file))
    except Exception as e:
        sys.stderr.write(f"post_tool_autoformat hook error: {e}\n")
    finally:
        # PostToolUse contract requires returning valid JSON (e.g. {})
        print(json.dumps({}))


if __name__ == "__main__":
    main()

