#!/usr/bin/env python3
"""Sync measured Hermes usage into the SHAGGY usage ledger.

Reads session_model_usage from the local Hermes state database (read-only)
and emits usage events for POST /api/llm/usage/event.

Truth contract:
- input/output tokens come from provider API responses recorded by Hermes.
- cost uses actual_cost_usd when present, otherwise estimated_cost_usd.
- cache_read/cache_write/reasoning tokens are NOT folded into input/output;
  the ledger has no cache fields, so they stay unrepresented.
- latency is omitted (not measured per session).
- occurredAt carries the real event time (row last_seen) so history lands
  in the correct period instead of "now".

Modes:
  --json                 emit NDJSON events to stdout (no side effects)
  --post URL             POST events to the ingest endpoint; token read from
                         SHAGGY_USAGE_TOKEN env (never from argv)
Watermark dedup keeps repeat runs idempotent per (session, model) row.
"""

import argparse
import json
import os
import sqlite3
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_DB = Path.home() / ".hermes" / "state.db"
DEFAULT_WATERMARK = Path.home() / ".hermes" / "shaggy-usage-sync.json"
MAX_BATCH = 200


def iso_utc(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def load_rows(db_path: Path, days: int) -> list[dict]:
    cutoff = time.time() - days * 86_400
    uri = f"file:{db_path}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    try:
        rows = conn.execute(
            """
            SELECT session_id, model, billing_provider,
                   input_tokens, output_tokens,
                   cache_read_tokens, cache_write_tokens, reasoning_tokens,
                   estimated_cost_usd, actual_cost_usd, cost_status,
                   first_seen, last_seen
            FROM session_model_usage
            WHERE last_seen >= ?
            ORDER BY last_seen ASC
            """,
            (cutoff,),
        ).fetchall()
    finally:
        conn.close()
    keys = [
        "session_id", "model", "billing_provider",
        "input_tokens", "output_tokens",
        "cache_read_tokens", "cache_write_tokens", "reasoning_tokens",
        "estimated_cost_usd", "actual_cost_usd", "cost_status",
        "first_seen", "last_seen",
    ]
    return [dict(zip(keys, row)) for row in rows]


def to_event(row: dict) -> dict:
    cost = row["actual_cost_usd"] if row["actual_cost_usd"] is not None else (row["estimated_cost_usd"] or 0.0)
    return {
        "provider": (row["billing_provider"] or "hermes").strip() or "hermes",
        "model": (row["model"] or "unknown").strip() or "unknown",
        "inputTokens": int(row["input_tokens"] or 0),
        "outputTokens": int(row["output_tokens"] or 0),
        "costEstimate": float(cost or 0.0),
        "status": "success",
        "occurredAt": iso_utc(float(row["last_seen"])),
        "_sync": {
            "source": "hermes:state.db:session_model_usage",
            "sessionId": row["session_id"],
            "costStatus": row["cost_status"] or "unknown",
            "unimportedTokens": {
                "cacheRead": int(row["cache_read_tokens"] or 0),
                "cacheWrite": int(row["cache_write_tokens"] or 0),
                "reasoning": int(row["reasoning_tokens"] or 0),
            },
        },
    }


def row_key(row: dict) -> str:
    return f"{row['session_id']}|{row['model']}|{row['billing_provider']}"


def load_watermark(path: Path) -> dict:
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def save_watermark(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=1, sort_keys=True))


def post_events(url: str, token: str, events: list[dict]) -> tuple[int, int]:
    sent = failed = 0
    for event in events:
        payload = {k: v for k, v in event.items() if not k.startswith("_")}
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status in (200, 201):
                    sent += 1
                else:
                    failed += 1
        except Exception as exc:  # noqa: BLE001 - report and continue batch
            print(f"post failed for {payload['provider']}/{payload['model']}: {exc}", file=sys.stderr)
            failed += 1
    return sent, failed


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync Hermes usage into SHAGGY ledger")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--watermark", type=Path, default=DEFAULT_WATERMARK)
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--json", action="store_true", help="emit NDJSON to stdout")
    parser.add_argument("--post", metavar="URL", help="POST events to ingest endpoint")
    parser.add_argument("--full", action="store_true", help="ignore watermark, resend window")
    args = parser.parse_args()

    if not args.db.exists():
        print(f"database not found: {args.db}", file=sys.stderr)
        return 1

    rows = load_rows(args.db, args.days)
    watermark = {} if args.full else load_watermark(args.watermark)

    events, new_watermark = [], dict(watermark)
    for row in rows:
        key = row_key(row)
        last_seen = float(row["last_seen"])
        if not args.full and watermark.get(key, 0) >= last_seen:
            continue
        events.append(to_event(row))
        new_watermark[key] = last_seen

    if args.json:
        for event in events:
            print(json.dumps(event, separators=(",", ":")))
        print(f"# {len(events)} events ({len(rows)} rows scanned)", file=sys.stderr)
        return 0

    if args.post:
        token = os.environ.get("SHAGGY_USAGE_TOKEN", "").strip()
        if not token:
            print("SHAGGY_USAGE_TOKEN env var is required for --post", file=sys.stderr)
            return 1
        sent = failed = 0
        for offset in range(0, len(events), MAX_BATCH):
            batch_sent, batch_failed = post_events(args.post, token, events[offset:offset + MAX_BATCH])
            sent += batch_sent
            failed += batch_failed
        print(f"sent={sent} failed={failed} skipped={len(rows) - len(events)}", file=sys.stderr)
        if failed == 0:
            save_watermark(args.watermark, new_watermark)
        return 0 if failed == 0 else 2

    parser.error("choose --json or --post URL")
    return 2


if __name__ == "__main__":
    sys.exit(main())
