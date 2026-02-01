---
phase: lessons-learned
plan: "2.1"
wave: 2
dependencies: ["1.1", "1.2"]
must_haves:
  - Lessons from previous phases visible in state-read.sh output
  - Execution tier only (not planning or minimal)
  - Maximum 5 recent lessons displayed
  - Token overhead under 250 tokens (~50 lines max)
files_touched:
  - scripts/state-read.sh
  - test/state-read.bats
tdd: true
---

# Plan 2.1: Display Recent Lessons in Session Context

## Context

The final success criterion for Phase 5 requires that lessons from previous phases are visible in `state-read.sh` output at the execution tier, with a maximum of 5 recent lessons. This completes the feedback loop: lessons are captured during ship (Plan 1.2) and re-surfaced during build sessions.

`state-read.sh` currently loads plans and summaries in the execution tier block (lines 123-164). The lessons loading should be added after the existing execution-tier context loading, following the same pattern (check file existence, extract snippet, append to `state_context`).

This plan depends on Plans 1.1 and 1.2 because:
- Plan 1.1 defines the LESSONS.md format (needed to know what to parse)
- Plan 1.2 creates LESSONS.md files (needed for realistic testing)

The token budget from Phase 4 allows ~250 additional tokens. With 5 lessons at ~10 lines each truncated to first lines only, this stays within ~200 tokens.

## Dependencies

Plans 1.1 and 1.2 (Wave 2 -- runs after Wave 1 completes).

## Tasks

### Task 1: Write bats test for lessons in execution tier
**Files:** `test/state-read.bats`
**Action:** modify
**Description:**
1. Add a new test case to `test/state-read.bats` that verifies lessons appear in execution tier output.
2. Test setup:
   - Create `.shipyard/STATE.md` with `**Status:** building` and `**Current Phase:** 3` (triggers execution tier)
   - Create `.shipyard/LESSONS.md` with 3 sample lesson entries following the format from Plan 1.1:
     ```markdown
     # Shipyard Lessons Learned

     ## [2026-01-15] Phase 1: Security Hardening

     ### What Went Well
     - shellcheck caught issues early

     ### Pitfalls to Avoid
     - grep -oP is not POSIX-compatible

     ---

     ## [2026-01-20] Phase 2: Testing Foundation

     ### What Went Well
     - bats-core integrates well with npm

     ### Surprises / Discoveries
     - set -e interacts poorly with pipelines

     ---

     ## [2026-01-25] Phase 3: Reliability

     ### What Went Well
     - atomic writes prevent corruption

     ---
     ```
   - Create required `.shipyard/phases/3/` directory structure
3. Assert that the output contains "Recent Lessons" (the section header).
4. Assert that the output contains at least one lesson entry (e.g., "Phase 1" or "shellcheck").
5. Add a second test: when `.shipyard/LESSONS.md` does not exist, no "Recent Lessons" section appears in output.
6. Add a third test: when context tier is "planning" (not execution), no lessons appear even if LESSONS.md exists.

**Acceptance Criteria:**
- At least 3 new test cases added to `state-read.bats`
- Tests initially fail (TDD red phase) because state-read.sh does not yet load lessons
- Tests cover: lessons present in execution tier, absent when no file, absent in planning tier

### Task 2: Add lessons loading to execution tier in state-read.sh
**Files:** `scripts/state-read.sh`
**Action:** modify
**Description:**
1. Locate the execution tier block in `state-read.sh` (the `if [ "$context_tier" = "execution" ] || [ "$context_tier" = "full" ]; then` block, lines 124-164).
2. After the existing plan/summary loading section (after the `fi` that closes the `if [ -n "$phase_dir" ]` block, around line 162-163), but still inside the execution/full tier conditional, add:

   ```bash
   # Load recent lessons (execution/full tier only, max 5)
   if [ -f ".shipyard/LESSONS.md" ]; then
       # Extract last 5 date-stamped sections (headers + first content line each)
       lesson_headers=$(grep -n "^## \[" ".shipyard/LESSONS.md" 2>/dev/null || echo "")
       if [ -n "$lesson_headers" ]; then
           # Get line numbers of last 5 headers
           last_five=$(echo "$lesson_headers" | tail -5)
           lesson_snippet=""
           while IFS=: read -r line_num header_text; do
               # Extract header + next 8 lines (covers one section)
               chunk=$(sed -n "${line_num},$((line_num + 8))p" ".shipyard/LESSONS.md" 2>/dev/null || echo "")
               lesson_snippet="${lesson_snippet}${chunk}\n"
           done <<< "$last_five"
           if [ -n "$lesson_snippet" ]; then
               state_context="${state_context}\n### Recent Lessons Learned\n${lesson_snippet}\n"
           fi
       fi
   fi
   ```

3. This block must be inside the execution/full tier conditional but does not need to be inside the `if [ -n "$phase" ]` block (lessons are not phase-specific).
4. Keep the total addition under 20 lines of shell code.
5. Use only POSIX-compatible tools (no `grep -P`, no GNU-specific flags).

**Acceptance Criteria:**
- The lessons loading block exists inside the execution/full tier conditional
- It checks for `.shipyard/LESSONS.md` existence before reading
- It limits output to last 5 sections
- No GNU-specific commands used (POSIX-compatible grep, sed, tail)
- `shellcheck --severity=warning scripts/state-read.sh` passes

### Task 3: Run tests and measure token impact
**Files:** `scripts/state-read.sh`, `test/state-read.bats`
**Action:** test
**Description:**
1. Run the new bats tests: `npx bats test/state-read.bats` -- all should pass (TDD green phase).
2. Run the full test suite: `bash test/run.sh` -- all should pass.
3. Run shellcheck: `shellcheck --severity=warning scripts/state-read.sh` -- should exit 0.
4. Measure token impact:
   - Create a test `.shipyard/` with 5 lessons in LESSONS.md and execution-tier state
   - Run `bash scripts/state-read.sh | jq -r '.hookSpecificOutput.additionalContext' | wc -w`
   - Compare with baseline (without LESSONS.md) -- delta should be under 80 words (~250 tokens)
5. Verify the lesson snippet in output contains section headers from LESSONS.md.

**Acceptance Criteria:**
- All new tests pass
- All existing tests pass
- shellcheck passes
- Token overhead from lessons is under 250 tokens (~80 words)
- Lesson content appears in execution tier output but not planning tier

## Verification

```bash
# 1. New tests pass
npx bats test/state-read.bats
# Expected: all pass including new lesson tests

# 2. Full test suite
bash test/run.sh
# Expected: exit 0

# 3. Shellcheck
shellcheck --severity=warning scripts/state-read.sh
# Expected: exit 0

# 4. Token impact measurement
cd /tmp && rm -rf lesson-token-test && mkdir lesson-token-test && cd lesson-token-test
mkdir -p .shipyard/phases/1
cat > .shipyard/STATE.md << 'EOF'
**Status:** building
**Current Phase:** 1
EOF
# Baseline (no lessons)
BASELINE=$(bash /Users/lgbarn/Personal/shipyard/scripts/state-read.sh | jq -r '.hookSpecificOutput.additionalContext' | wc -w)
# With lessons
cat > .shipyard/LESSONS.md << 'EOF'
# Shipyard Lessons Learned

## [2026-01-15] Phase 1: Security

### What Went Well
- shellcheck caught issues early

### Pitfalls to Avoid
- grep -oP not POSIX

---

## [2026-01-20] Phase 2: Testing

### What Went Well
- bats-core works well

---
EOF
WITH_LESSONS=$(bash /Users/lgbarn/Personal/shipyard/scripts/state-read.sh | jq -r '.hookSpecificOutput.additionalContext' | wc -w)
DELTA=$((WITH_LESSONS - BASELINE))
echo "Baseline: ${BASELINE} words, With lessons: ${WITH_LESSONS} words, Delta: ${DELTA} words"
# Expected: Delta < 80 words

# 5. Lessons appear in execution tier
bash /Users/lgbarn/Personal/shipyard/scripts/state-read.sh | jq -r '.hookSpecificOutput.additionalContext' | grep -q "Recent Lessons"
# Expected: exit 0
```
