#!/usr/bin/env python3
"""Deny agent shell commands that install from a public JavaScript registry."""

import json
import re
import sys

PUBLIC_REGISTRY = re.compile(
    r"registry\.npmjs\.org|registry\.yarnpkg\.com|repo\.yarnpkg\.com|"
    r"(?<![\w.-])(?:npmjs\.(?:org|com)|yarnpkg\.com|npmmirror\.com)(?![\w.-])",
    re.IGNORECASE,
)
REGISTRY_FLAG = re.compile(r"--registry(?:=|\s+)(\S+)", re.IGNORECASE)
SET_REGISTRY = re.compile(
    r"\b(?:npm|yarn|pnpm|bun)\b(?:\s+\S+){0,4}\s+set\s+registry(?:=|\s+)(\S+)",
    re.IGNORECASE,
)

DENY = {
    "permission": "deny",
    "user_message": "Blocked a public npm install. This repo installs only from Chainguard Libraries.",
    "agent_message": (
        "The npm registry is https://libraries.cgr.dev/js/. "
        "If this version is missing or rejected, run `npm view <pkg> versions --json` "
        "and install the newest version that registry has. "
        "Do not pass --registry and do not change the registry."
    ),
}


def is_chainguard(url: str) -> bool:
    return "libraries.cgr.dev" in url.lower()


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(2)

    command = payload.get("command") or ""
    urls = [match.group(1) for match in REGISTRY_FLAG.finditer(command)]
    urls += [match.group(1) for match in SET_REGISTRY.finditer(command)]
    denied = bool(PUBLIC_REGISTRY.search(command)) or any(
        not is_chainguard(url) for url in urls
    )

    json.dump(DENY if denied else {"permission": "allow"}, sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
