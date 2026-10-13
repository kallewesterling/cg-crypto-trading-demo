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
NPMRC = re.compile(r"(?:^|[^\w.-])\.npmrc\b")
RM_NPMRC = re.compile(r"^\s*rm\s+(?:-\S+\s+)*\.npmrc\s*$")

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


NPMRC_DENY = {
    "permission": "deny",
    "user_message": "Blocked a command that reads .npmrc. That file holds the Chainguard pull token.",
    "agent_message": (
        "Do not open, print, copy, or pass .npmrc to a command. "
        "The only allowed command is rm of that file."
    ),
}


def is_chainguard(url: str) -> bool:
    return "libraries.cgr.dev" in url.lower()


def reads_npmrc(command: str) -> bool:
    return bool(NPMRC.search(command)) and RM_NPMRC.fullmatch(command) is None


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(2)

    command = payload.get("command") or ""
    if reads_npmrc(command):
        json.dump(NPMRC_DENY, sys.stdout)
        sys.stdout.write("\n")
        return

    urls = [match.group(1) for match in REGISTRY_FLAG.finditer(command)]
    urls += [match.group(1) for match in SET_REGISTRY.finditer(command)]
    denied = bool(PUBLIC_REGISTRY.search(command)) or any(
        not is_chainguard(url) for url in urls
    )

    json.dump(DENY if denied else {"permission": "allow"}, sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
