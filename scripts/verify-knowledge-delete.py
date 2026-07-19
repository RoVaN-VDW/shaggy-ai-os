#!/usr/bin/env python3
"""Static security contract for the protected knowledge deletion flow."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROUTE = ROOT / "src/app/api/knowledge/[id]/route.ts"
COMPONENT = ROOT / "src/components/knowledge/knowledge-upload.tsx"


def position(source: str, needle: str) -> int:
    return source.find(needle)


def main() -> int:
    errors: list[str] = []
    component = COMPONENT.read_text(encoding="utf-8")

    if not ROUTE.is_file():
        errors.append("protected DELETE route is missing")
        route = ""
    else:
        route = ROUTE.read_text(encoding="utf-8")

    checks = {
        "exports_delete": "export async function DELETE" in route,
        "rate_limited": 'rateLimit(req, "knowledge-delete"' in route,
        "requires_auth": "await requireAuth(req)" in route,
        "validates_uuid": "validateUuid(id, \"document id\")" in route,
        "loads_server_metadata": '.select("id, storage_path")' in route,
        "deletes_private_object": '.from("knowledge").remove([document.storage_path])' in route,
        "deletes_metadata": '.from("knowledge_docs")' in route and ".delete()" in route,
        "client_uses_api": 'fetchWithAuth(`/api/knowledge/${doc.id}`' in component,
        "no_client_storage_delete": 'supabase.storage.from("knowledge").remove' not in component,
        "no_client_metadata_delete": 'supabase.from("knowledge_docs").delete' not in component,
        "no_client_supabase_import": re.search(
            r'import\s*\{[^}]*\bsupabase\b[^}]*\}\s*from\s*["\']@/lib/supabase/client["\']',
            component,
        ) is None,
    }

    errors.extend(name for name, passed in checks.items() if not passed)

    if route:
        auth_at = position(route, "await requireAuth(req)")
        admin_at = position(route, "getSupabaseAdmin()")
        storage_at = position(route, '.from("knowledge").remove')
        delete_call_at = position(route, ".delete()")
        if min(auth_at, admin_at, storage_at, delete_call_at) < 0:
            errors.append("could not verify side-effect ordering")
        else:
            if not auth_at < admin_at < delete_call_at:
                errors.append("authorization must precede admin client and metadata deletion")
            if not delete_call_at < storage_at:
                errors.append("metadata deletion must precede storage cleanup")

        if 'cleanup: "pending"' not in route:
            errors.append("storage cleanup failure must be reported as pending")

    result = {"status": "pass" if not errors else "fail", "checks": checks, "errors": errors}
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
