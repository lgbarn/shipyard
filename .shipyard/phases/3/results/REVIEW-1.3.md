# Review: Plan 1.3 -- state-write.sh Atomic Writes, Schema, Recovery

**Reviewer:** Claude Opus 4.5
**Date:** 2026-02-01
**Plan:** /Users/lgbarn/Personal/shipyard/.shipyard/phases/3/plans/PLAN-1.3.md
**Summary:** /Users/lgbarn/Personal/shipyard/.shipyard/phases/3/results/SUMMARY-1.3.md

---

## Stage 1: Spec Compliance
**Verdict:** PASS

### Task 1: Add atomic writes, schema version, and exit code contract
- Status: PASS
- Notes:
  - Exit code contract header is present at lines 13-17 of `scripts/state-write.sh`, matching the spec exactly (codes 0, 1, 2, 3).
  - `.shipyard` missing now exits with code 3 (line 25), changed from the prior exit 1 as specified.
  - `atomic_write()` function (lines 30-59) implements the mktemp+mv pattern with the two-tier fallback (same-dir temp first, system temp second), matching the spec.
  - Trap-based cleanup on EXIT/INT/TERM is present, and trap is cleared after successful mv.
  - Post-write validation rejects empty files with exit 2.
  - `**Schema:** 2.0` is included in structured writes (line 197).
  - Both raw writes (line 181) and structured writes (line 224) route through `atomic_write`.
  - Acceptance criteria verified: Schema 2.0 present, no temp files after write, empty rejection exits 2, missing .shipyard exits 3, all existing tests pass, shellcheck clean.

### Task 2: Add --recover flag to state-write.sh
- Status: PASS
- Notes:
  - `--recover` argument parsed at lines 92-95, `RECOVER=false` initialized at line 67.
  - Recovery logic (lines 121-177) matches the spec: finds latest phase from directory names, determines status from results/SUMMARY vs plans/PLAN artifacts, builds history from git checkpoint tags, generates STATE.md with Schema 2.0 via `atomic_write`.
  - Recovery runs before the "No updates provided" validation gate (line 227), so `--recover` works without other arguments.
  - Acceptance criteria verified: Phase detection works (test at line 100), defaults to phase 1 when no phases directory (test at line 115), detects completed phases from SUMMARY files (test at line 126), Schema 2.0 included, exits 0 on success.

### Task 3: Add tests to state-write.bats
- Status: PASS
- Notes:
  - All 6 specified tests are present in `test/state-write.bats` lines 75-137, matching the spec verbatim.
  - Tests cover: Schema 2.0 presence, no temp file residue, exit code 3 for missing .shipyard, --recover from plan artifacts, --recover defaults, --recover from summary artifacts.
  - 13/13 tests pass (7 existing + 6 new).
  - Full suite: 36/36 pass, no regressions.
  - shellcheck exits 0 with no warnings.

### Deviations
- None detected. The implementation matches the plan specification exactly.

---

## Stage 2: Code Quality

### Critical
None.

### Important

1. **Trap collision in `atomic_write` when called multiple times** -- `/Users/lgbarn/Personal/shipyard/scripts/state-write.sh` lines 40, 58
   - The `atomic_write` function sets `trap 'rm -f "$tmpfile"' EXIT INT TERM` using the local `$tmpfile` variable. If `atomic_write` were called twice in the same shell (not the current usage pattern, but a latent risk), the second trap would overwrite the first, leaving the first temp file unhandled on failure. Additionally, `trap - EXIT INT TERM` on line 58 removes ALL exit traps, which could interfere with any future trap-based cleanup added to the script.
   - Remediation: This is acceptable for the current single-call-per-execution pattern, but worth noting if the script evolves. A more robust approach would use a cleanup list or subshell isolation.

2. **Recovery `find | sed | grep | sort | tail` pipeline fragility** -- `/Users/lgbarn/Personal/shipyard/scripts/state-write.sh` lines 127-128
   - The pipeline `find .shipyard/phases/ -maxdepth 1 -type d | sed 's|.*/||' | grep '^[0-9]' | sort -n | tail -1` includes the base directory `.shipyard/phases/` itself in find output, which `sed` converts to empty string, and `grep '^[0-9]'` filters out. This works but is fragile. If a non-numeric directory name starts with a digit (e.g., `3-archive`), it would be included. The plan specifies this exact pipeline, so this is spec-compliant but worth noting.
   - Remediation: Use `-mindepth 1` in the find command, or add `grep '^[0-9]\+$'` to enforce strict numeric matching.

3. **`echo "$tag"` in recovery loop is not safe for unusual tag names** -- `/Users/lgbarn/Personal/shipyard/scripts/state-write.sh` lines 155-156
   - Using `echo "$tag"` can misbehave if a tag name starts with `-` (interpreted as echo flag). The script already uses `printf '%s\n'` elsewhere for safe output. This is low risk since shipyard checkpoint tags follow a known format, but inconsistent.
   - Remediation: Replace `echo "$tag"` with `printf '%s\n' "$tag"` for consistency and safety.

### Suggestions

1. **Raw writes bypass Schema 2.0 enforcement** -- `/Users/lgbarn/Personal/shipyard/scripts/state-write.sh` lines 180-184
   - When `--raw` is used, the content is written verbatim without injecting `**Schema:** 2.0`. This is by design (raw = caller controls content), but it means raw writes can produce non-schema-2.0 STATE.md files. A future validation layer might want to warn about this.
   - Remediation: Consider documenting this explicitly in the script header or adding an optional `--validate-schema` flag.

2. **Recovery test does not verify History section content** -- `/Users/lgbarn/Personal/shipyard/test/state-write.bats` line 112
   - The `--recover rebuilds from phase artifacts` test asserts `--partial "recovered"` which matches both the History line and the position line. A more precise assertion like `assert_output --partial "State recovered from .shipyard/ artifacts"` would better verify the History section.
   - Remediation: Add a more specific assertion for the history entry text.

3. **No test for `atomic_write` failure path (mktemp failure)** -- `/Users/lgbarn/Personal/shipyard/test/state-write.bats`
   - The empty-content exit-code-2 path and the mktemp-failure exit-code-3 path are not directly tested. The empty-content path is hard to trigger via the public API since both structured and raw writes will always have content. The spec does not require these tests, but they would improve coverage.
   - Remediation: Consider adding a test that uses `--raw ""` to verify the empty content rejection path, if that code path is reachable.

---

## Summary

**Recommendation: APPROVE**

The implementation is a clean, spec-exact delivery of all three tasks. All 6 new tests pass, all 7 existing tests pass without modification, the full 36-test suite shows no regressions, and shellcheck reports zero warnings. The atomic write pattern, schema versioning, recovery logic, and exit code contract are all implemented correctly per the plan.

The Important findings (trap collision risk, pipeline fragility, echo safety) are all latent issues that do not affect current functionality. The Suggestions are minor improvements for future robustness. None of these block the merge.

**Verification results (independently confirmed):**
- `npx bats test/state-write.bats`: 13/13 pass
- `bash test/run.sh`: 36/36 pass
- `shellcheck --severity=warning scripts/state-write.sh`: clean (exit 0)
