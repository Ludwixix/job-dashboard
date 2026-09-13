#!/usr/bin/env python3
"""Pre-tool security gate implementing Zero Secret Exposure and Governance Execution Policies.

Intercepts tool execution payloads and deterministically blocks access to:
1. Protected credentials, keys, or sensitive environment files.
2. Catastrophic system commands (e.g. rm -rf /, sudo).
3. Out-of-bounds file writes outside allowed workspace paths.
"""

import json
import os
import re
import sys
from pathlib import Path

BLOCKED_SECRET_PATTERNS = [
    r"OpenRouterAPI\.txt",
    r"KEYS\.md",
    r"(^|/)\.env($|\..*)",
    r"(^|/)credentials(/|$)",
    r"client_secret.*\.json",
]

COMPILED_SECRET_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in BLOCKED_SECRET_PATTERNS
]

DANGEROUS_COMMAND_PATTERNS = [
    (re.compile(r"\brm\s+-[a-zA-Z]*rf?\s+(/|~|\$HOME)(\s|$)"), "deny", "Catastrophic command (rm -rf root/home) blocked."),
    (re.compile(r"\bsudo\b"), "ask", "Privilege escalation (sudo) requires manual user confirmation."),
    (re.compile(r"\b(shutdown|reboot|mkfs|dd\s+if=)\b"), "deny", "System destructive command blocked."),
]


def is_blocked_secret(text: str) -> bool:
    if not text:
        return False
    for pattern in COMPILED_SECRET_PATTERNS:
        if pattern.search(text):
            return True
    return False


def check_command_safety(cmd: str):
    if not cmd:
        return None
    for pattern, decision, reason in DANGEROUS_COMMAND_PATTERNS:
        if pattern.search(cmd):
            return decision, reason
    return None


def is_path_in_scope(target_path_str: str, workspace_paths: list[str]) -> bool:
    if not target_path_str:
        return True
    try:
        resolved = Path(os.path.expanduser(target_path_str)).resolve()
    except Exception:
        return True

    # Allowed safe directories outside workspace
    home = Path.home()
    allowed_external_prefixes = [
        home / ".gemini" / "antigravity",
        home / ".gemini",  # global GEMINI.md configuration
        Path("/tmp"),
    ]

    for prefix in allowed_external_prefixes:
        try:
            resolved.relative_to(prefix.resolve())
            return True
        except ValueError:
            pass

    # Check workspace paths
    for ws in workspace_paths:
        try:
            ws_path = Path(os.path.expanduser(ws)).resolve()
            resolved.relative_to(ws_path)
            return True
        except (ValueError, Exception):
            pass

    return False


def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"decision": "allow"}))
            return

        payload = json.loads(raw_input)
        tool_call = payload.get("toolCall", {})
        name = tool_call.get("name", "")
        args = tool_call.get("args", {})
        workspace_paths = payload.get("workspacePaths", [])

        # 1. Zero Secret Exposure Check
        targets_to_check = []
        if "TargetFile" in args:
            targets_to_check.append(str(args["TargetFile"]))
        if "AbsolutePath" in args:
            targets_to_check.append(str(args["AbsolutePath"]))
        if "SearchPath" in args:
            targets_to_check.append(str(args["SearchPath"]))
        if "DirectoryPath" in args:
            targets_to_check.append(str(args["DirectoryPath"]))
        if "CommandLine" in args:
            targets_to_check.append(str(args["CommandLine"]))
        if "Query" in args:
            targets_to_check.append(str(args["Query"]))

        for target in targets_to_check:
            if is_blocked_secret(target):
                print(
                    json.dumps(
                        {
                            "decision": "deny",
                            "reason": (
                                "Blocked by Zero Secret Exposure Policy: Tool invocation "
                                f"('{name}') references protected secret or credential target."
                            ),
                        }
                    )
                )
                return

        # 2. Command Safety Check
        if name == "run_command" and "CommandLine" in args:
            cmd = str(args["CommandLine"])
            safety_result = check_command_safety(cmd)
            if safety_result:
                decision, reason = safety_result
                print(
                    json.dumps(
                        {
                            "decision": decision,
                            "reason": f"Execution Policy: {reason}",
                        }
                    )
                )
                return

        # 3. Scope Constraint Check (for write / edit operations)
        if name in ["write_to_file", "replace_file_content", "multi_replace_file_content"]:
            target_file = args.get("TargetFile")
            if target_file and not is_path_in_scope(str(target_file), workspace_paths):
                print(
                    json.dumps(
                        {
                            "decision": "deny",
                            "reason": (
                                f"Scope Constraint: Modifying '{target_file}' outside "
                                "workspace root is strictly forbidden by Antigravity Governance."
                            ),
                        }
                    )
                )
                return

        print(json.dumps({"decision": "allow"}))
    except Exception as e:
        sys.stderr.write(f"pre_tool_security hook error: {e}\n")
        print(json.dumps({"decision": "allow"}))


if __name__ == "__main__":
    main()
