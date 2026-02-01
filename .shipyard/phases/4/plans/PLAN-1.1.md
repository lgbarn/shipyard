---
phase: token-optimization
plan: "1.1"
wave: 1
dependencies: []
must_haves:
  - state-read.sh output under 2500 tokens with planning tier
  - Session start no longer injects full skill content
  - Only a compact summary of available skills is injected
files_touched:
  - scripts/state-read.sh
tdd: false
---

# Plan 1.1: Replace Full Skill Injection with Compact Summary

## Context

`state-read.sh` currently reads the entire `using-shipyard/SKILL.md` (175 lines, ~4500 tokens) and injects it verbatim into every session start. This is the single largest contributor to the ~6000-token injection. Replacing it with a ~20-line summary listing available skills and commands achieves the majority of the token reduction target. The full skill content remains available on-demand via the Skill tool -- no functionality is lost.

## Dependencies

None (Wave 1).

## Tasks

### Task 1: Replace skill file read with inline summary
**Files:** `scripts/state-read.sh`
**Action:** modify
**Description:**
1. Remove lines 24-25 that read the full `using-shipyard/SKILL.md` into `using_shipyard_content`.
2. Replace with a compact inline summary variable (`skill_summary`) containing:
   - A header "## Shipyard Skills & Commands"
   - A bullet list of all 14 skills by their qualified name (e.g., `shipyard:using-shipyard`) with a 5-word purpose
   - A one-line instruction: "Use the Skill tool to load any skill for full details."
   - The existing command list (currently on line 205) can be kept where it is or merged into the summary
3. The summary should be no more than 25 lines of text content.

**Acceptance Criteria:**
- Line `using_shipyard_content=$(cat ...` no longer exists in `state-read.sh`
- A `skill_summary` variable exists with all 14 skill names listed
- The summary is under 30 lines of shell string content

### Task 2: Update context assembly to use summary instead of full content
**Files:** `scripts/state-read.sh`
**Action:** modify
**Description:**
1. Modify line 211 (the `full_context` assembly) to inject `skill_summary` instead of `using_shipyard_content`.
2. Remove the phrasing "Below is the full content of the 'shipyard:using-shipyard' skill" and replace with something like "Below are available Shipyard skills and commands. Use the Skill tool to load any skill."
3. Keep the `<EXTREMELY_IMPORTANT>` wrapper and the "You have Shipyard available" preamble.
4. Keep the `${state_context}` injection unchanged.

**Acceptance Criteria:**
- `full_context` no longer references `using_shipyard_content`
- `full_context` includes `skill_summary`
- The preamble text no longer mentions "full content" of any skill

### Task 3: Measure and validate token reduction
**Files:** `scripts/state-read.sh`
**Action:** test
**Description:**
1. Run `state-read.sh` in a test project with a `.shipyard/` directory in planning tier state.
2. Extract the `additionalContext` field from JSON output: `bash scripts/state-read.sh | jq -r '.hookSpecificOutput.additionalContext'`
3. Measure word count with `wc -w`. Target: under 800 words (approximately 2000-2500 tokens at 0.75 tokens/word + markdown overhead).
4. Run existing bats test suite (`test/run.sh`) to confirm no regressions.
5. Verify the output includes all 14 skill names by grepping for each one.

**Acceptance Criteria:**
- Word count of `additionalContext` is under 800 words (without project state) or under 1000 words (with planning-tier project state)
- All existing tests pass (`test/run.sh` exits 0)
- All 14 skill names appear in the output

## Verification

```bash
# 1. Token measurement (no .shipyard state)
cd /tmp && mkdir -p test-token-check && cd test-token-check
bash /path/to/scripts/state-read.sh | jq -r '.hookSpecificOutput.additionalContext' | wc -w
# Expected: < 800 words

# 2. Token measurement (with planning state)
mkdir -p .shipyard && echo -e "**Status:** planned\n**Current Phase:** 1" > .shipyard/STATE.md
bash /path/to/scripts/state-read.sh | jq -r '.hookSpecificOutput.additionalContext' | wc -w
# Expected: < 1000 words

# 3. Skill name coverage
bash /path/to/scripts/state-read.sh | jq -r '.hookSpecificOutput.additionalContext' | grep -c "shipyard:"
# Expected: >= 14

# 4. Regression tests
bash test/run.sh
# Expected: exit 0
```
