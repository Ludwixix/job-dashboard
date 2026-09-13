#!/usr/bin/env python3
"""Pre-tool security gate implementing Zero Secret Exposure policy.

Intercepts tool execution payloads and deterministically blocks access to
protected credentials, keys, or sensitive environment files.
"""

import json
import re
import sys

BLOCKED_PATTERNS = [
    r"OpenRouterAPI\.txt",
    r"KEYS\.md",
    r"(^|/)\.env($|\..*)",
    r"(^|/)credentials(/|$)",
    r"client_secret.*\.json",
]

COMPILED_PATTERNS = [re.compile(p, re.IGNORECASE) for p in BLOCKED_PATTERNS]


def is_blocked(text: str) -> bool:
    if not text:
        return False
    for pattern in COMPILED_PATTERNS:
        if pattern.search(text):
            return True
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

        # Inspect specific tool arguments
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
            if is_blocked(target):
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

        print(json.dumps({"decision": "allow"}))
    except Exception as e:
        # Fallback cleanly without crashing
        sys.stderr.write(f"pre_tool_security hook error: {e}\n")
        print(json.dumps({"decision": "allow"}))


if __name__ == "__main__":
    main()

