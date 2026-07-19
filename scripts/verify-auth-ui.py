#!/usr/bin/env python3
"""Static regression contract for SHAGGY's passwordless auth form."""

from __future__ import annotations

import json
import re
from pathlib import Path


def main() -> int:
    source = Path("src/components/auth-gate.tsx").read_text(encoding="utf-8")
    errors: list[str] = []

    if not re.search(r"<form\b[^>]*onSubmit=\{requestMagicLink\}", source):
        errors.append("magic-link form is not wired to requestMagicLink")

    button_match = re.search(
        r"(<Button\b[^>]*>.*?Send secure link.*?</Button>)",
        source,
        re.DOTALL,
    )
    if not button_match:
        errors.append("magic-link submit control is missing")
    elif not re.search(r'\btype=["\']submit["\']', button_match.group(1)):
        errors.append("magic-link button is not an explicit submit control")

    result = {
        "status": "pass" if not errors else "fail",
        "contracts": 2,
        "errors": errors,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
