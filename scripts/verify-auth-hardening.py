#!/usr/bin/env python3
"""Static fail-closed verification for SHAGGY's auth hardening SQL.

This script reads local SQL (and an optional schema-only snapshot) only. It does
not connect to Supabase, use credentials, or mutate a database.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

EXPECTED_TABLES = {
    "agent_activity",
    "agents",
    "artifacts",
    "assets",
    "chat_messages",
    "chat_sessions",
    "chats",
    "connectors",
    "dashboard_widgets",
    "dashboards",
    "files",
    "knowledge_chunks",
    "knowledge_docs",
    "knowledge_rooms",
    "knowledge_sources",
    "memory_items",
    "messages",
    "model_providers",
    "notifications",
    "projects",
    "prompts",
    "reports",
    "review_items",
    "settings",
    "traces",
    "usage_events",
    "workflows",
}

EXPECTED_LEGACY_POLICIES = {
    "Allow anon delete knowledge_docs",
    "Allow anon insert agent_activity",
    "Allow anon insert knowledge_docs",
    "Allow anon insert notifications",
    "Allow anon insert usage_events",
    "Allow anon read agent_activity",
    "Allow anon read knowledge_docs",
    "Allow anon read notifications",
    "Allow anon read usage_events",
    "Allow anon update notifications",
    "Allow anonymous read on model_providers",
    "Allow anonymous read on projects",
    "Allow anonymous read on review_items",
    "Allow authenticated read on model_providers",
    "Allow authenticated read on projects",
    "Allow authenticated read on review_items",
    "Allow authenticated read own project chunks",
    "Allow users own chat_messages",
    "Allow users own chat_sessions",
}


def read(path: Path) -> str:
    if not path.is_file():
        raise FileNotFoundError(path)
    return path.read_text(encoding="utf-8")


def extract_first_target_array(sql: str) -> set[str]:
    match = re.search(
        r"FOREACH\s+target_table\s+IN\s+ARRAY\s+ARRAY\[(.*?)\]\s+LOOP",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return set()
    return set(re.findall(r"'([a-z0-9_]+)'", match.group(1)))


def quoted_policy_names(sql: str) -> set[str]:
    return set(re.findall(r'CREATE\s+POLICY\s+"([^"]+)"', sql, re.IGNORECASE))


def check(condition: bool, label: str, errors: list[str]) -> None:
    if not condition:
        errors.append(label)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--forward",
        type=Path,
        default=Path("supabase/migrations/20260712010000_authenticated_personal_os.sql"),
    )
    parser.add_argument(
        "--rollback",
        type=Path,
        default=Path("supabase/rollback/20260712010000_authenticated_personal_os.down.sql"),
    )
    parser.add_argument("--snapshot", type=Path)
    args = parser.parse_args()

    errors: list[str] = []
    forward = read(args.forward)
    rollback = read(args.rollback)

    forward_tables = extract_first_target_array(forward)
    rollback_tables = extract_first_target_array(rollback)
    check(forward_tables == EXPECTED_TABLES, "forward target set differs from 27-table contract", errors)
    check(rollback_tables == EXPECTED_TABLES, "rollback target set differs from 27-table contract", errors)

    check(
        "INSERT INTO private.shaggy_authorized_users (user_id)\n  SELECT id FROM auth.users"
        not in forward,
        "forward bulk-authorizes existing users",
        errors,
    )
    check(
        "IF total_user_count <> 1 OR confirmed_user_count <> 1 THEN" in forward,
        "forward lacks exact-one-confirmed-operator invariant",
        errors,
    )
    check(
        "INTO STRICT operator_user_id" in forward
        and "VALUES (operator_user_id)" in forward,
        "forward does not atomically seed the uniquely verified operator",
        errors,
    )
    check(
        "AND NOT (roles <@ ARRAY['service_role']::name[])" in forward,
        "forward does not remove every non-service legacy policy",
        errors,
    )
    check(
        "REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated" in forward,
        "forward does not reduce table grants",
        errors,
    )
    check(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated" in forward,
        "forward does not restore least-privilege authenticated DML grants",
        errors,
    )
    check(
        "SECURITY DEFINER" in forward and "SET search_path = ''" in forward,
        "authorization function lacks hardened SECURITY DEFINER search_path",
        errors,
    )
    check(
        "FROM PUBLIC, anon" in forward,
        "forward leaves default PUBLIC function execution unaddressed",
        errors,
    )
    check(
        "EMERGENCY ROLLBACK ONLY" in rollback,
        "rollback lacks explicit exposure warning",
        errors,
    )

    rollback_policies = quoted_policy_names(rollback)
    check(
        rollback_policies == EXPECTED_LEGACY_POLICIES,
        "rollback legacy policy set differs from production snapshot",
        errors,
    )

    snapshot_summary: dict[str, object] | None = None
    if args.snapshot:
        snapshot = read(args.snapshot)
        snapshot_tables = set(
            re.findall(
                r'CREATE TABLE(?: IF NOT EXISTS)? "public"\."([^"]+)"',
                snapshot,
                re.IGNORECASE,
            )
        )
        snapshot_policies = quoted_policy_names(snapshot)
        snapshot_non_service = {
            name
            for name in snapshot_policies
            if not name.startswith("Allow service")
        }
        check(snapshot_tables == EXPECTED_TABLES, "remote snapshot public table set changed", errors)
        check(
            snapshot_non_service == EXPECTED_LEGACY_POLICIES,
            "remote snapshot non-service policy set changed",
            errors,
        )
        snapshot_summary = {
            "public_tables": len(snapshot_tables),
            "non_service_policies": len(snapshot_non_service),
        }

    result = {
        "status": "pass" if not errors else "fail",
        "forward_tables": len(forward_tables),
        "rollback_tables": len(rollback_tables),
        "rollback_policies": len(rollback_policies),
        "snapshot": snapshot_summary,
        "errors": errors,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except FileNotFoundError as error:
        print(json.dumps({"status": "fail", "error": f"missing file: {error}"}, indent=2))
        raise SystemExit(1)
