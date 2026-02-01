---
phase: lessons-learned
plan: "1.1"
wave: 1
dependencies: []
must_haves:
  - Skill file under 200 lines with proper frontmatter
  - Skill covers lesson quality standards, structured prompts, LESSONS.md format, CLAUDE.md integration
  - build.md emphasizes Issues Encountered section for lesson seeding
files_touched:
  - skills/lessons-learned/SKILL.md
  - commands/build.md
tdd: false
---

# Plan 1.1: Create Lessons-Learned Skill + Builder Emphasis

## Context

Phase 5 requires a new skill (`skills/lessons-learned/SKILL.md`) that instructs agents on how to extract, format, and persist lessons. This skill is the central reference for all lesson capture behavior -- both the ship command (Plan 1.2) and the state-read integration (Plan 2.1) depend on the LESSONS.md format it defines.

Additionally, `commands/build.md` needs a minor addition to emphasize that the builder should document discoveries thoroughly in the "Issues Encountered" section of SUMMARY.md, since these will seed lesson suggestions at ship time. This is a low-impact change to an existing section.

These two files have no overlap with `commands/ship.md` (Plan 1.2) or `scripts/state-read.sh` (Plan 2.1), so this plan runs in parallel with Plan 1.2.

## Dependencies

None (Wave 1).

## Tasks

### Task 1: Create `skills/lessons-learned/SKILL.md`
**Files:** `skills/lessons-learned/SKILL.md`
**Action:** create
**Description:**
1. Create directory `skills/lessons-learned/` if it does not exist.
2. Create `SKILL.md` following the conventions observed in other skills (see `skills/security-audit/SKILL.md` and `skills/using-shipyard/SKILL.md` for format).
3. Include YAML frontmatter:
   ```yaml
   ---
   name: lessons-learned
   description: Use when capturing discoveries after phase completion, before shipping, or when reflecting on completed work to extract reusable patterns
   ---
   ```
4. Include TOKEN BUDGET comment: `<!-- TOKEN BUDGET: 150 lines / ~450 tokens -->`
5. Include these sections:
   - **Overview:** Purpose of lessons-learned system (2-3 sentences).
   - **When to Use:** After phase completion during `/shipyard:ship`, when reflecting on completed work.
   - **LESSONS.md Format:** The exact markdown structure for `.shipyard/LESSONS.md`:
     ```markdown
     # Shipyard Lessons Learned

     ## [YYYY-MM-DD] Phase N: {Phase Name}

     ### What Went Well
     - {Bullet point}

     ### Surprises / Discoveries
     - {Pattern discovered}

     ### Pitfalls to Avoid
     - {Anti-pattern encountered}

     ### Process Improvements
     - {Workflow enhancement}

     ---
     ```
   - **Structured Prompts:** The four questions to present to users:
     1. What went well in this phase?
     2. What surprised you or what did you learn?
     3. What should future work avoid?
     4. Any process improvements discovered?
   - **Pre-Population:** How to extract candidate lessons from SUMMARY.md "Issues Encountered" and "Decisions Made" sections.
   - **CLAUDE.md Integration:** How to detect existing `## Lessons Learned` section, append if exists, create if not, skip if no CLAUDE.md.
   - **Quality Standards:** Examples of good vs bad lessons:
     - Good: "Bash `set -e` interacts poorly with pipelines -- use explicit error checks after pipes"
     - Bad: "Tests are important"
     - Good: "jq `.field // "default"` prevents null propagation in optional config values"
     - Bad: "Fixed a bug on line 47"
   - **Anti-Patterns:** Lessons that are too generic, too specific (line numbers), or duplicates of existing lessons.
   - **Integration:** Referenced by `commands/ship.md` Step 3a, pairs with `shipyard:shipyard-verification`.
6. Keep total file under 200 lines (target ~150).

**Acceptance Criteria:**
- File exists at `skills/lessons-learned/SKILL.md`
- Frontmatter has `name: lessons-learned` and `description` starting with "Use when"
- TOKEN BUDGET comment present
- LESSONS.md format section shows the exact structure with date header, four subsections, and separator
- File is under 200 lines (`wc -l` < 200)

### Task 2: Add builder emphasis for lesson seeding in `commands/build.md`
**Files:** `commands/build.md`
**Action:** modify
**Description:**
1. Locate the builder agent instructions section (around lines 67-88) where the SUMMARY.md format is defined, specifically the "Issues Encountered" line (line 84).
2. After the SUMMARY.md template block (after line 88, the closing triple backticks), add a note block:

   ```markdown
   **Lesson Seeding:** Document all discoveries thoroughly in "Issues Encountered" and "Decisions Made":
   - Unexpected behaviors or edge cases found
   - Workarounds applied and why
   - Assumptions proven wrong during implementation
   - Things that were harder or easier than expected

   These entries will be used as pre-populated suggestions when capturing lessons at ship time.
   ```

3. This should be approximately 7 lines of markdown, added after the SUMMARY template and before the "3b. Collect Results" section.

**Acceptance Criteria:**
- The phrase "Lesson Seeding" appears in `commands/build.md`
- The note is positioned after the SUMMARY.md template block
- The note mentions "Issues Encountered" and "Decisions Made"
- The note mentions lessons at ship time

### Task 3: Validate skill format and build.md integration
**Files:** `skills/lessons-learned/SKILL.md`, `commands/build.md`
**Action:** test
**Description:**
1. Verify skill file line count: `wc -l skills/lessons-learned/SKILL.md` must be under 200.
2. Verify frontmatter is valid: first line is `---`, contains `name: lessons-learned`.
3. Verify all required sections are present by grepping for each heading:
   - `## Overview`
   - `## When to Use`
   - `## LESSONS.md Format`
   - `## Structured Prompts`
   - `## CLAUDE.md Integration`
   - `## Quality Standards`
4. Verify `commands/build.md` contains "Lesson Seeding" text.
5. Run existing test suite (`test/run.sh`) to confirm no regressions.

**Acceptance Criteria:**
- Skill file is under 200 lines
- All required section headings present
- build.md has lesson seeding note
- Existing tests pass (`test/run.sh` exits 0)

## Verification

```bash
# 1. Skill file exists and is under 200 lines
wc -l skills/lessons-learned/SKILL.md
# Expected: < 200

# 2. Frontmatter validation
head -3 skills/lessons-learned/SKILL.md | grep -q "name: lessons-learned"
# Expected: exit 0

# 3. Required sections present
for section in "Overview" "When to Use" "LESSONS.md Format" "Structured Prompts" "CLAUDE.md Integration" "Quality Standards"; do
  grep -q "## ${section}" skills/lessons-learned/SKILL.md && echo "OK: ${section}" || echo "MISSING: ${section}"
done

# 4. build.md has lesson seeding
grep -q "Lesson Seeding" commands/build.md
# Expected: exit 0

# 5. Regression tests
bash test/run.sh
# Expected: exit 0
```
