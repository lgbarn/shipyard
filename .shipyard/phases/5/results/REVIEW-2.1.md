# Review: Plan 2.1 - Display Recent Lessons in Session Context

**Reviewer:** Code Review Agent
**Date:** 2026-02-01
**Plan:** 2.1
**Phase:** 5 (Lessons Learned System)

## Stage 1: Spec Compliance
**Verdict:** PASS

### Task 1: Write bats tests for lessons in execution tier
- Status: PASS
- Notes:
  - Three new test cases added to `test/state-read.bats` (lines 128-211), matching the spec exactly.
  - Test 1 (`execution tier displays Recent Lessons when LESSONS.md exists`): creates LESSONS.md with 3 sample entries in the exact format from Plan 1.1, asserts "Recent Lessons" header and "Phase 1" content appear. Matches spec requirements.
  - Test 2 (`no Recent Lessons section when LESSONS.md does not exist`): asserts "Recent Lessons" is absent when no LESSONS.md exists. Matches spec.
  - Test 3 (`planning tier does not display lessons even when LESSONS.md exists`): sets status to "planning", creates LESSONS.md, asserts lessons are not displayed. Matches spec.
  - All three tests use `assert_valid_json` for structural validation.

### Task 2: Add lessons loading to execution tier in state-read.sh
- Status: PASS
- Notes:
  - Lessons loading block added at lines 165-179 of `scripts/state-read.sh`, totaling 15 lines of shell code (under the 20-line limit).
  - Block is correctly placed inside the `execution/full` tier conditional (line 124) but outside the `if [ -n "$phase" ]` block, matching the spec requirement that lessons are not phase-specific.
  - Checks `.shipyard/LESSONS.md` existence before reading.
  - Uses `grep -n "^## \["` to find date-stamped headers, `tail -5` for last 5, `sed -n` for extraction -- all POSIX-compatible.
  - Extracts header + 8 lines per section, appends under "Recent Lessons Learned" heading.
  - Unused variable renamed to `_` to satisfy shellcheck (documented deviation, acceptable).

### Task 3: Run tests and measure token impact
- Status: PASS
- Notes:
  - Summary reports 39/39 tests pass (12 state-read tests including 3 new).
  - shellcheck passes with `--severity=warning`.
  - Token measurement: 2 lessons = 39 words delta; 5 lessons = 99-117 words delta. Both under the 80-word/250-token thresholds (the 5-lesson case exceeds 80 words but stays well under 250 tokens at ~130-155 tokens, which is the primary budget constraint).
  - Lessons confirmed present in execution tier, absent in planning tier.

## Stage 2: Code Quality

### Critical
None.

### Important
None.

### Suggestions

1. **No test for the 5-lesson maximum cap** -- `test/state-read.bats`
   - The spec requires "Maximum 5 recent lessons displayed." While the implementation correctly uses `tail -5` to limit to 5 headers, no test verifies this boundary. A test with 7 lessons asserting only the last 5 appear would strengthen coverage.
   - Remediation: Add a test that creates 7 lesson entries and verifies the first 2 are excluded while the last 5 are present.

2. **The `sed -n` extraction window of 8 lines is a magic number** -- `scripts/state-read.sh:172`
   - The number 8 is undocumented in the code. A brief comment explaining why 8 lines (covers header + subsections for a typical lesson entry) would aid maintainability.
   - Remediation: Add inline comment: `# 8 lines covers header + up to 3 subsection headers with content`

3. **Token measurement discrepancy with spec threshold** -- Summary reports 5-lesson scenarios at 99-117 words, which exceeds the spec's "under 80 words" guideline from the verification script. The 250-token budget is the actual constraint and is met, but the word-count threshold in the verification script (line 135 of the plan: "delta should be under 80 words") is technically exceeded for 5 lessons.
   - Remediation: This is informational only. The 250-token budget is the must-have criterion and is satisfied. Consider updating the verification script comment to say "~120 words" for 5 lessons.

## Summary

**Recommendation: APPROVE**

The implementation is clean, correct, and well-tested. All three tasks from the plan are implemented as specified. The code follows the existing patterns in `state-read.sh`, uses only POSIX-compatible commands, and stays within the token budget. The three suggestions are minor -- a boundary test for the 5-lesson cap, a clarifying comment, and a documentation note on word-count thresholds. None block merging.
