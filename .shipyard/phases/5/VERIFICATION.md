# Verification Report: Phase 5 Plans
**Phase:** Lessons-Learned System
**Date:** 2026-02-01
**Type:** plan-review
**Scope:** Pre-execution verification of PLAN-1.1, PLAN-1.2, PLAN-2.1

---

## 1. Roadmap Requirements Coverage

### Phase 5 Success Criteria (5 total)

| # | Criterion | Addressed By | Status |
|---|-----------|--------------|--------|
| 1 | After `/shipyard:ship`, user is prompted with captured lessons for review | PLAN-1.2 (Task 1) | COVERED |
| 2 | Approved lessons appended to `.shipyard/LESSONS.md` with timestamp and phase | PLAN-1.2 (Task 1) | COVERED |
| 3 | If CLAUDE.md exists, a "Lessons Learned" section is appended/updated | PLAN-1.2 (Task 1) | COVERED |
| 4 | Lessons visible in `state-read.sh` output (execution tier only, max 5 recent) | PLAN-2.1 (Task 2, Task 3) | COVERED |
| 5 | Skill file under 200 lines | PLAN-1.1 (Task 1, Task 3) | COVERED |

**VERDICT: All 5 success criteria are covered by the three plans.**

---

## 2. Plan Quality Metrics

### 2.1 Task Count (requirement: ≤3 per plan)

| Plan | Tasks | Status |
|------|-------|--------|
| PLAN-1.1 | 3 | PASS |
| PLAN-1.2 | 3 | PASS |
| PLAN-2.1 | 3 | PASS |

**VERDICT: PASS — All plans respect the 3-task limit.**

### 2.2 Plan Scope and Clarity

**PLAN-1.1: Create Lessons-Learned Skill + Builder Emphasis**
- **Scope:** Well-defined. Creates new `skills/lessons-learned/SKILL.md` with specific sections and line limit (under 200). Modifies `commands/build.md` with minimal emphasis note.
- **Task 1 (Create Skill):** Action is "create". Includes specific requirements: YAML frontmatter, TOKEN BUDGET comment, six named sections, line count validation. Clear and testable.
- **Task 2 (Add Builder Emphasis):** Action is "modify". Specifies exact location (after line 88), content to add (7-line note block), and what to reference. Clear.
- **Task 3 (Validate):** Action is "test". Lists specific validation commands (wc, grep, section presence checks). Clear and executable.

**PLAN-1.2: Add Lessons-Learned Capture to Ship Command**
- **Scope:** Well-defined. Inserts new Step 3a into `commands/ship.md` with specific positioning (between Step 3 and Step 4). Modifies final message in Step 9.
- **Task 1 (Insert Step 3a):** Action is "modify". Shows exact markdown block to insert (~45-55 lines), with clear sub-sections (Extract Candidate Lessons, Present to User, Persist Lessons). Specifies "3a" numbering to avoid renumbering existing steps. Clear.
- **Task 2 (Update Step 9):** Action is "modify". Specifies exact location (lines 220-229) and 2-3 line addition to final message. Clear.
- **Task 3 (Validate):** Action is "test". Lists step ordering validation, skill reference check, LESSONS.md/CLAUDE.md references, skip handling, and regression tests. Clear and executable.

**PLAN-2.1: Display Recent Lessons in Session Context**
- **Scope:** Well-defined. Modifies `scripts/state-read.sh` to load recent lessons in execution tier and adds tests. Uses TDD approach (tests first, then implementation).
- **Task 1 (Write Tests):** Action is "modify". Specifies test file, setup with sample LESSONS.md structure, three test cases (lessons present, absent when no file, absent in planning tier). Uses TDD red phase. Clear.
- **Task 2 (Implement Lessons Loading):** Action is "modify". Specifies exact location in execution tier block (after line 162-163). Shows complete bash code (~20 lines) with POSIX-compatible commands. Clear.
- **Task 3 (Run Tests & Measure):** Action is "test". Lists specific verification commands: new tests, full suite, shellcheck, token impact measurement. Clear and measurable.

**VERDICT: PASS — All plans have clear, well-scoped, testable tasks.**

### 2.3 Testability of Acceptance Criteria

| Plan | Task | Criteria | Testable? |
|------|------|----------|-----------|
| 1.1 | 1 | File exists at correct path; frontmatter correct; TOKEN BUDGET present; LESSONS.md format shown; under 200 lines | YES (file check, grep, wc) |
| 1.1 | 2 | "Lesson Seeding" phrase present; positioned after template; mentions sections; mentions ship time | YES (grep for phrase and content) |
| 1.1 | 3 | Skill under 200 lines; required sections present; build.md has note; tests pass | YES (wc, grep, test/run.sh) |
| 1.2 | 1 | "Step 3a: Capture Lessons" heading; between Step 3 and 4; skill reference; prompt; skip handling; LESSONS.md/CLAUDE.md logic | YES (grep for heading, section names, keywords) |
| 1.2 | 2 | Step 9 mentions LESSONS.md conditionally; inside quote block | YES (grep for content) |
| 1.2 | 3 | Step ordering correct; skill reference present; file references present; skip handling; tests pass | YES (grep for steps, keywords; test/run.sh) |
| 2.1 | 1 | 3+ new test cases; tests fail initially (red phase); cover three scenarios | YES (bats test file diff; run tests) |
| 2.1 | 2 | Lessons block inside execution/full tier conditional; checks file existence; limits to 5 sections; POSIX-compatible; shellcheck passes | YES (grep for code block, pattern; shellcheck) |
| 2.1 | 3 | New tests pass; full suite passes; shellcheck passes; token overhead <250; lessons in execution tier output | YES (npx bats, test/run.sh, shellcheck, wc -w comparison) |

**VERDICT: PASS — All acceptance criteria are concrete and testable with specific commands.**

---

## 3. Wave Ordering and Dependencies

### 3.1 Dependency Graph

```
Wave 1: PLAN-1.1 (no dependencies)
        PLAN-1.2 (no dependencies, but references skill from 1.1)

Wave 2: PLAN-2.1 (depends on 1.1 and 1.2)
```

### 3.2 Dependency Analysis

**PLAN-1.1:**
- **Dependencies field:** `[]` (empty)
- **Wave:** 1
- **Rationale:** No blockers. Can start immediately. Creates foundational skill file.
- **Status:** PASS

**PLAN-1.2:**
- **Dependencies field:** `[]` (empty)
- **Wave:** 1
- **Implicit dependency:** References `shipyard:lessons-learned` skill from PLAN-1.1
- **Risk:** Both are markdown files. Skill just needs to exist at execution time. Can be built in same wave or 1.2 can be wave 1.5 if skill needs to be validated first.
- **Current design:** Both in Wave 1. Safe because: (1) both are non-executable markdown, (2) Plan 1.2 references skill by name, (3) skill file creation is trivial (no tests). This is acceptable.
- **Status:** PASS (with note: consider sequential execution if testing/validation happens between waves)

**PLAN-2.1:**
- **Dependencies field:** `["1.1", "1.2"]`
- **Wave:** 2
- **Rationale:** Needs both Plan 1.1 (LESSONS.md format spec) and Plan 1.2 (actual LESSONS.md files created). Correct.
- **Status:** PASS

### 3.3 Circular Dependency Check

- PLAN-1.1 ← → PLAN-1.2: No circular dependency (1.1 creates skill, 1.2 uses it)
- PLAN-1.2 ← → PLAN-2.1: No circular dependency (1.2 creates LESSONS.md, 2.1 reads it)
- PLAN-1.1 ← → PLAN-2.1: No circular dependency (1.1 defines format, 2.1 uses it)

**VERDICT: PASS — No circular dependencies. Wave ordering is correct.**

---

## 4. File Conflicts Between Parallel Plans

### 4.1 Files Touched by Each Plan

**PLAN-1.1:**
- `skills/lessons-learned/SKILL.md` (new)
- `commands/build.md` (modify — add note after line 88)

**PLAN-1.2:**
- `commands/ship.md` (modify — insert Step 3a, modify Step 9)

**PLAN-2.1:**
- `scripts/state-read.sh` (modify — add lessons loading in execution tier)
- `test/unit/state-read.bats` (modify — add 3 new test cases)

### 4.2 Conflict Analysis

| Files | Plans | Conflict? | Notes |
|-------|-------|-----------|-------|
| `skills/lessons-learned/SKILL.md` | 1.1 only | NO | New file, only touched by 1.1 |
| `commands/build.md` | 1.1 only | NO | Only touched by 1.1 (line 88 region) |
| `commands/ship.md` | 1.2 only | NO | Only touched by 1.2 (insert Step 3a + modify Step 9) |
| `scripts/state-read.sh` | 2.1 only | NO | Only touched by 2.1 (execution tier block) |
| `test/unit/state-read.bats` | 2.1 only | NO | Only touched by 2.1 (add 3 test cases) |

**VERDICT: PASS — Zero file conflicts. All plans can run in parallel with no synchronization needed.**

---

## 5. Path Validation

### 5.1 Test File Path Issue

**Issue:** User note states "PLAN-2.1 references test/unit/state-read.bats but the actual test file is at test/state-read.bats (flat layout, no unit/ subdirectory)."

**Verification:**
```bash
$ find /Users/lgbarn/Personal/shipyard/test -name "state-read.bats" -type f
/Users/lgbarn/Personal/shipyard/test/state-read.bats

$ ls -la /Users/lgbarn/Personal/shipyard/test/
... (expected: state-read.bats exists, but no unit/ subdirectory)
```

**Finding:** PLAN-2.1 references `test/unit/state-read.bats` in:
- Line 13: `must_haves` section
- Line 38: Task 1 "Files" section
- Lines 41, 126, 129, 149: Multiple references in task descriptions and verification section

**Actual file location:** `/Users/lgbarn/Personal/shipyard/test/state-read.bats` (flat structure, no `unit/` subdirectory)

**Impact:**
- Critical for execution: PLAN-2.1 will fail to find the test file if it attempts to modify `test/unit/state-read.bats` (which does not exist)
- The plan should reference `/Users/lgbarn/Personal/shipyard/test/state-read.bats` instead
- All verification commands in the plan that reference `test/unit/state-read.bats` will fail

**VERDICT: FAIL — Path mismatch: PLAN-2.1 uses wrong path (`test/unit/state-read.bats` instead of `test/state-read.bats`)**

---

## 6. Coverage Analysis

### 6.1 Requirements from ROADMAP

| Requirement | Plan | Task | Evidence |
|-------------|------|------|----------|
| Prompt user for lessons after ship | 1.2 | Task 1 | Step 3a includes AskUserQuestion with four structured questions |
| Append to LESSONS.md with timestamp | 1.2 | Task 1 | Persist Lessons section shows format with `[YYYY-MM-DD] Phase N` header |
| Optional CLAUDE.md update | 1.2 | Task 1 | CLAUDE.md integration in Persist Lessons section handles detection, append, skip |
| Display recent lessons in state-read.sh | 2.1 | Task 2, Task 3 | Execution tier block added with lesson loading; tests verify appearance |
| Max 5 recent lessons | 2.1 | Task 2 | Bash code limits to `tail -5` for last 5 headers |
| Execution tier only | 2.1 | Task 2 | Block inside `if [ "$context_tier" = "execution" ] ...` conditional |
| Skill under 200 lines | 1.1 | Task 1, Task 3 | Task 3 includes `wc -l` verification; target ~150 lines |

**VERDICT: PASS — All roadmap requirements are covered by specific plan tasks.**

### 6.2 PROJECT.md Goals Alignment

| Goal | Plan | Task | Coverage |
|------|------|------|----------|
| Add lessons-learned system | 1.1, 1.2, 2.1 | All | FULL |
| Capture discoveries during building/shipping | 1.1, 1.2 | 1.1 Task 2, 1.2 Task 1 | FULL |
| Update CLAUDE.md | 1.2 | Task 1 | FULL |
| Persist lessons for future sessions | 1.2, 2.1 | 1.2 Task 1, 2.1 Task 2 | FULL |
| Token efficiency (under 250 tokens) | 2.1 | Task 3 | FULL |

**VERDICT: PASS — All PROJECT.md goals addressed.**

---

## 7. Specification Completeness

### 7.1 PLAN-1.1 Completeness

**Task 1: Create Skill File**
- ✓ Directory structure specified
- ✓ Frontmatter format specified with exact YAML
- ✓ TOKEN BUDGET comment specified
- ✓ Six required sections named with descriptions
- ✓ Line limit specified (under 200)
- ✓ References existing skills for format comparison

**Task 2: Add Builder Emphasis**
- ✓ Exact location specified (after line 88)
- ✓ Content to add provided verbatim (7 lines)
- ✓ Section context specified (after SUMMARY template, before "3b")

**Task 3: Validation**
- ✓ Specific commands provided (wc, head, grep)
- ✓ Expected outputs specified
- ✓ Test suite integration specified

**VERDICT: PASS — Fully specified.**

### 7.2 PLAN-1.2 Completeness

**Task 1: Insert Step 3a**
- ✓ Exact location specified (between Step 3 and Step 4)
- ✓ Step numbering convention explained (use "3a" to avoid renumbering)
- ✓ Markdown content provided verbatim (~50 lines)
- ✓ Sub-sections clearly defined
- ✓ AskUserQuestion format specified
- ✓ Skip handling specified
- ✓ LESSONS.md format shown
- ✓ CLAUDE.md integration logic specified

**Task 2: Update Step 9**
- ✓ Exact location specified (lines 220-229)
- ✓ Content to add specified
- ✓ Conditional logic explained

**Task 3: Validation**
- ✓ Step ordering check commands specified
- ✓ Expected step order listed
- ✓ Reference presence checks specified
- ✓ Test suite integration specified

**VERDICT: PASS — Fully specified.**

### 7.3 PLAN-2.1 Completeness

**Task 1: Write Tests (TDD Red Phase)**
- ✓ Test file specified (`test/unit/state-read.bats`) [note: wrong path]
- ✓ Test setup detailed (STATE.md, LESSONS.md structure, phase directory)
- ✓ Sample LESSONS.md provided with realistic structure
- ✓ Three test cases specified (lessons present, absent, planning tier)
- ✓ TDD phase identified (red → implement → green)

**Task 2: Implement Lessons Loading**
- ✓ Exact location specified (after line 162-163, inside execution tier conditional)
- ✓ Bash code provided (~20 lines)
- ✓ POSIX-compatible requirement stated
- ✓ Max 5 lessons limit built into code

**Task 3: Run Tests & Measure**
- ✓ Test execution commands specified
- ✓ Shellcheck command specified
- ✓ Token measurement methodology specified with exact commands
- ✓ Token budget (under 250) specified
- ✓ Expected delta calculation shown

**VERDICT: PASS for specification; FAIL for path (noted in section 5.1).**

---

## 8. Missing or Ambiguous Specifications

### 8.1 PLAN-1.1

**Question:** Should the skill be git-committed after creation?
- **Status:** Not specified. Assumption: yes (standard practice).
- **Severity:** Low (standard procedure).

**Question:** What if `commands/build.md` doesn't have "Issues Encountered" line at line 84?
- **Status:** Not specified. Assumption: line numbers are approximate, use context to locate.
- **Severity:** Low (contingency planning during execution).

### 8.2 PLAN-1.2

**Question:** What if Step 4 doesn't start at line 145?
- **Status:** Not specified (line numbers are approximate). Assumption: locate by step number, not line number.
- **Severity:** Low (standard practice).

**Question:** Should Step 3a be skipped if LESSONS.md already exists?
- **Status:** Not specified. Assumption: no, always offer lesson capture (append to existing file).
- **Severity:** Low (clear from task description).

### 8.3 PLAN-2.1

**Question:** Should tests check for maximum 5 lessons in output, or just that they appear?
- **Status:** Not specified in Task 1. Assumption: Task 3 measures this (delta under 250 tokens).
- **Severity:** Low (covered in Task 3).

**Question:** If LESSONS.md has fewer than 5 sections, should all be displayed?
- **Status:** Not specified. Assumption: yes, show all available (code uses `tail -5`).
- **Severity:** Low.

**VERDICT: PASS — Ambiguities are minor and covered by standard practices or task specifications.**

---

## 9. Verification Commands Validity

### 9.1 PLAN-1.1 Verification Commands

```bash
# 1. Skill file exists and is under 200 lines
wc -l skills/lessons-learned/SKILL.md
# Expected: < 200
# VERDICT: VALID — Standard command, measurable output

# 2. Frontmatter validation
head -3 skills/lessons-learned/SKILL.md | grep -q "name: lessons-learned"
# Expected: exit 0
# VERDICT: VALID — Standard grep check

# 3. Required sections present
for section in "Overview" "When to Use" "LESSONS.md Format" "Structured Prompts" "CLAUDE.md Integration" "Quality Standards"; do
  grep -q "## ${section}" skills/lessons-learned/SKILL.md && echo "OK: ${section}" || echo "MISSING: ${section}"
done
# VERDICT: VALID — Loop with grep checks

# 4. build.md has lesson seeding
grep -q "Lesson Seeding" commands/build.md
# Expected: exit 0
# VERDICT: VALID — Standard grep check

# 5. Regression tests
bash test/run.sh
# Expected: exit 0
# VERDICT: VALID — Existing test runner
```

**VERDICT: PASS — All commands are valid and produce measurable output.**

### 9.2 PLAN-1.2 Verification Commands

```bash
# 1. Step 3a exists
grep -q "## Step 3a" commands/ship.md && echo "OK: Step 3a found" || echo "FAIL: Step 3a missing"
# VERDICT: VALID — Standard grep check

# 2. Step ordering
grep "^## Step" commands/ship.md
# Expected: Steps in order 0, 1, 2, 2a, 2b, 3, 3a, 4, 5, 6, 7, 8, 9
# VERDICT: VALID — Produces step list for manual inspection

# 3-5. Reference checks
grep -c "lessons-learned" commands/ship.md  # >= 1
grep -c "LESSONS.md" commands/ship.md       # >= 2
grep -c "CLAUDE.md" commands/ship.md        # >= 1
# VERDICT: VALID — Standard grep counts

# 4. Skip handling
grep -q '"skip"' commands/ship.md || grep -q "'skip'" commands/ship.md
# Expected: exit 0
# VERDICT: VALID — Checks for skip keyword in either quote style

# 5. Regression tests
bash test/run.sh
# Expected: exit 0
# VERDICT: VALID — Existing test runner
```

**VERDICT: PASS — All commands are valid.**

### 9.3 PLAN-2.1 Verification Commands

```bash
# 1. New tests pass
npx bats test/unit/state-read.bats
# Expected: all pass including new lesson tests
# ISSUE: Path is wrong (test/unit/state-read.bats should be test/state-read.bats)
# VERDICT: INVALID (wrong path) — but command format is valid

# 2. Full test suite
bash test/run.sh
# Expected: exit 0
# VERDICT: VALID — Existing test runner

# 3. Shellcheck
shellcheck --severity=warning scripts/state-read.sh
# Expected: exit 0
# VERDICT: VALID — Standard shellcheck command

# 4. Token impact measurement
cd /tmp && rm -rf lesson-token-test && mkdir lesson-token-test && cd lesson-token-test
mkdir -p .shipyard/phases/1
cat > .shipyard/STATE.md << 'EOF'
**Status:** building
**Current Phase:** 1
EOF
BASELINE=$(bash /Users/lgbarn/Personal/shipyard/scripts/state-read.sh | jq -r '.hookSpecificOutput.additionalContext' | wc -w)
# ... (with LESSONS.md) ...
WITH_LESSONS=$(bash /Users/lgbarn/Personal/shipyard/scripts/state-read.sh | jq -r '.hookSpecificOutput.additionalContext' | wc -w)
DELTA=$((WITH_LESSONS - BASELINE))
echo "Delta: ${DELTA} words"
# Expected: Delta < 80 words
# VERDICT: VALID — Measurement methodology is sound

# 5. Lessons appear in execution tier
bash /Users/lgbarn/Personal/shipyard/scripts/state-read.sh | jq -r '.hookSpecificOutput.additionalContext' | grep -q "Recent Lessons"
# Expected: exit 0
# VERDICT: VALID — Standard grep check
```

**VERDICT: PARTIAL PASS — Commands are valid except for path issue in Task 1 and Task 3 verification.**

---

## 10. Integration Points with Existing Codebase

### 10.1 PLAN-1.1 Integration

**Integration with `commands/build.md`:**
- Plan adds emphasis note after SUMMARY.md template
- No structural changes to existing builder workflow
- Non-breaking change (additive only)
- **Status:** PASS

### 10.2 PLAN-1.2 Integration

**Integration with `commands/ship.md`:**
- Inserts Step 3a between existing Step 3 and Step 4
- Uses "3a" numbering to avoid renumbering
- References `shipyard:lessons-learned` skill (created by PLAN-1.1)
- Interacts with AskUserQuestion command (standard pattern)
- Reads from SUMMARY.md files (already used by ship)
- Writes to `.shipyard/LESSONS.md` (new file, no conflict)
- Optionally modifies CLAUDE.md (non-intrusive append)
- Creates git commit (standard pattern)
- **Status:** PASS

### 10.3 PLAN-2.1 Integration

**Integration with `scripts/state-read.sh`:**
- Adds lessons loading to execution tier block
- Uses existing pattern of checking file existence first
- Follows same structure as existing plan/summary loading
- Appends to `state_context` variable (standard pattern)
- Only shown in execution/full tier (respects context tier logic)
- Uses POSIX-compatible commands (matches script's constraints)
- **Status:** PASS

**Integration with `test/state-read.bats`:**
- Adds new test cases to existing test file
- Uses existing test setup/teardown patterns
- No modification to existing test cases
- **Status:** PARTIAL PASS (path issue noted)

---

## 11. Risk Assessment

### 11.1 Plan Execution Risks

**PLAN-1.1:**
- **Risk:** Skill file not created under 200 lines. **Mitigation:** Task 3 includes wc validation.
- **Risk:** Missing required sections. **Mitigation:** Task 3 checks all six sections.
- **Risk:** Build.md modification breaks existing workflow. **Mitigation:** Change is additive, after template.
- **Risk Level:** LOW

**PLAN-1.2:**
- **Risk:** Step 3a insertion at wrong location breaks step ordering. **Mitigation:** Task 3 validates ordering.
- **Risk:** CLAUDE.md modification causes merge conflicts. **Mitigation:** Appends at end, user-reviewed, documented in skill.
- **Risk:** Skip handling broken. **Mitigation:** Task 3 checks for "skip" keyword.
- **Risk Level:** LOW

**PLAN-2.1:**
- **Risk:** Tests modify wrong file (test/unit/state-read.bats instead of test/state-read.bats). **Mitigation:** This is a path error in the plan that will cause execution failure.
- **Risk:** Token overhead exceeds budget. **Mitigation:** Task 3 measures and validates <250 tokens.
- **Risk:** POSIX compatibility broken. **Mitigation:** Task 3 runs shellcheck.
- **Risk Level:** MEDIUM (due to path error)

### 11.2 Overall Risks

**Critical:** Path error in PLAN-2.1 (test file path mismatch) must be corrected before execution.

**Minor:** Line number references in PLAN-1.1 and PLAN-1.2 are approximations; executor should verify by context.

---

## Summary of Findings

### Strengths

1. ✓ All 5 success criteria are covered by the three plans
2. ✓ Plans respect the 3-task limit
3. ✓ No file conflicts between parallel plans
4. ✓ No circular dependencies
5. ✓ Wave ordering is correct (Wave 1: plans 1.1 & 1.2; Wave 2: plan 2.1)
6. ✓ Acceptance criteria are concrete and testable
7. ✓ All verification commands are valid
8. ✓ Integration with existing codebase is sound
9. ✓ Tasks are well-scoped and specific

### Gaps and Issues

1. **CRITICAL:** PLAN-2.1 references wrong test file path:
   - Plan says: `test/unit/state-read.bats`
   - Actual file: `test/state-read.bats` (flat layout, no `unit/` subdirectory)
   - Impact: All PLAN-2.1 tasks will fail to locate/modify the test file
   - Affected lines: 13, 38, 41, 126, 129, 149
   - Correction needed: Replace all instances of `test/unit/state-read.bats` with `test/state-read.bats`

2. **Minor:** PLAN-1.1 and PLAN-1.2 use approximate line numbers (88, 143, 145, 220-229):
   - Plan says to use line numbers as guides
   - Executor should verify by context (section headers, not absolute line numbers)
   - This is standard practice; severity is LOW

### Recommendations

**Before Execution:**

1. **Correct PLAN-2.1 test file path** (CRITICAL):
   - Update all 6 references to `test/unit/state-read.bats` → `test/state-read.bats`
   - Verify path exists: `ls -la /Users/lgbarn/Personal/shipyard/test/state-read.bats`
   - Update verification commands (lines 129, 149) to use correct path

2. **Verify file paths in PLAN-1.1 and PLAN-1.2** (LOW priority):
   - Check that `commands/build.md` exists and has SUMMARY template around line 88
   - Check that `commands/ship.md` exists and has Step 3/Step 4 boundary around lines 143-145
   - Use section headers as the source of truth, not line numbers

3. **Confirm all tools are available** (pre-execution):
   - Verify `npx bats` works: `npx bats --version`
   - Verify `shellcheck` is available: `shellcheck --version`
   - Verify `jq` is available: `jq --version`

**During Execution:**

1. Follow TDD discipline in PLAN-2.1: write tests first (red), implement (green), validate (measure tokens)
2. Create `.shipyard/lessons-learned/` directory if it doesn't exist (Task 1 specifies creation)
3. Ensure git commits use standard convention: `shipyard(phase-N): {message}`

**After Execution:**

1. Run full regression test suite: `bash test/run.sh`
2. Verify Phase 5 success criteria (measure token budget, check file paths)
3. Add VERIFICATION.md to Phase 5 directory with build results

---

## Verdict

**CONDITIONAL FAIL** (Pre-execution plan quality)

**Reason:** PLAN-2.1 contains a critical path error that will cause execution failure. The plan references `test/unit/state-read.bats` but the actual test file is at `test/state-read.bats`. This error appears in multiple places throughout the plan and will prevent all PLAN-2.1 tasks from completing successfully.

**Status for other plans:** PASS
- PLAN-1.1: Fully specified, no blockers
- PLAN-1.2: Fully specified, no blockers

**Recommendation:** Correct the path error in PLAN-2.1 before execution. Once corrected, plans are ready for execution.

**Corrective Action Required:** Edit `/Users/lgbarn/Personal/shipyard/.shipyard/phases/5/plans/PLAN-2.1.md` and replace 6 instances of `test/unit/state-read.bats` with `test/state-read.bats`.

