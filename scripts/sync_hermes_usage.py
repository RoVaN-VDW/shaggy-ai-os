#!/usr/bin/env python3
"""Deprecated compatibility entry point for Hermes usage synchronization.

Default mode triggers the canonical local SQLite collector. Historical --json and
--post modes use the collector's read-only preview command; --json never writes a
ledger or watermark. Native cumulative rows have status=unknown because Hermes
provides no success/failure outcome evidence.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
COLLECTOR = ROOT / "local_usage_ledger.py"
DEFAULT_DB = Path.home() / ".hermes" / "state.db"
DEFAULT_LEDGER = Path.home() / "Library" / "Application Support" / "SHAGGY" / "usage" / "usage.sqlite3"
DEFAULT_WATERMARK = Path.home() / "Library" / "Application Support" / "SHAGGY" / "usage" / "hermes-sync-watermark.json"
DEFAULT_URL = "http://127.0.0.1:3000/api/llm/usage/event"


def parser() -> argparse.ArgumentParser:
    cli = argparse.ArgumentParser(description="Deprecated wrapper around the canonical SHAGGY local usage collector")
    cli.add_argument("--db", type=Path, default=DEFAULT_DB)
    cli.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER)
    cli.add_argument("--days", type=int, default=30)
    cli.add_argument("--watermark", type=Path, default=DEFAULT_WATERMARK)
    cli.add_argument("--url", help="compatibility alias for the legacy ingest URL")
    cli.add_argument("--token-env", default="SHAGGY_USAGE_TOKEN")
    cli.add_argument("--json", action="store_true", help="emit side-effect-free Hermes cumulative NDJSON")
    cli.add_argument("--post", nargs="?", const=DEFAULT_URL, metavar="URL", help="post preview rows to the legacy SHAGGY ingest route")
    cli.add_argument("--full", action="store_true", help="ignore the preview day window")
    return cli


def collector_preview(args: argparse.Namespace) -> list[dict[str, object]]:
    command = [sys.executable, str(COLLECTOR), "preview-hermes", "--source", str(args.db), "--days", str(max(1, args.days))]
    if args.full:
        command.append("--full")
    completed = subprocess.run(command, check=True, text=True, capture_output=True)
    payload = json.loads(completed.stdout)
    events = payload.get("events")
    if not isinstance(events, list):
        raise RuntimeError("canonical preview returned an invalid event list")
    return events


def compatibility_event(event: dict[str, object]) -> dict[str, object]:
    return {
        "id": event["event_id"],
        "eventId": event["event_id"],
        "timestamp": event["occurred_at"],
        "occurredAt": event["occurred_at"],
        "projectId": event.get("project_id"),
        "provider": event["provider"],
        "model": event["model"],
        "inputTokens": event.get("input_tokens", 0),
        "outputTokens": event.get("output_tokens", 0),
        "cacheReadTokens": event.get("cache_read_tokens", 0),
        "cacheWriteTokens": event.get("cache_write_tokens", 0),
        "reasoningTokens": event.get("reasoning_tokens", 0),
        "apiCallCount": event.get("api_call_count", 1),
        "estimatedCostUsd": event.get("estimated_cost_usd"),
        "actualCostUsd": event.get("actual_cost_usd"),
        "costStatus": event.get("cost_status", "unknown"),
        "status": "unknown",
        "_sync": {
            "source": "hermes:state.db:session_model_usage",
            "session_id": event.get("source_session_id"),
            "task": event.get("task"),
            "first_seen_at": event.get("first_seen_at"),
            "last_seen_at": event.get("occurred_at"),
            "counter_semantics": "session-model cumulative snapshot",
            "trust_level": "native-aggregate",
        },
    }


def load_post_watermark(path: Path) -> dict[str, object]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return {}


def pending_post_events(path: Path, events: list[dict[str, object]], *, full: bool) -> list[dict[str, object]]:
    if full:
        return events
    watermark = load_post_watermark(path)
    posted_events = watermark.get("posted_events")
    posted_ids = set(posted_events) if isinstance(posted_events, dict) else set()
    legacy_cutoff = str(watermark.get("last_posted_at") or "")
    return [
        event
        for event in events
        if str(event.get("event_id") or "") not in posted_ids
        and (posted_ids or str(event.get("occurred_at") or "") > legacy_cutoff)
    ]


def save_post_watermark(path: Path, events: list[dict[str, object]]) -> None:
    path = Path(os.path.abspath(path.expanduser()))
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(path.parent, 0o700)
    previous = load_post_watermark(path)
    previous_posted = previous.get("posted_events")
    posted_events = dict(previous_posted) if isinstance(previous_posted, dict) else {}
    for event in events:
        event_id = str(event.get("event_id") or "")
        if event_id:
            posted_events[event_id] = str(event.get("occurred_at") or "")
    latest = max(
        [str(previous.get("last_posted_at") or ""), *(str(event.get("occurred_at") or "") for event in events)],
        default="",
    )
    descriptor, temporary = tempfile.mkstemp(prefix=".hermes-sync-", dir=path.parent)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump({"last_posted_at": latest, "posted_events": posted_events}, handle, separators=(",", ":"))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def post_events(args: argparse.Namespace, events: list[dict[str, object]]) -> dict[str, int]:
    events = pending_post_events(args.watermark, events, full=args.full)
    target_url = args.url or args.post
    parsed = urlsplit(target_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("invalid --url")
    origin = f"{parsed.scheme}://{parsed.netloc}"
    token = os.environ.get(args.token_env, "").strip()
    posted = 0
    for event in events:
        body = json.dumps(compatibility_event(event), separators=(",", ":")).encode()
        headers = {"Content-Type": "application/json", "Origin": origin}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        with urlopen(Request(target_url, data=body, headers=headers, method="POST"), timeout=10) as response:
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(f"legacy ingest returned HTTP {response.status}")
        posted += 1
    save_post_watermark(args.watermark, events)
    return {"scanned": len(events), "posted": posted}


def main() -> int:
    args = parser().parse_args()
    if args.json or args.post:
        try:
            events = collector_preview(args)
            if args.json:
                for event in events:
                    print(json.dumps(compatibility_event(event), separators=(",", ":"), ensure_ascii=False))
                return 0
            print(json.dumps(post_events(args, events), separators=(",", ":")))
            return 0
        except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
            print(json.dumps({"ok": False, "error": str(error)}), file=sys.stderr)
            return 2

    completed = subprocess.run(
        [sys.executable, str(COLLECTOR), "--ledger", str(args.ledger), "collect-hermes", "--source", str(args.db)],
        check=False,
    )
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
