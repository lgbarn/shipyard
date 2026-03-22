# STATE.json Schema Reference

This document is the authoritative reference for `.shipyard/STATE.json` — the machine-readable state file used by Shipyard to track project position across sessions.

---

## Overview

`STATE.json` is a single JSON file stored at `.shipyard/STATE.json`. It is the single source of truth for the current phase, execution status, and last known position within a Shipyard project. Shipyard agents read it at session start (via `scripts/state-read.sh`) and write to it at phase transitions (via `scripts/state-write.sh`).

The file is:

- **Gitignored** — `.shipyard/` is never committed. It is local project state only.
- **Machine-written** — always written through `state-write.sh`, never edited by hand.
- **Integrity-protected** — a SHA-256 checksum file (`.shipyard/STATE.json.sha256`) is written alongside every update.
- **Backed up on write** — the previous copy is saved to `.shipyard/STATE.json.bak` before each update.

---

## Schema

```json
{
  "schema":     3,
  "phase":      2,
  "position":   "Building plan 1 of 3",
  "status":     "in_progress",
  "updated_at": "2026-03-21T14:00:00Z",
  "blocker":    null
}
```

### Fields

| Field        | Type            | Required | Description                                                                 |
|--------------|-----------------|----------|-----------------------------------------------------------------------------|
| `schema`     | number          | yes      | Schema version. Current value: `3`. Incremented on breaking format changes. |
| `phase`      | number          | yes      | Current phase number. Must be a non-negative integer.                        |
| `position`   | string          | yes      | Human-readable description of the current position within the phase.         |
| `status`     | string          | yes      | Workflow status. Must be one of the 10 valid values listed below.            |
| `updated_at` | string (ISO8601)| yes      | UTC timestamp of the last write. Format: `YYYY-MM-DDTHH:MM:SSZ`.            |
| `blocker`    | string or null  | yes      | Description of what is blocking progress, or `null` when not blocked.       |

All six fields are always present. There are no optional keys.

---

## Valid Status Values

The `status` field accepts exactly these 10 values:

| Value                | Meaning                                                                 |
|----------------------|-------------------------------------------------------------------------|
| `ready`              | Phase is initialized but work has not started.                          |
| `planned`            | Plans have been written; ready to begin building.                       |
| `planning`           | A planning agent is currently active.                                   |
| `building`           | A builder agent is currently active.                                    |
| `in_progress`        | Work is underway (general in-flight state).                             |
| `complete`           | Phase finished successfully with all acceptance criteria met.           |
| `complete_with_gaps` | Phase finished but with known gaps or skipped items.                    |
| `shipped`            | Project delivered; milestone closed.                                    |
| `blocked`            | Progress cannot continue; a `blocker` description should be set.       |
| `paused`             | Work intentionally paused; can be resumed later.                        |

Passing any other value to `state-write.sh --status` exits with code `1`.

### Context-Tier Auto-Detection

`state-read.sh` uses the status value to auto-select how much context to inject at session start:

- `building` or `in_progress` → **execution tier** (loads plans, summaries, lessons, history, notes)
- All other values → **planning tier** (loads PROJECT.md and ROADMAP.md only)

---

## Integrity Mechanisms

### SHA-256 Checksum

Every write to `STATE.json` produces a companion file:

```
.shipyard/STATE.json.sha256
```

This file contains only the hex digest of the state file. At session start, `state-read.sh` compares the stored digest against a freshly computed one. If they diverge, the state is treated as corrupt.

```bash
# Written by state-write.sh after every successful update:
shasum -a 256 "$STATE_FILE" | cut -d' ' -f1 > "${STATE_FILE}.sha256"
```

### Backup File

Before every write, `state-write.sh` copies the existing state to a backup:

```
.shipyard/STATE.json.bak
```

If `STATE.json` fails checksum or structure validation, `state-read.sh` automatically falls back to `.bak`:

1. Checksum fails or required fields (`schema`, `phase`, `status`) are missing → check `.bak`
2. `.bak` is valid → restore it in place, recompute checksum, continue
3. `.bak` is also invalid → output error JSON and exit with code `2`

### Atomic Writes

`state-write.sh` never writes directly to `STATE.json`. Instead it:

1. Creates a temporary file via `mktemp` in the same directory.
2. Validates the content (non-empty, valid JSON, `schema` field present).
3. Moves the temp file over `STATE.json` with `mv` — a POSIX-atomic operation on the same filesystem.

This prevents a partially-written file from being observed by a concurrent reader.

---

## Schema Evolution

| Version | Format        | Notes                                                                 |
|---------|---------------|-----------------------------------------------------------------------|
| v1      | `STATE.md`    | Plain-text Markdown. No machine-readable structure.                   |
| v2      | `STATE.md`    | Structured Markdown with key-value sections. Parseable but fragile.  |
| v3      | `STATE.json`  | Current format. Introduced strict JSON, checksums, and atomic writes. |

The `schema` field in the JSON allows `state-read.sh` to detect version mismatches. If a legacy `STATE.md` is found and `STATE.json` is absent, `state-read.sh` removes the legacy file and continues as if no state exists (prompting a fresh start or recovery).

---

## Recovery

If `STATE.json` and its backup are both corrupt or missing, the recovery command rebuilds the file from available artifacts in `.shipyard/`:

```bash
bash scripts/state-write.sh --recover
```

Recovery logic:

1. Scans `.shipyard/phases/` to find the highest-numbered phase directory.
2. Checks whether that phase has result SUMMARY files → sets `status` to `complete`.
3. Checks whether that phase has plan files only → sets `status` to `planned`.
4. Falls back to `status: ready` if no artifacts are found.
5. Writes a new `STATE.json` (and `.sha256`) with the inferred values.
6. Appends a recovery entry to `HISTORY.md`.
7. If git is available, also scans for `shipyard-checkpoint-*` tags and appends them to `HISTORY.md`.

Exit codes from `state-write.sh --recover`:

| Code | Meaning                                                   |
|------|-----------------------------------------------------------|
| `0`  | Success — STATE.json written (recovered).                 |
| `2`  | Post-write validation failed (generated file is invalid). |
| `3`  | `.shipyard/` directory missing; `mktemp` failed.          |

---

## Locking

In team mode (`SHIPYARD_TEAMS_ENABLED=true`), `state-write.sh` acquires a process-level lock before writing:

- **Mechanism:** `mkdir` on a path derived from the project directory hash — `mkdir` is atomic on all POSIX systems.
- **Lock path:** `${TMPDIR:-/tmp}/shipyard-state-<12-char-hash>.lock`
- **PID file:** The owning PID is written inside the lock directory for stale-lock detection.
- **Stale lock:** If the owning process is no longer alive (`kill -0` fails), the lock is cleared and reacquired.
- **Retry limit:** Configurable via `SHIPYARD_LOCK_MAX_RETRIES` (default: `120`, range: 1–600). Retries use exponential backoff capped at 1 second per attempt.
- **Timeout exit:** Exceeding max retries exits with code `4`.

Locking is a no-op when `SHIPYARD_TEAMS_ENABLED` is absent or not `true` (solo mode).

---

## Example

A complete `STATE.json` for a project midway through Phase 2:

```json
{
  "schema": 3,
  "phase": 2,
  "position": "Building plan 1 of 3",
  "status": "in_progress",
  "updated_at": "2026-03-21T14:00:00Z",
  "blocker": null
}
```

A blocked state with a blocker description:

```json
{
  "schema": 3,
  "phase": 3,
  "position": "Waiting on external API credentials",
  "status": "blocked",
  "updated_at": "2026-03-21T18:30:00Z",
  "blocker": "API key not yet provisioned by ops team"
}
```

A completed project:

```json
{
  "schema": 3,
  "phase": 4,
  "position": "All phases complete",
  "status": "shipped",
  "updated_at": "2026-03-21T22:00:00Z",
  "blocker": null
}
```

---

## Related Files

| File                           | Purpose                                                   |
|--------------------------------|-----------------------------------------------------------|
| `.shipyard/STATE.json.sha256`  | SHA-256 checksum for integrity verification               |
| `.shipyard/STATE.json.bak`     | Backup of the previous state (overwritten on each write)  |
| `.shipyard/HISTORY.md`         | Append-only audit trail of all state transitions          |
| `.shipyard/NOTES.md`           | Working notes for the current phase (cleared on complete) |
| `scripts/state-write.sh`       | Authoritative writer — all writes go through this script  |
| `scripts/state-read.sh`        | SessionStart hook — reads and validates state for context |
