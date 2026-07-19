#!/usr/bin/env python3
"""Static lifecycle contract for bounded knowledge embedding."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPLOAD = ROOT / "src/app/api/upload/route.ts"
EMBED_ROUTE = ROOT / "src/app/api/embed/route.ts"
SERVICE = ROOT / "src/lib/knowledge/embed-document.ts"

errors: list[str] = []
upload = UPLOAD.read_text() if UPLOAD.exists() else ""
route = EMBED_ROUTE.read_text() if EMBED_ROUTE.exists() else ""
service = SERVICE.read_text() if SERVICE.exists() else ""

checks = {
    "service_exists": SERVICE.exists(),
    "upload_uses_after": "after(" in upload,
    "upload_imports_service": 'from "@/lib/knowledge/embed-document"' in upload,
    "upload_calls_service": re.search(r"after\s*\(\s*async\s*\(\)\s*=>[\s\S]*?embedDocument\(", upload) is not None,
    "upload_has_no_embed_self_fetch": "/api/embed" not in upload,
    "upload_has_no_auth_forwarding": "Authorization" not in upload and "authorization" not in upload,
    "embed_route_imports_service": 'from "@/lib/knowledge/embed-document"' in route,
    "embed_route_has_no_openai_client": "new OpenAI" not in route and 'from "openai"' not in route,
    "service_has_provider_timeout": re.search(r"timeout\s*:\s*EMBEDDING_TIMEOUT_MS", service) is not None,
    "service_has_bounded_retries": re.search(r"maxRetries\s*:\s*[01]", service) is not None,
    "service_marks_failures": 'embedding_status: "error"' in service,
    "service_uses_existing_status_columns": "updated_at" not in service,
    "upload_max_duration": re.search(r"export const maxDuration\s*=\s*\d+", upload) is not None,
    "embed_max_duration": re.search(r"export const maxDuration\s*=\s*\d+", route) is not None,
}

for name, passed in checks.items():
    if not passed:
        errors.append(name)

print(
    json.dumps(
        {
            "status": "pass" if not errors else "fail",
            "checks": checks,
            "errors": errors,
        },
        sort_keys=True,
    )
)
raise SystemExit(1 if errors else 0)
