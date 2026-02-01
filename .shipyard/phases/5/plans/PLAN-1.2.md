---
phase: lessons-learned
plan: "1.2"
wave: 1
dependencies: []
must_haves:
  - After /shipyard:ship, user is prompted with captured lessons for review
  - Approved lessons appended to .shipyard/LESSONS.md with timestamp and phase
  - If CLAUDE.md exists, a Lessons Learned section is appended or updated
  - User can skip lesson capture without blocking ship flow
files_touched:
  - commands/ship.md
tdd: false
---

# Plan 1.2: Add Lessons-Learned Capture Step to Ship Command

## Context

The ship command (`commands/ship.md`) needs a new step that prompts the user to review and approve lessons learned before finalizing delivery. This step should be inserted between "Determine Scope" (Step 3) and "Present Delivery Options" (Step 4), since at that point all verification gates have passed and context is fresh, but no irreversible delivery action has been taken.

The step invokes the `shipyard:lessons-learned` skill (created in Plan 1.1) and handles:
1. Extracting candidate lessons from SUMMARY.md files
2. Presenting structured prompts to the user
3. Persisting approved lessons to `.shipyard/LESSONS.md`
4. Optionally updating project CLAUDE.md

This plan modifies only `commands/ship.md`, which is not touched by Plan 1.1 (skill + build.md) or Plan 2.1 (state-read.sh), so it runs in parallel with Plan 1.1.

## Dependencies

None (Wave 1). Note: This plan references the `shipyard:lessons-learned` skill from Plan 1.1, but both are markdown instruction files -- the skill just needs to exist at execution time, not at plan-writing time. Both plans can be built in the same wave.

## Tasks

### Task 1: Insert Step 3a (Capture Lessons Learned) into ship.md
**Files:** `commands/ship.md`
**Action:** modify
**Description:**
1. Locate the boundary between Step 3 (Determine Scope, ends around line 143) and Step 4 (Present Delivery Options, starts at line 145).
2. Insert a new "## Step 3a: Capture Lessons Learned" section between them. The section should contain:

   ```markdown
   ## Step 3a: Capture Lessons Learned

   Invoke the `shipyard:lessons-learned` skill for format and quality guidance.

   ### Extract Candidate Lessons

   Read all SUMMARY.md files in the shipping scope:
   - For phase scope: `.shipyard/phases/{N}/results/SUMMARY-*.md`
   - For milestone scope: all phases' SUMMARY files

   Extract content from "Issues Encountered" and "Decisions Made" sections as candidate lessons.

   ### Present to User

   Use AskUserQuestion to present:

   > **Phase {N} is complete. Let's capture lessons learned.**
   >
   > These will be saved to `.shipyard/LESSONS.md` and optionally to your project's `CLAUDE.md`.
   >
   > Based on the build summaries, here are some candidate lessons:
   > {Pre-populated from SUMMARY.md extracts, or "No candidates found" if empty}
   >
   > **What went well?**
   > **What surprised you or what did you learn?**
   > **What should future work avoid?**
   > **Any process improvements?**
   >
   > Edit, add to, or approve the above. Type "skip" to skip lesson capture.

   ### Persist Lessons

   If user does not type "skip":

   1. Format lessons as a markdown section following the LESSONS.md format from the skill:
      ```
      ## [YYYY-MM-DD] Phase N: {Phase Name}

      ### What Went Well
      - {user input}

      ### Surprises / Discoveries
      - {user input}

      ### Pitfalls to Avoid
      - {user input}

      ### Process Improvements
      - {user input}

      ---
      ```
   2. Append to `.shipyard/LESSONS.md` (create file with `# Shipyard Lessons Learned` header if it does not exist).
   3. If `CLAUDE.md` exists in the project root:
      - Ask user: "Update CLAUDE.md with these lessons? (y/n)"
      - If yes: check for existing `## Lessons Learned` section
        - If section exists: append new lessons under it (with date separator)
        - If not: append `## Lessons Learned` section at end of file
   4. Commit: `shipyard(phase-{N}): capture lessons learned`

   If user types "skip", continue to Step 4 with no lesson capture.
   ```

3. The inserted section should be approximately 45-55 lines of markdown.
4. Do NOT renumber existing steps (Step 4, 5, etc. remain as-is since "3a" is a sub-step).

**Acceptance Criteria:**
- `commands/ship.md` contains a "## Step 3a: Capture Lessons Learned" heading
- The step appears between Step 3 (Determine Scope) and Step 4 (Present Delivery Options)
- The step references `shipyard:lessons-learned` skill
- The step includes AskUserQuestion prompt with the four structured questions
- The step handles "skip" case
- The step handles LESSONS.md creation and append
- The step handles CLAUDE.md detection and optional update

### Task 2: Update Step 9 (Final Message) to mention lessons
**Files:** `commands/ship.md`
**Action:** modify
**Description:**
1. Locate Step 9 (Final Message) at the end of `commands/ship.md` (lines 220-229).
2. Add a conditional line to the final message template, after the existing content:

   ```markdown
   > If lessons were captured in Step 3a:
   > "Lessons learned have been saved to `.shipyard/LESSONS.md`."
   ```

3. This is a 2-3 line addition to the existing final message block.

**Acceptance Criteria:**
- Step 9 mentions `.shipyard/LESSONS.md` conditionally
- The mention is inside the existing final message quote block

### Task 3: Validate ship.md structure and step ordering
**Files:** `commands/ship.md`
**Action:** test
**Description:**
1. Verify Step 3a exists: `grep -q "Step 3a" commands/ship.md`
2. Verify step ordering is correct by extracting all `## Step` headings and confirming 3a appears between 3 and 4:
   ```bash
   grep "^## Step" commands/ship.md
   ```
   Expected order: 0, 1, 2, 2a, 2b, 3, 3a, 4, 5, 6, 7, 8, 9
3. Verify the skill reference: `grep -q "lessons-learned" commands/ship.md`
4. Verify LESSONS.md format is shown: `grep -q "LESSONS.md" commands/ship.md`
5. Verify skip handling: `grep -q "skip" commands/ship.md`
6. Run existing test suite (`test/run.sh`) to confirm no regressions.

**Acceptance Criteria:**
- Step ordering is correct (3a between 3 and 4)
- Skill reference present
- LESSONS.md and CLAUDE.md both referenced
- Skip handling documented
- Existing tests pass

## Verification

```bash
# 1. Step 3a exists
grep -q "## Step 3a" commands/ship.md && echo "OK: Step 3a found" || echo "FAIL: Step 3a missing"

# 2. Step ordering
grep "^## Step" commands/ship.md
# Expected: Steps in order 0, 1, 2, 2a, 2b, 3, 3a, 4, 5, 6, 7, 8, 9

# 3. Key references present
grep -c "lessons-learned" commands/ship.md
# Expected: >= 1

grep -c "LESSONS.md" commands/ship.md
# Expected: >= 2

grep -c "CLAUDE.md" commands/ship.md
# Expected: >= 1

# 4. Skip handling
grep -q '"skip"' commands/ship.md || grep -q "'skip'" commands/ship.md
# Expected: exit 0

# 5. Regression tests
bash test/run.sh
# Expected: exit 0
```
