# Review: Plan 1.2

## Verdict: PASS

## Stage 1: Spec Compliance

**Verdict:** PASS -- all five must_haves are satisfied.

### Task 1: Input validation for --phase and --status
- **Status:** PASS
- `--phase` validated as integer at lines 61-64 (`^[0-9]+$` regex). Rejects non-integers with descriptive error to stderr.
- `--status` validated against 10-value enum at lines 66-75 using a `case` statement. Exact match to the plan's allowlist.

### Task 2: Replace printf '%b' with printf '%s\n'
- **Status:** PASS
- The entire state-building block (lines 93-120) uses `printf '%s\n'` exclusively.
- `grep "printf '%b'" scripts/state-write.sh` returns no matches (exit code 1).
- `shellcheck --severity=warning` produces zero output (clean pass).
- The implementation matches the plan's specified code structure: command group with `{ ... } > "$STATE_FILE"`.

### Task 3: Replace echo with printf '%s\n' for raw content
- **Status:** PASS
- Line 79: `printf '%s\n' "$RAW_CONTENT" > "$STATE_FILE"` -- matches plan exactly.
- Eliminates the risk of `echo` interpreting `-n`, `-e`, or `-E` prefixes in raw content.

### Task 4: shellcheck zero warnings
- **Status:** PASS
- `shellcheck --severity=warning scripts/state-write.sh` exits 0 with no output.

## Stage 2: Code Quality

### Critical
- None.

### Minor
- **Lines 111, 113:** `echo "$EXISTING"` pipes state file content through `echo`, which could misinterpret lines beginning with `-n`, `-e`, or `-E` in the existing state file. This was out of scope for Plan 1.2 (which only required fixing the `$RAW_CONTENT` echo), but is worth tracking for a future hardening pass. The risk is low because `$EXISTING` comes from `cat "$STATE_FILE"` (a file this script manages), not direct user input, and Markdown state files are unlikely to start lines with echo-flag patterns.
  - **File:** `/Users/lgbarn/Personal/shipyard/scripts/state-write.sh`, lines 111 and 113
  - **Remediation:** Replace `echo "$EXISTING" | grep ...` with `printf '%s\n' "$EXISTING" | grep ...` and similarly for the `sed` pipe. This should be scoped into a future plan or tracked as an issue.

### Positive
- Clean, readable implementation. The command-group pattern (`{ printf ... } > file`) is idiomatic and efficient (single file descriptor open).
- Validation error messages are descriptive and include the invalid value, aiding debugging.
- The enum allowlist is comprehensive (10 statuses covering all known workflow states).
- All three commits are atomic and well-described, making the change easy to bisect.
- The summary accurately describes what was done with no exaggerations or omissions.

## Summary

**Recommendation: APPROVE**

All five must_haves from the plan are met. shellcheck is clean. The critical `printf '%b'` injection vulnerability is fully eliminated. One minor residual `echo` usage on managed data (lines 111/113) is noted for future tracking but does not affect the security posture addressed by this plan.
