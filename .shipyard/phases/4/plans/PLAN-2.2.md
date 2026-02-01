---
phase: token-optimization
plan: "2.2"
wave: 2
dependencies: ["1.1", "1.2"]
must_haves:
  - All 14 SKILL.md files have token budget comments
  - Budget values reflect actual content with 20% headroom
files_touched:
  - skills/code-simplification/SKILL.md
  - skills/documentation/SKILL.md
  - skills/git-workflow/SKILL.md
  - skills/infrastructure-validation/SKILL.md
  - skills/parallel-dispatch/SKILL.md
  - skills/security-audit/SKILL.md
  - skills/shipyard-brainstorming/SKILL.md
  - skills/shipyard-debugging/SKILL.md
  - skills/shipyard-executing-plans/SKILL.md
  - skills/shipyard-tdd/SKILL.md
  - skills/shipyard-verification/SKILL.md
  - skills/shipyard-writing-plans/SKILL.md
  - skills/shipyard-writing-skills/SKILL.md
  - skills/using-shipyard/SKILL.md
tdd: false
---

# Plan 2.2: Add Token Budget Comments to All SKILL.md Files

## Context

Token budgets prevent future bloat by making the per-file size limit visible to anyone editing the file. This plan adds a machine-readable HTML comment to each of the 14 SKILL.md files, immediately after the YAML frontmatter. The budget is calculated as the current line count plus 20% headroom, capped at 500 lines maximum. This is a mechanical change that does not alter any skill's content or behavior.

This plan depends on Wave 1 completion because Plan 1.2 changes the line count of `shipyard-writing-skills/SKILL.md`, and the budget comment must reflect the post-trim line count.

## Dependencies

Plans 1.1 and 1.2 (Wave 1). Specifically, Plan 1.2 must complete before budgets are calculated for `shipyard-writing-skills/SKILL.md`.

## Tasks

### Task 1: Calculate budgets and add comments to all 14 SKILL.md files
**Files:** All 14 `skills/*/SKILL.md` files
**Action:** modify
**Description:**
For each SKILL.md file:
1. Count the current line count.
2. Calculate budget as: `min(current_lines * 1.2, 500)` rounded to nearest 10.
3. Estimate token count as: `budget_lines * 3` (approximately 3 tokens per line for markdown).
4. Insert the budget comment immediately after the closing `---` of the YAML frontmatter.

**Format:**
```markdown
---
name: skill-name
description: ...
---

<!-- TOKEN BUDGET: {budget} lines / ~{tokens} tokens -->

# Skill Title
```

**Budget calculations (based on current line counts from research, using post-trim count for shipyard-writing-skills):**

| Skill | Current Lines | Budget (lines) | Budget (tokens) |
|-------|--------------|----------------|-----------------|
| shipyard-writing-skills | ~490 (post-trim) | 500 | ~1500 |
| shipyard-tdd | 376 | 450 | ~1350 |
| git-workflow | 372 | 450 | ~1350 |
| code-simplification | 309 | 370 | ~1110 |
| shipyard-debugging | 301 | 360 | ~1080 |
| shipyard-executing-plans | 202 | 240 | ~720 |
| parallel-dispatch | 181 | 220 | ~660 |
| using-shipyard | 175 | 210 | ~630 |
| shipyard-writing-plans | 144 | 170 | ~510 |
| shipyard-verification | 144 | 170 | ~510 |
| documentation | 136 | 160 | ~480 |
| infrastructure-validation | 104 | 130 | ~390 |
| security-audit | 72 | 90 | ~270 |
| shipyard-brainstorming | 56 | 70 | ~210 |

Note: Exact post-trim line counts for `shipyard-writing-skills` should be measured after Plan 1.2 completes. The builder should re-count and adjust.

**Acceptance Criteria:**
- All 14 SKILL.md files contain a `<!-- TOKEN BUDGET:` comment
- Each comment is placed immediately after the YAML frontmatter closing `---`
- No budget exceeds 500 lines
- Budget values reflect actual content with ~20% headroom

### Task 2: Validate budget comments and compliance
**Files:** All 14 `skills/*/SKILL.md` files
**Action:** test
**Description:**
1. Verify all 14 files have budget comments: `grep -L "TOKEN BUDGET:" skills/*/SKILL.md` should return no results.
2. Verify no file exceeds its stated budget: For each file, extract the budget line count from the comment and compare to actual `wc -l`.
3. Verify no budget exceeds 500 lines by extracting the number from each comment.
4. Verify the comment placement is correct (immediately after `---` frontmatter closing).

**Acceptance Criteria:**
- `grep -L "TOKEN BUDGET:" skills/*/SKILL.md` produces no output (all files have the comment)
- No file's actual line count exceeds its stated budget
- No stated budget exceeds 500 lines
- All budget comments appear within the first 10 lines of their file

## Verification

```bash
# 1. All files have budget comments
missing=$(grep -L "TOKEN BUDGET:" skills/*/SKILL.md)
[ -z "$missing" ] && echo "PASS: all files have budgets" || echo "FAIL: missing in $missing"

# 2. No file exceeds its budget
for f in skills/*/SKILL.md; do
  actual=$(wc -l < "$f" | tr -d ' ')
  budget=$(grep -m1 "TOKEN BUDGET:" "$f" | sed -n 's/.*: \([0-9]*\) lines.*/\1/p')
  if [ -n "$budget" ] && [ "$actual" -gt "$budget" ]; then
    echo "FAIL: $f has $actual lines but budget is $budget"
  fi
done
# Expected: no output

# 3. No budget exceeds 500
for f in skills/*/SKILL.md; do
  budget=$(grep -m1 "TOKEN BUDGET:" "$f" | sed -n 's/.*: \([0-9]*\) lines.*/\1/p')
  if [ -n "$budget" ] && [ "$budget" -gt 500 ]; then
    echo "FAIL: $f budget is $budget (exceeds 500)"
  fi
done
# Expected: no output

# 4. Budget comment in first 10 lines
for f in skills/*/SKILL.md; do
  head -10 "$f" | grep -q "TOKEN BUDGET:" || echo "FAIL: $f budget not in first 10 lines"
done
# Expected: no output
```
