---
phase: token-optimization
plan: "1.2"
wave: 1
dependencies: []
must_haves:
  - shipyard-writing-skills/SKILL.md reduced from 634 to under 500 lines
  - No SKILL.md exceeds 500 lines
  - Extracted examples preserved in a supporting file
files_touched:
  - skills/shipyard-writing-skills/SKILL.md
  - skills/shipyard-writing-skills/EXAMPLES.md (new)
tdd: false
---

# Plan 1.2: Trim shipyard-writing-skills SKILL.md Below 500 Lines

## Context

`skills/shipyard-writing-skills/SKILL.md` is currently 634 lines -- the only SKILL.md file that exceeds the 500-line budget. It needs a 134+ line reduction. The approach is to extract verbose examples and redundant content into a separate `EXAMPLES.md` supporting file (referenced from the main skill but not injected), and compress checklist/table sections. No content is deleted -- it is reorganized for progressive disclosure.

## Dependencies

None (Wave 1). This plan touches only `skills/shipyard-writing-skills/` -- no overlap with Plan 1.1 which touches `scripts/state-read.sh`.

## Tasks

### Task 1: Extract verbose examples to EXAMPLES.md
**Files:** `skills/shipyard-writing-skills/EXAMPLES.md` (new), `skills/shipyard-writing-skills/SKILL.md`
**Action:** create + modify
**Description:**
Move the following sections from SKILL.md to a new `EXAMPLES.md` supporting file:
1. The CSO (Claude Search Optimization) example blocks -- the extensive good/bad YAML examples in the "Rich Description Field" section (approximately lines 160-197). Keep one concise good/bad pair inline; move the rest.
2. The "Token Efficiency" techniques section (approximately lines 213-265) -- the detailed bash and markdown comparison examples. Replace inline with a brief 3-line summary and a reference: "See EXAMPLES.md for detailed token efficiency patterns."
3. The "Bulletproofing Skills Against Rationalization" section (approximately lines 447-508) -- the detailed good/bad code blocks and the "Spirit vs Letter" examples. Keep the section header and a 3-line summary inline; move the verbose examples.
4. The "Anti-Patterns" section verbose code examples (approximately lines 541-561). Keep the anti-pattern names and one-line descriptions inline; move code blocks.

`EXAMPLES.md` should have a clear header and organized sections matching the original structure so readers can find what they need.

**Acceptance Criteria:**
- `EXAMPLES.md` exists with all extracted content organized by section
- `SKILL.md` references `EXAMPLES.md` where content was extracted
- No content is lost -- all examples exist in exactly one place

### Task 2: Compress checklist and table sections
**Files:** `skills/shipyard-writing-skills/SKILL.md`
**Action:** modify
**Description:**
Apply compression to remaining content:
1. The "Skill Creation Checklist" (lines 575-613) -- merge the RED/GREEN/REFACTOR sub-checklists into a single compact checklist. The detailed explanations for each item are already covered in the main body above.
2. The "Common Rationalizations for Skipping Testing" table (lines 431-443) -- reduce from 8 rows to the 4 most impactful entries. The rest are variations of the same theme.
3. The "Testing All Skill Types" section (lines 382-429) -- compress each sub-section from ~10 lines to ~5 lines by removing the example skill names (which are obvious) and merging "Test with" and "Success criteria" into a compact format.
4. Remove redundant "The Bottom Line" section (lines 626-634) which repeats the overview verbatim.

**Acceptance Criteria:**
- Checklist section is under 25 lines (was ~38)
- Rationalizations table has 4 rows (was 8)
- Each testing sub-section is 5 lines or fewer
- "The Bottom Line" section removed (its content is already in "Overview")

### Task 3: Validate line count and content integrity
**Files:** `skills/shipyard-writing-skills/SKILL.md`
**Action:** test
**Description:**
1. Count lines: `wc -l skills/shipyard-writing-skills/SKILL.md` -- must be under 500.
2. Verify all key sections still exist by grepping for section headers: Overview, TDD Mapping, When to Create, Skill Types, SKILL.md Structure, CSO, Flowchart Usage, Code Examples, File Organization, Iron Law, Testing All Skill Types, RED-GREEN-REFACTOR, Skill Creation Checklist, Discovery Workflow.
3. Verify `EXAMPLES.md` is referenced at least 2 times in `SKILL.md`.
4. Verify no SKILL.md file in the entire project exceeds 500 lines: `for f in skills/*/SKILL.md; do [ $(wc -l < "$f") -le 500 ] || echo "FAIL: $f"; done`

**Acceptance Criteria:**
- `wc -l skills/shipyard-writing-skills/SKILL.md` outputs a number under 500
- All 14 key section headers are present
- `EXAMPLES.md` is referenced at least twice
- No SKILL.md file across the project exceeds 500 lines

## Verification

```bash
# 1. Line count
wc -l skills/shipyard-writing-skills/SKILL.md
# Expected: < 500

# 2. Section headers present
for section in "Overview" "TDD Mapping" "When to Create" "Skill Types" "SKILL.md Structure" "Claude Search Optimization" "Flowchart Usage" "Code Examples" "File Organization" "Iron Law" "Testing All Skill Types" "RED-GREEN-REFACTOR" "Skill Creation Checklist" "Discovery Workflow"; do
  grep -q "$section" skills/shipyard-writing-skills/SKILL.md || echo "MISSING: $section"
done
# Expected: no output

# 3. EXAMPLES.md reference count
grep -c "EXAMPLES.md" skills/shipyard-writing-skills/SKILL.md
# Expected: >= 2

# 4. Global budget check
for f in skills/*/SKILL.md; do
  lines=$(wc -l < "$f" | tr -d ' ')
  [ "$lines" -le 500 ] || echo "FAIL: $f has $lines lines"
done
# Expected: no output
```
