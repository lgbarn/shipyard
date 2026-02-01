# SUMMARY-2.3: state-read.sh Unit Tests

**Plan:** PLAN-2.3
**Status:** Complete
**Date:** 2026-02-01

## What Was Done

Created `/Users/lgbarn/Personal/shipyard/test/state-read.bats` with 6 unit tests covering the `state-read.sh` SessionStart hook script.

### Foundational Tests (Task 1 -- 3 tests)

1. **No .shipyard directory** -- Verifies the script outputs valid JSON containing "No Shipyard Project Detected" when no `.shipyard/` directory exists.
2. **hookSpecificOutput structure** -- Verifies the JSON output contains `hookSpecificOutput.hookEventName` set to `"SessionStart"`.
3. **Minimal tier includes STATE.md** -- Verifies that when `config.json` sets `context_tier: "minimal"`, the output includes STATE.md content (phase and status).

### Tier-Specific Tests (Task 2 -- 3 tests)

4. **Execution tier auto-detection** -- Verifies that `Status: building` auto-detects to execution tier and loads plan files from the phase directory.
5. **Planning tier includes PROJECT.md and ROADMAP.md** -- Verifies that planning status loads project and roadmap files.
6. **Missing config.json defaults to auto** -- Verifies the script does not crash when `config.json` is absent and still produces valid JSON.

## Deviations from Plan

- **Phases directory requirement:** Tests 2, 4, and 6 needed `mkdir -p .shipyard/phases` added because `state-read.sh` uses `find .shipyard/phases/` under `set -euo pipefail`. When the directory does not exist, `find` returns a non-zero exit code that kills the script. This is a real bug in `state-read.sh` (the `2>/dev/null` only suppresses stderr, not the exit code), but fixing the script was out of scope for this test plan. The tests work around it by creating the directory.

## Test Results

```
1..6
ok 1 state-read: no .shipyard directory outputs 'No Shipyard Project Detected' JSON
ok 2 state-read: always outputs valid JSON with hookSpecificOutput structure
ok 3 state-read: minimal state (STATE.md only) is included in output
ok 4 state-read: auto-detect building status resolves to execution tier
ok 5 state-read: planning tier includes PROJECT.md and ROADMAP.md
ok 6 state-read: missing config.json defaults to auto tier
```

## Commits

- `2ea0dcf` -- `shipyard(phase-2): add state-read.sh foundational tests`
- `b5e1c37` -- `shipyard(phase-2): add state-read.sh tier-specific tests`

## Known Issue (Documented, Not Fixed)

`state-read.sh` line 74: `find .shipyard/phases/ ...` fails with exit code 1 when `.shipyard/phases/` does not exist. Under `set -e`, this terminates the script. The `2>/dev/null` redirect only suppresses stderr output, not the non-zero exit code. A future hardening task should wrap this in `|| true` or check for directory existence first.
