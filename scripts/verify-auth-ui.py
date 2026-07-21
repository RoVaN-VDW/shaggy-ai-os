#!/usr/bin/env python3
"""Static regression contract for SHAGGY's local-only access boundary."""

from __future__ import annotations

import json
import re
from pathlib import Path


def require(errors: list[str], condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


def main() -> int:
    gate = Path("src/components/auth-gate.tsx").read_text(encoding="utf-8")
    access = Path("src/lib/local/access.ts").read_text(encoding="utf-8")
    package = json.loads(Path("package.json").read_text(encoding="utf-8"))
    errors: list[str] = []

    require(errors, "resolveLocalAccess" in gate, "auth gate does not use the local access policy")
    require(errors, "useSyncExternalStore" in gate, "auth gate is not hydration-safe")
    require(errors, "AuthBoundaryProvider" in gate, "authorized local evidence is not shared with consumers")
    require(errors, "Local runtime required" in gate, "non-local fail-closed state is missing")
    require(
        errors,
        not re.search(r"supabase|signInWithOtp|magic link|requestMagicLink", gate, re.IGNORECASE),
        "cloud or magic-link auth remains in the application gate",
    )
    require(
        errors,
        all(host in access for host in ('"localhost"', '"127.0.0.1"', '"::1"')),
        "loopback hostname allowlist is incomplete",
    )
    require(errors, "non-loopback-host" in access and "cross-origin" in access, "local policy is not fail-closed")

    scripts = package.get("scripts", {})
    require(
        errors,
        bool(re.search(r"(?:--hostname|-H)\s+127\.0\.0\.1", scripts.get("dev", ""))),
        "development server is not bound to loopback",
    )
    require(
        errors,
        bool(re.search(r"(?:--hostname|-H)\s+127\.0\.0\.1", scripts.get("start", ""))),
        "production server is not bound to loopback",
    )

    result = {
        "status": "pass" if not errors else "fail",
        "contracts": 9,
        "errors": errors,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
