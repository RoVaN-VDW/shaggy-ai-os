#!/usr/bin/env python3
"""SHAGGY local usage ledger and native collector.

Privacy boundary: reads only aggregate usage counters from Hermes
session_model_usage. It never reads prompts, messages, reasoning text,
credentials, or tool payloads.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import socketserver
import sqlite3
import stat
import statistics
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, urlparse

DEFAULT_LEDGER = Path.home() / "Library" / "Application Support" / "SHAGGY" / "usage" / "usage.sqlite3"
DEFAULT_HERMES_DB = Path.home() / ".hermes" / "state.db"
MAX_EXPORT_EVENTS = 10_000
VALID_COST_STATUS = {"unknown", "estimated", "actual", "included"}
VALID_USAGE_STATUS = {"success", "error", "cached", "unknown"}
VALID_TRUST_LEVEL = {"native-aggregate", "client-reported"}
PROVIDER_USAGE_COLUMNS = (
    "event_id", "source", "source_session_id", "provider", "model", "project_id", "task",
    "api_call_count", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens",
    "reasoning_tokens", "estimated_cost_usd", "actual_cost_usd", "cost_status", "cost_source",
    "billing_mode", "latency_ms", "status", "occurred_at", "first_seen_at", "updated_at", "metadata_json",
)
PROVIDER_USAGE_UPSERT_SQL = (
    f"INSERT INTO provider_usage ({','.join(PROVIDER_USAGE_COLUMNS)}) "
    f"VALUES ({','.join('?' for _ in PROVIDER_USAGE_COLUMNS)}) "
    "ON CONFLICT(event_id) DO UPDATE SET "
    + ",".join(
        f"{column}=excluded.{column}"
        for column in PROVIDER_USAGE_COLUMNS
        if column != "event_id"
    )
)

MAX_HTTP_BODY_BYTES = 256 * 1024
MAX_WORKFLOW_TEXT_LENGTH = 240
COLLECTOR_SOCKET_FILENAME = "collector.sock"
MAX_IDENTIFIER_LENGTH = 240
IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/@-]*$")
SOCKET_TIMEOUT_SECONDS = 5
MAX_HTTP_WORKERS = 32

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS provider_usage (
  event_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_session_id TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  project_id TEXT,
  task TEXT,
  api_call_count INTEGER NOT NULL DEFAULT 1 CHECK(api_call_count >= 0),
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK(input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK(output_tokens >= 0),
  cache_read_tokens INTEGER NOT NULL DEFAULT 0 CHECK(cache_read_tokens >= 0),
  cache_write_tokens INTEGER NOT NULL DEFAULT 0 CHECK(cache_write_tokens >= 0),
  reasoning_tokens INTEGER NOT NULL DEFAULT 0 CHECK(reasoning_tokens >= 0),
  estimated_cost_usd REAL,
  actual_cost_usd REAL,
  cost_status TEXT NOT NULL DEFAULT 'unknown' CHECK(cost_status IN ('unknown','estimated','actual','included')),
  cost_source TEXT,
  billing_mode TEXT,
  latency_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'success',
  occurred_at TEXT NOT NULL,
  first_seen_at TEXT,
  updated_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS provider_usage_occurred_idx ON provider_usage(occurred_at DESC);
CREATE INDEX IF NOT EXISTS provider_usage_model_idx ON provider_usage(provider, model, occurred_at DESC);

CREATE TABLE IF NOT EXISTS workflow_events (
  event_id TEXT PRIMARY KEY,
  event_kind TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  project TEXT,
  task_id TEXT,
  task_type TEXT,
  route_key TEXT,
  retries INTEGER NOT NULL DEFAULT 0,
  duplicate_context_tokens INTEGER NOT NULL DEFAULT 0,
  projected_cost_usd REAL,
  recorded_cost_usd REAL,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS workflow_events_occurred_idx ON workflow_events(occurred_at DESC);

CREATE TABLE IF NOT EXISTS model_budgets (
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  monthly_budget_usd REAL,
  monthly_token_budget INTEGER,
  reset_day INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(provider, model)
);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def epoch_iso(value: Any) -> str:
    try:
        number = float(value)
        if not math.isfinite(number):
            raise ValueError("non-finite timestamp")
        return datetime.fromtimestamp(number, timezone.utc).isoformat().replace("+00:00", "Z")
    except (TypeError, ValueError, OSError, OverflowError) as error:
        raise ValueError("invalid epoch timestamp") from error


def parse_time(value: Any, *, default_now: bool = True) -> str:
    if value is None or value == "":
        if default_now:
            return now_iso()
        raise ValueError("timestamp is required")
    if isinstance(value, (int, float)):
        return epoch_iso(value)
    if isinstance(value, str) and value.strip():
        text = value.strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(text)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        except (ValueError, OverflowError) as error:
            raise ValueError("invalid ISO timestamp") from error
    raise ValueError("invalid timestamp")


def optional_nonnegative(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError) as error:
        raise ValueError("invalid nonnegative numeric value") from error
    if not math.isfinite(number) or number < 0:
        raise ValueError("invalid nonnegative numeric value")
    return number


def nonnegative_int(value: Any, default: int = 0) -> int:
    if value is None or value == "":
        return default
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError) as error:
        raise ValueError("invalid nonnegative integer value") from error
    if not math.isfinite(number) or number < 0 or not number.is_integer():
        raise ValueError("invalid nonnegative integer value")
    return int(number)


def lexical_absolute(path: Path) -> Path:
    expanded = path.expanduser()
    return Path(os.path.abspath(expanded if expanded.is_absolute() else Path.cwd() / expanded))


def reject_symlink_components(path: Path, label: str) -> None:
    current = Path(path.anchor)
    for part in path.parts[1:]:
        current /= part
        try:
            metadata = current.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(metadata.st_mode):
            raise RuntimeError(f"{label} path may not contain symlinks")


def validate_database_path(path: Path, label: str, *, create_parent: bool) -> Path:
    safe = lexical_absolute(path)
    reject_symlink_components(safe, label)
    if create_parent:
        safe.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        reject_symlink_components(safe.parent, f"{label} parent")
        parent = safe.parent.lstat()
        if not stat.S_ISDIR(parent.st_mode) or parent.st_uid != os.getuid():
            raise RuntimeError(f"{label} parent must be an owner-controlled directory")
        os.chmod(safe.parent, 0o700)
    elif not safe.exists():
        raise FileNotFoundError(f"{label} does not exist")
    if safe.exists():
        metadata = safe.lstat()
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != os.getuid():
            raise RuntimeError(f"{label} must be an owner-controlled regular file")
    for suffix in ("-wal", "-shm", "-journal"):
        sidecar = Path(f"{safe}{suffix}")
        if sidecar.exists() or sidecar.is_symlink():
            metadata = sidecar.lstat()
            if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != os.getuid():
                raise RuntimeError(f"{label} sidecar is not an owner-controlled regular file")
    return safe


def guarded_database_descriptor(path: Path, label: str, *, writable: bool, create: bool = False) -> int:
    flags = os.O_RDWR if writable else os.O_RDONLY
    if create:
        flags |= os.O_CREAT
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(path, flags, 0o600)
    metadata = os.fstat(descriptor)
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != os.getuid():
        os.close(descriptor)
        raise RuntimeError(f"{label} must be an owner-controlled regular file")
    return descriptor


def verify_guarded_identity(path: Path, descriptor: int, label: str) -> None:
    opened = os.fstat(descriptor)
    current = path.lstat()
    if not stat.S_ISREG(current.st_mode) or (opened.st_dev, opened.st_ino) != (current.st_dev, current.st_ino):
        raise RuntimeError(f"{label} changed while opening")


def connect(path: Path) -> sqlite3.Connection:
    path = validate_database_path(path, "ledger", create_parent=True)
    descriptor = guarded_database_descriptor(path, "ledger", writable=True, create=True)
    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(path, timeout=10)
        verify_guarded_identity(path, descriptor, "ledger")
        connection.row_factory = sqlite3.Row
        connection.executescript(SCHEMA)
        connection.execute("PRAGMA busy_timeout=10000")
        connection.commit()
        os.fchmod(descriptor, 0o600)
        return connection
    except BaseException:
        if connection is not None:
            connection.close()
        raise
    finally:
        os.close(descriptor)


def read_stdin_json() -> dict[str, Any]:
    payload = json.load(sys.stdin)
    if not isinstance(payload, dict):
        raise ValueError("JSON object required")
    return payload


def stable_id(prefix: str, *parts: Any) -> str:
    raw = "\x1f".join(str(part or "") for part in parts)
    return f"{prefix}:{hashlib.sha256(raw.encode()).hexdigest()[:32]}"


def bounded_identifier(value: Any, label: str, *, required: bool = False, max_length: int = MAX_IDENTIFIER_LENGTH) -> str | None:
    if value is None or value == "":
        if required:
            raise ValueError(f"{label} is required")
        return None
    if not isinstance(value, str):
        raise ValueError(f"{label} must be a string")
    text = value.strip()
    if not text or len(text) > max_length or not IDENTIFIER_PATTERN.fullmatch(text):
        raise ValueError(f"invalid {label}")
    return text


def sanitize_provider_metadata(value: Any, trust_level: Any = None) -> dict[str, Any]:
    safe: dict[str, Any] = {}
    if isinstance(value, dict):
        for key in ("counter_semantics", "telemetry_version"):
            item = value.get(key)
            if isinstance(item, str):
                safe[key] = item[:MAX_WORKFLOW_TEXT_LENGTH]
            elif item is not None and isinstance(item, (bool, int, float)) and (not isinstance(item, float) or math.isfinite(item)):
                safe[key] = item
    if trust_level in VALID_TRUST_LEVEL:
        safe["trust_level"] = trust_level
    return safe


def normalize_cost_status(payload: dict[str, Any]) -> tuple[str, float | None, float | None]:
    raw_status = str(payload.get("cost_status") or "").strip().lower()
    if raw_status and raw_status not in VALID_COST_STATUS:
        raise ValueError("invalid cost status")
    estimated = optional_nonnegative(payload.get("estimated_cost_usd", payload.get("cost_estimate")))
    actual = optional_nonnegative(payload.get("actual_cost_usd"))
    if raw_status in {"", "unknown"}:
        if estimated == 0:
            estimated = None
        if actual == 0:
            actual = None
    if raw_status == "included":
        status = "included"
    elif actual is not None and (actual > 0 or raw_status == "actual"):
        status = "actual"
    elif estimated is not None and (estimated > 0 or raw_status == "estimated"):
        status = "estimated"
    else:
        status = "unknown"
    return status, estimated, actual


def upsert_provider(connection: sqlite3.Connection, payload: dict[str, Any]) -> bool:
    provider = bounded_identifier(payload.get("provider"), "provider", required=True, max_length=160)
    model = bounded_identifier(payload.get("model"), "model", required=True, max_length=160)
    source = bounded_identifier(payload.get("source") or "client-reported", "source", required=True, max_length=160)
    occurred_at = parse_time(payload.get("occurred_at", payload.get("occurredAt", payload.get("timestamp"))))
    event_id = bounded_identifier(payload.get("event_id") or payload.get("id") or stable_id(
        "usage", source, provider, model, occurred_at,
        payload.get("source_session_id"), payload.get("input_tokens"), payload.get("output_tokens"),
    ), "event_id", required=True, max_length=160)
    status, estimated, actual = normalize_cost_status(payload)
    existed = connection.execute("SELECT 1 FROM provider_usage WHERE event_id=?", (event_id,)).fetchone() is not None
    values = {
        "event_id": event_id,
        "source": source,
        "source_session_id": bounded_identifier(payload.get("source_session_id"), "source_session_id"),
        "provider": provider,
        "model": model,
        "project_id": bounded_identifier(payload.get("project_id", payload.get("project")), "project_id", max_length=160),
        "task": bounded_identifier(payload.get("task", payload.get("task_type")), "task", max_length=160),
        "api_call_count": nonnegative_int(payload.get("api_call_count"), 1),
        "input_tokens": nonnegative_int(payload.get("input_tokens", payload.get("inputTokens"))),
        "output_tokens": nonnegative_int(payload.get("output_tokens", payload.get("outputTokens"))),
        "cache_read_tokens": nonnegative_int(payload.get("cache_read_tokens", payload.get("cached_tokens"))),
        "cache_write_tokens": nonnegative_int(payload.get("cache_write_tokens")),
        "reasoning_tokens": nonnegative_int(payload.get("reasoning_tokens")),
        "estimated_cost_usd": estimated,
        "actual_cost_usd": actual,
        "cost_status": status,
        "cost_source": bounded_identifier(payload.get("cost_source"), "cost_source", max_length=160),
        "billing_mode": bounded_identifier(payload.get("billing_mode"), "billing_mode", max_length=80),
        "latency_ms": None if payload.get("latency_ms", payload.get("latencyMs")) is None else nonnegative_int(payload.get("latency_ms", payload.get("latencyMs"))),
        "status": bounded_identifier(payload.get("status") or "success", "status", required=True, max_length=32),
        "occurred_at": occurred_at,
        "first_seen_at": parse_time(payload["first_seen_at"]) if payload.get("first_seen_at") is not None else None,
        "updated_at": now_iso(),
        "metadata_json": json.dumps(sanitize_provider_metadata(payload.get("metadata"), payload.get("trust_level")), separators=(",", ":"), sort_keys=True),
    }
    if values["status"] not in VALID_USAGE_STATUS:
        raise ValueError("invalid usage status")
    if tuple(values) != PROVIDER_USAGE_COLUMNS:
        raise RuntimeError("provider usage column contract mismatch")
    connection.execute(
        PROVIDER_USAGE_UPSERT_SQL,
        tuple(values[column] for column in PROVIDER_USAGE_COLUMNS),
    )
    return existed


def hermes_payloads(source: Path, *, days: int | None = None, full: bool = False) -> list[dict[str, Any]]:
    source = validate_database_path(source, "Hermes source", create_parent=False)
    descriptor = guarded_database_descriptor(source, "Hermes source", writable=False)
    uri = f"file:{quote(str(source), safe='/')}?mode=ro"
    hermes: sqlite3.Connection | None = None
    try:
        hermes = sqlite3.connect(uri, uri=True, timeout=5)
        verify_guarded_identity(source, descriptor, "Hermes source")
        hermes.row_factory = sqlite3.Row
        query = """SELECT session_id, model, billing_provider, billing_mode, task, api_call_count,
                          input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
                          reasoning_tokens, estimated_cost_usd, actual_cost_usd, cost_status,
                          cost_source, first_seen, last_seen
                   FROM session_model_usage WHERE api_call_count > 0"""
        parameters: tuple[Any, ...] = ()
        if days is not None and not full:
            query += " AND last_seen >= ?"
            parameters = (time.time() - max(1, days) * 86_400,)
        rows = hermes.execute(query + " ORDER BY last_seen", parameters).fetchall()
    finally:
        if hermes is not None:
            hermes.close()
        os.close(descriptor)
    payloads: list[dict[str, Any]] = []
    for row in rows:
        data = dict(row)
        event_id = stable_id("hermes", data["session_id"], data["model"], data["billing_provider"], data["task"])
        payloads.append({
            "event_id": event_id,
            "source": "hermes:state.db:session_model_usage",
            "source_session_id": data["session_id"],
            "provider": data["billing_provider"] or "hermes",
            "model": data["model"] or "unknown",
            "project_id": "Hermes",
            "task": data["task"] or "conversation",
            "api_call_count": data["api_call_count"],
            "input_tokens": data["input_tokens"],
            "output_tokens": data["output_tokens"],
            "cache_read_tokens": data["cache_read_tokens"],
            "cache_write_tokens": data["cache_write_tokens"],
            "reasoning_tokens": data["reasoning_tokens"],
            "estimated_cost_usd": data["estimated_cost_usd"],
            "actual_cost_usd": data["actual_cost_usd"],
            "cost_status": data["cost_status"] or "unknown",
            "cost_source": data["cost_source"],
            "billing_mode": data["billing_mode"],
            "status": "unknown",
            "trust_level": "native-aggregate",
            "first_seen_at": epoch_iso(data["first_seen"]),
            "occurred_at": epoch_iso(data["last_seen"]),
            "metadata": {"counter_semantics": "session-model cumulative snapshot"},
        })
    return payloads


def collect_hermes(connection: sqlite3.Connection, source: Path) -> dict[str, Any]:
    payloads = hermes_payloads(source)
    inserted = updated = 0
    with connection:
        for payload in payloads:
            if upsert_provider(connection, payload):
                updated += 1
            else:
                inserted += 1
    return {"scanned": len(payloads), "inserted": inserted, "updated": updated}


def ingest_workflow(connection: sqlite3.Connection, payload: dict[str, Any]) -> dict[str, Any]:
    event_id = bounded_identifier(payload.get("event_id") or stable_id(
        "workflow", payload.get("event_kind"), payload.get("project"), payload.get("task_id"), payload.get("timestamp"),
    ), "event_id", required=True, max_length=160)
    event_kind = bounded_identifier(payload.get("event_kind") or "workflow", "event_kind", required=True, max_length=80)
    project = bounded_identifier(payload.get("project"), "project", max_length=160)
    task_id = bounded_identifier(payload.get("task_id"), "task_id", max_length=160)
    task_type = bounded_identifier(payload.get("task_type"), "task_type", max_length=160)
    route_key = bounded_identifier(payload.get("route_key"), "route_key", max_length=80)
    occurred_at = parse_time(payload.get("timestamp", payload.get("occurred_at")))
    projected = optional_nonnegative(payload.get("projected_cost_usd"))
    recorded = optional_nonnegative(payload.get("recorded_cost_usd", payload.get("cost_usd")))
    retries = nonnegative_int(payload.get("retries"))
    duplicate_context_tokens = nonnegative_int(payload.get("duplicate_context_tokens"))
    deterministic_gates_passed = payload.get("deterministic_gates_passed")
    if deterministic_gates_passed is not None and not isinstance(deterministic_gates_passed, bool):
        raise ValueError("invalid deterministic_gates_passed")
    status = bounded_identifier(payload.get("status"), "status", max_length=32)
    sol_verdict = bounded_identifier(payload.get("sol_verdict"), "sol_verdict", max_length=80)
    telemetry_version = bounded_identifier(payload.get("telemetry_version"), "telemetry_version", max_length=40)
    safe_payload = {
        key: value
        for key, value in {
            "event_id": event_id,
            "event_kind": event_kind,
            "occurred_at": occurred_at,
            "project": project,
            "task_id": task_id,
            "task_type": task_type,
            "route_key": route_key,
            "retries": retries,
            "duplicate_context_tokens": duplicate_context_tokens,
            "projected_cost_usd": projected,
            "recorded_cost_usd": recorded,
            "status": status,
            "deterministic_gates_passed": deterministic_gates_passed,
            "sol_verdict": sol_verdict,
            "telemetry_version": telemetry_version,
        }.items()
        if value is not None
    }
    with connection:
        existing = connection.execute("SELECT 1 FROM workflow_events WHERE event_id=?", (event_id,)).fetchone()
        connection.execute(
            """INSERT INTO workflow_events
               (event_id,event_kind,occurred_at,project,task_id,task_type,route_key,retries,
                duplicate_context_tokens,projected_cost_usd,recorded_cost_usd,payload_json)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(event_id) DO UPDATE SET
                event_kind=excluded.event_kind, occurred_at=excluded.occurred_at,
                project=excluded.project, task_id=excluded.task_id, task_type=excluded.task_type,
                route_key=excluded.route_key, retries=excluded.retries,
                duplicate_context_tokens=excluded.duplicate_context_tokens,
                projected_cost_usd=excluded.projected_cost_usd,
                recorded_cost_usd=excluded.recorded_cost_usd, payload_json=excluded.payload_json""",
            (
                event_id, event_kind, occurred_at, project, task_id,
                task_type, route_key, retries, duplicate_context_tokens, projected, recorded,
                json.dumps(safe_payload, separators=(",", ":"), sort_keys=True),
            ),
        )
    return {"accepted": True, "duplicate": bool(existing), "event_id": event_id}


def row_dict(row: sqlite3.Row) -> dict[str, Any]:
    result = dict(row)
    if "metadata_json" in result:
        try:
            result["metadata"] = json.loads(result.pop("metadata_json"))
        except json.JSONDecodeError:
            result["metadata"] = {}
    actual = result.get("actual_cost_usd")
    estimated = result.get("estimated_cost_usd")
    result["cost_estimate"] = actual if actual is not None else estimated
    result["id"] = result.get("event_id")
    result["created_at"] = result.get("occurred_at")
    return result


def budget_cycle_start(generated_at: str, reset_day: Any) -> str:
    now = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    day = max(1, min(28, nonnegative_int(reset_day, 1)))
    start = now.replace(day=day, hour=0, minute=0, second=0, microsecond=0)
    if start > now:
        year = start.year - 1 if start.month == 1 else start.year
        month = 12 if start.month == 1 else start.month - 1
        start = start.replace(year=year, month=month)
    return start.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def alerts(connection: sqlite3.Connection, usage: list[dict[str, Any]], workflows: list[dict[str, Any]], generated_at: str) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    budgets = connection.execute("SELECT * FROM model_budgets").fetchall()
    for budget in budgets:
        cycle_start = budget_cycle_start(generated_at, budget["reset_day"])
        model_events = [event for event in usage if event["provider"] == budget["provider"] and event["model"] == budget["model"] and cycle_start <= event["occurred_at"] <= generated_at]
        known_cost = sum((event["actual_cost_usd"] if event["actual_cost_usd"] is not None else event["estimated_cost_usd"]) or 0 for event in model_events)
        token_total = sum(event["input_tokens"] + event["output_tokens"] for event in model_events)
        if budget["monthly_budget_usd"] is not None and known_cost >= budget["monthly_budget_usd"]:
            found.append({"kind": "budget", "severity": "warning", "provider": budget["provider"], "model": budget["model"], "message": "Owner cost budget reached or exceeded."})
        if budget["monthly_token_budget"] is not None and token_total >= budget["monthly_token_budget"]:
            found.append({"kind": "budget", "severity": "warning", "provider": budget["provider"], "model": budget["model"], "message": "Owner token budget reached or exceeded."})
    token_counts = [event["input_tokens"] + event["output_tokens"] for event in usage]
    if len(token_counts) >= 5:
        median = statistics.median(token_counts)
        threshold = max(10_000, median * 3)
        for event in usage:
            total = event["input_tokens"] + event["output_tokens"]
            if total >= threshold:
                found.append({"kind": "anomaly", "severity": "warning", "event_id": event["event_id"], "message": f"Usage spike: {total} processed tokens versus median {int(median)}."})
    for event in workflows:
        if int(event.get("retries") or 0) > 0:
            found.append({"kind": "retry", "severity": "info", "event_id": event["event_id"], "message": f"Task used {event['retries']} model retry/retries."})
        if int(event.get("duplicate_context_tokens") or 0) >= 5_000:
            found.append({"kind": "context_waste", "severity": "warning", "event_id": event["event_id"], "message": "Duplicate context exceeded 5,000 tokens."})
    return found[:100]


def export_ledger(connection: sqlite3.Connection, days: int) -> dict[str, Any]:
    generated_at = now_iso()
    cutoff_epoch = time.time() - max(1, days) * 86_400
    cutoff = epoch_iso(cutoff_epoch)
    provider_rows = connection.execute(
        "SELECT * FROM provider_usage WHERE occurred_at>=? AND occurred_at<=? ORDER BY occurred_at DESC LIMIT ?",
        (cutoff, generated_at, MAX_EXPORT_EVENTS + 1),
    ).fetchall()
    workflow_rows = connection.execute(
        "SELECT * FROM workflow_events WHERE occurred_at>=? AND occurred_at<=? ORDER BY occurred_at DESC LIMIT ?",
        (cutoff, generated_at, MAX_EXPORT_EVENTS + 1),
    ).fetchall()
    truncated = len(provider_rows) > MAX_EXPORT_EVENTS or len(workflow_rows) > MAX_EXPORT_EVENTS
    usage = [row_dict(row) for row in provider_rows[:MAX_EXPORT_EVENTS]]
    workflows = []
    for row in workflow_rows[:MAX_EXPORT_EVENTS]:
        item = dict(row)
        try:
            item["payload"] = json.loads(item.pop("payload_json"))
        except json.JSONDecodeError:
            item["payload"] = {}
        workflows.append(item)
    observed_pairs = {(event["provider"], event["model"]) for event in usage}
    budget_rows = connection.execute("SELECT * FROM model_budgets ORDER BY provider,model").fetchall()
    pairs = observed_pairs | {(row["provider"], row["model"]) for row in budget_rows}
    budget_map = {(row["provider"], row["model"]): dict(row) for row in budget_rows}
    providers = []
    for index, (provider, model) in enumerate(sorted(pairs)):
        budget = budget_map.get((provider, model), {})
        profile = {
            key: value for key, value in {
                "monthly_budget_usd": budget.get("monthly_budget_usd"),
                "monthly_token_budget": budget.get("monthly_token_budget"),
                "budget_reset_day": budget.get("reset_day"),
            }.items() if value is not None
        }
        seen = [event["occurred_at"] for event in usage if event["provider"] == provider and event["model"] == model]
        providers.append({
            "id": stable_id("model", provider, model), "provider": provider, "model": model,
            "status": "active", "health_status": "unknown", "last_seen_at": max(seen) if seen else None,
            "cost_profile": profile,
        })
    project_ids = sorted({str(event["project_id"]) for event in usage if event.get("project_id")})
    return {
        "schema": 1,
        "generated_at": generated_at,
        "source": "local-sqlite:provider_usage",
        "provider_usage": usage,
        "workflow_events": workflows,
        "providers": providers,
        "projects": [{"id": project, "name": project} for project in project_ids],
        "alerts": alerts(connection, usage, workflows, generated_at),
        "provider_quota": {"status": "unknown", "remaining": None, "source": None},
        "truncated": truncated,
    }


def set_budget(connection: sqlite3.Connection, args: argparse.Namespace) -> dict[str, Any]:
    provider = bounded_identifier(args.provider, "provider", required=True, max_length=160)
    model = bounded_identifier(args.model, "model", required=True, max_length=160)
    monthly_usd = optional_nonnegative(args.monthly_usd)
    monthly_tokens = None if args.monthly_tokens is None else nonnegative_int(args.monthly_tokens)
    if monthly_usd is None and monthly_tokens is None:
        raise ValueError("at least one budget is required")
    with connection:
        connection.execute(
            """INSERT INTO model_budgets(provider,model,monthly_budget_usd,monthly_token_budget,reset_day,updated_at)
               VALUES(?,?,?,?,?,?) ON CONFLICT(provider,model) DO UPDATE SET
               monthly_budget_usd=excluded.monthly_budget_usd,
               monthly_token_budget=excluded.monthly_token_budget,
               reset_day=excluded.reset_day, updated_at=excluded.updated_at""",
            (provider, model, monthly_usd, monthly_tokens, args.reset_day, now_iso()),
        )
    return {"ok": True, "provider": provider, "model": model, "cost_status": "owner-configured"}


class ThreadBoundedMixIn(socketserver.ThreadingMixIn):
    daemon_threads = True
    block_on_close = True

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self._worker_slots = threading.BoundedSemaphore(MAX_HTTP_WORKERS)
        super().__init__(*args, **kwargs)

    def process_request(self, request: Any, client_address: Any) -> None:
        if not self._worker_slots.acquire(blocking=False):
            request.close()
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self._worker_slots.release()
            raise

    def process_request_thread(self, request: Any, client_address: Any) -> None:
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._worker_slots.release()


class PrivateUnixHTTPServer(ThreadBoundedMixIn, socketserver.UnixStreamServer):
    allow_reuse_address = False

    def get_request(self) -> tuple[Any, Any]:
        request, client_address = super().get_request()
        request.settimeout(SOCKET_TIMEOUT_SECONDS)
        return request, client_address


def trusted_unix_socket(ledger: Path) -> Path:
    socket_path = ledger.parent / COLLECTOR_SOCKET_FILENAME
    socket_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    parent = socket_path.parent.stat()
    if not stat.S_ISDIR(parent.st_mode) or parent.st_uid != os.getuid() or (parent.st_mode & 0o077) != 0:
        raise RuntimeError("collector socket directory must be private and owner-controlled")
    try:
        existing = socket_path.lstat()
    except FileNotFoundError:
        return socket_path
    if not stat.S_ISSOCK(existing.st_mode) or existing.st_uid != os.getuid():
        raise RuntimeError("collector socket path is not a trusted owner socket")
    socket_path.unlink()
    return socket_path


def serve(ledger: Path, source: Path, port: int, interval: float) -> None:
    del port  # Deprecated TCP compatibility argument; no network listener is opened.
    ledger = validate_database_path(ledger, "ledger", create_parent=True)
    socket_path = trusted_unix_socket(ledger)

    class Handler(BaseHTTPRequestHandler):
        def send_json(self, payload: dict[str, Any], status: int = 200) -> None:
            raw = json.dumps(payload, separators=(",", ":")).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(raw)

        def authorize(self) -> bool:
            if self.headers.get("Host") != "localhost":
                self.send_json({"error": "invalid host"}, 403)
                return False
            if self.headers.get("Origin") is not None:
                self.send_json({"error": "browser origins are not accepted"}, 403)
                return False
            return True

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path in {"/", "/health"}:
                if self.headers.get("Host") != "localhost":
                    return self.send_json({"error": "invalid host"}, 403)
                return self.send_json({"ok": True, "role": "collector", "product_ui": "SHAGGY /models"})
            if parsed.path in {"/api/snapshot", "/api/v1/summary"}:
                if not self.authorize():
                    return
                query = parse_qs(parsed.query)
                try:
                    days = int(query.get("days", ["30"])[0])
                except (TypeError, ValueError):
                    return self.send_json({"error": "invalid days"}, 400)
                connection = connect(ledger)
                try:
                    return self.send_json(export_ledger(connection, max(1, min(400, days))))
                finally:
                    connection.close()
            return self.send_json({"error": "not found"}, 404)

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            if parsed.path not in {"/api/events", "/api/v1/usage-events", "/api/v1/workflow-events"}:
                return self.send_json({"error": "not found"}, 404)
            if not self.authorize():
                return
            if self.headers.get_content_type() != "application/json":
                return self.send_json({"error": "application/json required"}, 415)
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                return self.send_json({"error": "invalid body size"}, 400)
            if length <= 0 or length > MAX_HTTP_BODY_BYTES:
                return self.send_json({"error": "invalid body size"}, 413)
            try:
                raw = self.rfile.read(length)
                if len(raw) != length:
                    raise ValueError("incomplete request body")
                payload = json.loads(raw)
                if not isinstance(payload, dict):
                    raise ValueError("JSON object required")
                workflow = parsed.path.endswith("workflow-events") or payload.get("event_kind") not in (None, "usage")
                connection = connect(ledger)
                try:
                    if workflow:
                        result = ingest_workflow(connection, payload)
                    else:
                        with connection:
                            duplicate = upsert_provider(connection, payload)
                        result = {"accepted": True, "duplicate": duplicate}
                finally:
                    connection.close()
                return self.send_json(result, 200 if result.get("duplicate") else 202)
            except (ValueError, OSError, OverflowError, sqlite3.Error, json.JSONDecodeError) as error:
                print(f"collector request rejected: {type(error).__name__}", file=sys.stderr, flush=True)
                return self.send_json({"error": "invalid collector request"}, 400)

        def do_OPTIONS(self) -> None:
            self.send_json({"error": "browser access is not supported"}, 403)

        def log_message(self, format: str, *args: Any) -> None:
            print(f"[{self.log_date_time_string()}] {format % args}", flush=True)

    def collect_loop() -> None:
        while True:
            connection: sqlite3.Connection | None = None
            try:
                connection = connect(ledger)
                collect_hermes(connection, source)
            except (OSError, RuntimeError, sqlite3.Error, ValueError, OverflowError) as error:
                print(f"native usage collection failed: {error}", file=sys.stderr, flush=True)
            finally:
                if connection is not None:
                    connection.close()
            time.sleep(max(1.0, interval))

    threading.Thread(target=collect_loop, name="hermes-usage-collector", daemon=True).start()
    server = PrivateUnixHTTPServer(str(socket_path), Handler)
    try:
        os.chmod(socket_path, 0o600)
        socket_metadata = socket_path.lstat()
        if not stat.S_ISSOCK(socket_metadata.st_mode) or socket_metadata.st_uid != os.getuid() or (socket_metadata.st_mode & 0o077) != 0:
            raise RuntimeError("collector socket did not initialize privately")
        print(f"SHAGGY usage collector: unix://{socket_path} -> {ledger}", flush=True)
        server.serve_forever()
    finally:
        server.server_close()
        try:
            current = socket_path.lstat()
            if stat.S_ISSOCK(current.st_mode) and current.st_uid == os.getuid():
                socket_path.unlink()
        except FileNotFoundError:
            pass


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="SHAGGY local usage ledger")
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER)
    sub = parser.add_subparsers(dest="command", required=True)
    collect = sub.add_parser("collect-hermes")
    collect.add_argument("--source", type=Path, default=DEFAULT_HERMES_DB)
    preview = sub.add_parser("preview-hermes")
    preview.add_argument("--source", type=Path, default=DEFAULT_HERMES_DB)
    preview.add_argument("--days", type=int, default=30)
    preview.add_argument("--full", action="store_true")
    sub.add_parser("ingest-provider")
    sub.add_parser("ingest-workflow")
    export = sub.add_parser("export")
    export.add_argument("--days", type=int, default=30)
    budget = sub.add_parser("set-budget")
    budget.add_argument("--provider", required=True)
    budget.add_argument("--model", required=True)
    budget.add_argument("--monthly-usd", type=float)
    budget.add_argument("--monthly-tokens", type=int)
    budget.add_argument("--reset-day", type=int, choices=range(1, 29), default=1)
    server = sub.add_parser("serve")
    server.add_argument("--source", type=Path, default=DEFAULT_HERMES_DB)
    server.add_argument("--port", type=int, default=8765)
    server.add_argument("--interval", type=float, default=15.0)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "serve":
        serve(args.ledger.expanduser(), args.source.expanduser(), args.port, args.interval)
        return 0
    if args.command == "preview-hermes":
        try:
            print(json.dumps({"events": hermes_payloads(args.source, days=args.days, full=args.full)}, separators=(",", ":"), ensure_ascii=False))
            return 0
        except (ValueError, OSError, RuntimeError, OverflowError, sqlite3.Error) as error:
            print(json.dumps({"ok": False, "error": str(error)}), file=sys.stderr)
            return 2
    connection: sqlite3.Connection | None = None
    try:
        connection = connect(args.ledger)
        if args.command == "collect-hermes":
            result = collect_hermes(connection, args.source)
        elif args.command == "ingest-provider":
            with connection:
                duplicate = upsert_provider(connection, read_stdin_json())
            result = {"accepted": True, "duplicate": duplicate}
        elif args.command == "ingest-workflow":
            result = ingest_workflow(connection, read_stdin_json())
        elif args.command == "export":
            result = export_ledger(connection, args.days)
        elif args.command == "set-budget":
            result = set_budget(connection, args)
        else:
            raise ValueError(f"unknown command: {args.command}")
        print(json.dumps(result, separators=(",", ":"), ensure_ascii=False))
        return 0
    except (ValueError, OSError, RuntimeError, OverflowError, sqlite3.Error, json.JSONDecodeError) as error:
        print(json.dumps({"ok": False, "error": str(error)}), file=sys.stderr)
        return 2
    finally:
        if connection is not None:
            connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
