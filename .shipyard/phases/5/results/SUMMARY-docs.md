# Documentation Report: Phase 5 - Lessons-Learned System

**Phase:** 5 (Lessons-Learned System)
**Date:** 2026-02-01
**Status:** Complete

## Summary

Phase 5 implemented a comprehensive lessons-learned system that captures discoveries, patterns, and pitfalls during development and persists them for future sessions. The system consists of:

- **1 new skill** (`lessons-learned`) for formatting and quality standards
- **3 command modifications** (ship.md, build.md integration points)
- **1 script enhancement** (state-read.sh for lessons display)
- **3 new tests** (bats coverage for lessons loading)

Total changes: 5 files modified, 210+ lines added across skill definition, workflow integration, state loading, and test coverage.

---

## Phase Overview

**Goal:** Auto-capture discoveries during building/shipping and persist them for future sessions.

**Complexity:** Medium (M)

**Dependencies:** Phase 3 (Reliability), Phase 4 (Token Optimization)

**Success Criteria Met:**
1. User prompted with captured lessons after `/shipyard:ship` - Implemented
2. Approved lessons appended to `.shipyard/LESSONS.md` with timestamp and phase - Implemented
3. CLAUDE.md integration (optional) - Implemented
4. Lessons visible in `state-read.sh` output (execution tier only, max 5 recent) - Implemented
5. Skill file under 200 lines - Achieved (108 lines)

---

## What Was Built

### 1. Lessons-Learned Skill (Plan 1.1)

**File:** `/Users/lgbarn/Personal/shipyard/skills/lessons-learned/SKILL.md`
**Size:** 108 lines
**Status:** New file

#### Purpose
Provides format specifications, quality standards, and workflow guidance for capturing and persisting lessons learned during Shipyard execution.

#### Key Sections

**LESSONS.md Format:**
Defines the exact markdown structure for storing lessons in `.shipyard/LESSONS.md`:
```markdown
## [YYYY-MM-DD] Phase N: {Phase Name}

### What Went Well
- {Bullet point}

### Surprises / Discoveries
- {Pattern discovered}

### Pitfalls to Avoid
- {Anti-pattern encountered}

### Process Improvements
- {Workflow enhancement}
```

**Structured Prompts:**
Four standardized questions presented to users during lesson capture:
1. What went well in this phase?
2. What surprised you or what did you learn?
3. What should future work avoid?
4. Any process improvements discovered?

**Pre-Population:**
Automatically extracts candidate lessons from build artifacts before prompting:
- Reads all `SUMMARY-*.md` files in `.shipyard/phases/{N}/results/`
- Extracts "Issues Encountered" sections (workarounds, edge cases)
- Extracts "Decisions Made" sections (rationale worth preserving)
- Pre-fills prompts with extracted items for user review

**CLAUDE.md Integration:**
Optional integration with project's `CLAUDE.md`:
- Checks if `CLAUDE.md` exists in project root
- Finds or creates `## Lessons Learned` section
- Appends concise single-line bullets (omits dates, focuses on actionable guidance)

**Quality Standards:**
Explicit good/bad examples and anti-patterns:
- Good: "Bash `set -e` interacts poorly with pipelines -- use explicit error checks after pipes"
- Bad: "Tests are important" (too generic)
- Reject: Duplicates, line-number references, generic truisms, overly long entries

#### Design Decisions
- Kept skill file at 108 lines (well within 200-line limit)
- Followed format conventions from `security-audit/SKILL.md` (short, focused, checklist-oriented)
- Used `##` headings for all sections (matching convention in other skills)

---

### 2. Ship Command Integration (Plan 1.2)

**File:** `/Users/lgbarn/Personal/shipyard/commands/ship.md`
**Changes:** Added Step 3a (~62 lines) + Step 9 update (+3 lines)

#### Step 3a: Capture Lessons Learned
Inserted between Step 3 (Determine Scope) and Step 4 (Present Delivery Options).

**Workflow:**
1. **Extract candidate lessons** - Read SUMMARY.md files from shipping scope (phase or milestone)
2. **Present to user** - Use AskUserQuestion with four structured prompts, pre-populated with candidates
3. **Persist lessons** - Format and append to `.shipyard/LESSONS.md` (create if needed)
4. **CLAUDE.md update** - Ask user if they want to update project's CLAUDE.md (if exists)
5. **Skip handling** - User can type "skip" to bypass lesson capture
6. **Commit** - `shipyard(phase-{N}): capture lessons learned`

**Step 9 Enhancement:**
Added conditional final message line:
```markdown
If lessons were captured in Step 3a:
"Lessons learned have been saved to `.shipyard/LESSONS.md`."
```

#### Design Decisions
- Used "3a" sub-step numbering (avoiding renumbering existing steps)
- Double-quotes around "skip" keyword for consistency
- No renumbering of subsequent steps (preserves stability)

---

### 3. Build Command Enhancement (Plan 1.1)

**File:** `/Users/lgbarn/Personal/shipyard/commands/build.md`
**Changes:** Added "Lesson Seeding" note (+8 lines after line 88)

#### Lesson Seeding
Added emphasis in builder agent instructions after the SUMMARY.md template:

```markdown
**Lesson Seeding:** Document all discoveries thoroughly in "Issues Encountered" and "Decisions Made":
- Unexpected behaviors or edge cases found
- Workarounds applied and why
- Assumptions proven wrong during implementation
- Things that were harder or easier than expected

These entries will be used as pre-populated suggestions when capturing lessons at ship time.
```

**Purpose:** Encourages builders to document thoroughly during execution, which feeds the pre-population system in ship.md Step 3a.

---

### 4. State Loading Enhancement (Plan 2.1)

**File:** `/Users/lgbarn/Personal/shipyard/scripts/state-read.sh`
**Changes:** Added lessons loading block (+16 lines, lines 166-181)

#### Implementation
Integrated lessons loading into execution/full tier context (after phase plans/summaries):

**Logic:**
1. Check for `.shipyard/LESSONS.md`
2. Extract last 5 date-stamped section headers via `grep -n "^## \["`
3. Read header + 8 lines per section via `sed -n`
4. Append to `state_context` under "Recent Lessons Learned" heading

**Example Output:**
```bash
### Recent Lessons Learned
## [2026-01-15] Phase 1: Security Hardening

### What Went Well
- shellcheck caught issues early

### Pitfalls to Avoid
- grep -oP is not POSIX-compatible

---
```

**Token Budget:**
Measured token overhead:
- 2 lessons: 39 words delta (well under 80-word threshold)
- 5 lessons (max, simple): 99 words delta (~130 tokens)
- 5 lessons (max, complex): 117 words delta (~155 tokens)
- All within 250-token budget

**Tier Behavior:**
- **Execution/Full tier:** Displays last 5 lessons
- **Planning tier:** Does not display lessons (prevents clutter during planning)
- **Minimal tier:** Does not display lessons

#### Design Decisions
- Placed after phase plan/summary loading (same tier block)
- Used `_` (underscore) for unused variable in `IFS=: read -r line_num _` (satisfies shellcheck)
- 8-line extraction window per lesson (covers header + subsections adequately)

---

### 5. Test Coverage (Plan 2.1)

**File:** `/Users/lgbarn/Personal/shipyard/test/state-read.bats`
**Changes:** Added 3 new test cases (+87 lines)

#### Test Cases

**Test 1: Execution tier displays Recent Lessons when LESSONS.md exists**
- Creates `.shipyard/LESSONS.md` with 3 sample entries
- Sets status to "building" (execution tier)
- Asserts "Recent Lessons" section header appears
- Asserts "Phase 1" content appears

**Test 2: No Recent Lessons section when LESSONS.md does not exist**
- Execution tier context but no LESSONS.md file
- Asserts "Recent Lessons" section is absent

**Test 3: Planning tier does not display lessons even when LESSONS.md exists**
- Creates LESSONS.md with sample entries
- Sets status to "planning"
- Asserts "Recent Lessons" section is absent (tier-appropriate behavior)

#### Test Results
- All 39 tests pass (12 state-read tests total, including 3 new)
- Zero regressions
- shellcheck passes with `--severity=warning`

#### Design Decisions
- TDD approach: wrote failing tests first, then implemented (red-green cycle)
- Fixed shellcheck SC2034 warning during implementation

---

## Files Changed

### Created
1. `/Users/lgbarn/Personal/shipyard/skills/lessons-learned/SKILL.md` (108 lines)

### Modified
2. `/Users/lgbarn/Personal/shipyard/commands/ship.md` (+65 lines: Step 3a + Step 9 update)
3. `/Users/lgbarn/Personal/shipyard/commands/build.md` (+8 lines: Lesson Seeding note)
4. `/Users/lgbarn/Personal/shipyard/scripts/state-read.sh` (+16 lines: lessons loading)
5. `/Users/lgbarn/Personal/shipyard/test/state-read.bats` (+87 lines: 3 new tests)

**Total:** 1 new file, 4 modified files, 284 lines added

---

## How the Lessons System Works End-to-End

### During Build (`/shipyard:build`)

1. **Builder agents execute plans** and document discoveries in SUMMARY.md files
2. **"Issues Encountered" section** captures:
   - Unexpected behaviors or edge cases
   - Workarounds applied and why
   - Assumptions proven wrong
3. **"Decisions Made" section** captures:
   - Implementation decisions and rationale
   - Things that were harder/easier than expected

### During Ship (`/shipyard:ship`)

**Step 3a triggers after scope determination:**

1. **Extract Candidates**
   - Read all `SUMMARY-*.md` files in shipping scope
   - Parse "Issues Encountered" and "Decisions Made" sections
   - Generate pre-populated suggestions

2. **Present to User**
   - Display four structured prompts (what went well, surprises, pitfalls, improvements)
   - Show pre-populated candidates for each category
   - User can edit, add, or approve

3. **Persist Lessons**
   - Format as dated markdown section
   - Prepend to `.shipyard/LESSONS.md` (most recent first)
   - Each phase gets its own section with all four subsections

4. **Optional CLAUDE.md Update**
   - If `CLAUDE.md` exists in project root, ask user
   - Find or create `## Lessons Learned` section
   - Append concise single-line bullets (omit dates)

5. **Commit**
   - `shipyard(phase-{N}): capture lessons learned`

6. **Final Message**
   - Confirms lessons saved to `.shipyard/LESSONS.md`

### During Future Sessions

**When `state-read.sh` runs (SessionStart hook):**

1. **Tier Detection**
   - Execution/Full tier: Load recent lessons
   - Planning/Minimal tier: Skip lessons (reduce token overhead)

2. **Load Recent Lessons**
   - Read `.shipyard/LESSONS.md`
   - Extract last 5 date-stamped sections
   - Read header + 8 lines per section

3. **Inject into Context**
   - Add "Recent Lessons Learned" section to session context
   - Agent sees lessons in every execution-tier session
   - Token cost: ~130-155 tokens for 5 lessons

---

## Architecture Documentation

### Component Interactions

```
┌─────────────────────────────────────────────────────────────┐
│                  Lessons-Learned System                      │
└─────────────────────────────────────────────────────────────┘

Build Phase:
  commands/build.md
    └─> Builder agent executes plan
          └─> Creates SUMMARY-*.md with "Issues Encountered" + "Decisions Made"

Ship Phase:
  commands/ship.md (Step 3a)
    ├─> Read SUMMARY-*.md files
    ├─> Extract candidates from Issues/Decisions sections
    ├─> Present prompts to user (skills/lessons-learned/SKILL.md format)
    ├─> Write formatted lessons to .shipyard/LESSONS.md
    └─> Optionally update CLAUDE.md

Future Sessions:
  scripts/state-read.sh (SessionStart hook)
    ├─> Detect tier (execution/full only)
    ├─> Read .shipyard/LESSONS.md
    ├─> Extract last 5 sections
    └─> Inject into session context (150-token overhead)
```

### Data Flow

1. **Capture during build** - SUMMARY.md files store raw discoveries
2. **Extract during ship** - ship.md Step 3a reads summaries, extracts candidates
3. **User review** - User edits/approves lessons via prompts
4. **Persist** - Formatted lessons appended to `.shipyard/LESSONS.md`
5. **Inject** - `state-read.sh` loads recent lessons into future sessions
6. **Learn** - Agents see past lessons in execution tier, avoiding repeated mistakes

### Design Decisions

**Why prepend (most recent first)?**
- Most relevant lessons are from recent phases
- `state-read.sh` uses `tail -5` to get last 5, which naturally selects most recent

**Why only execution tier?**
- Planning tier focuses on high-level design; lessons are implementation details
- Token budget: planning tier stays under 2000 tokens

**Why 5 lessons max?**
- Token budget constraint: 5 lessons = ~130-155 tokens
- Diminishing returns beyond 5 (older lessons less relevant)

**Why 8 lines per lesson?**
- Covers section header + 4 subsections + separator
- Stays within token budget while providing context

**Why separate LESSONS.md from CLAUDE.md?**
- `.shipyard/LESSONS.md` is append-only log with full context (dates, phases)
- `CLAUDE.md` is curated, concise guidance (no dates, actionable only)
- Separation allows different audiences (Shipyard agents vs. general project agents)

---

## API Documentation

### `skills/lessons-learned/SKILL.md`

**Public Interface:**
- Invoked by `commands/ship.md` Step 3a for format guidance
- Referenced by builder agents for quality standards

**Key Exports:**
- LESSONS.md format specification (markdown template)
- Structured prompts (4 questions)
- Pre-population algorithm (extract from SUMMARY.md)
- Quality standards (good/bad examples, anti-patterns)
- CLAUDE.md integration rules

**Usage Example:**
```markdown
Invoke the `shipyard:lessons-learned` skill for format and quality guidance.
```

### `scripts/state-read.sh` Lessons Loading

**Entry Point:** Lines 166-181 (execution/full tier block)

**Dependencies:**
- `.shipyard/LESSONS.md` (optional)
- `grep -n "^## \["` for section header extraction
- `sed -n` for line range extraction

**Output:**
- Appends "Recent Lessons Learned" section to `state_context` variable
- Output appears in `hookSpecificOutput.additionalContext` JSON field

**Token Overhead:**
- 2 lessons: ~39 words (~50 tokens)
- 5 lessons: ~99-117 words (~130-155 tokens)

**Behavior:**
- Execution/Full tier: Load last 5 lessons
- Planning/Minimal tier: Skip lessons
- Missing LESSONS.md: No error, section omitted

---

## User-Facing Documentation

### Lessons Learned Workflow

**Step 1: Document During Build**

As you implement plans, document discoveries in build summaries:
- Note unexpected behaviors in "Issues Encountered"
- Record implementation decisions in "Decisions Made"
- These will be pre-populated when capturing lessons

**Step 2: Capture During Ship**

After completing a phase, run `/shipyard:ship`:
1. Step 3a will prompt you with four questions:
   - What went well?
   - What surprised you or what did you learn?
   - What should future work avoid?
   - Any process improvements?
2. Pre-populated suggestions from your summaries will appear
3. Edit, add, or approve the lessons
4. Type "skip" to bypass lesson capture

**Step 3: Lessons Persist**

Approved lessons are saved to `.shipyard/LESSONS.md`:
```markdown
## [2026-02-01] Phase 5: Lessons-Learned System

### What Went Well
- TDD approach caught edge cases early
- Pre-population reduced friction

### Surprises / Discoveries
- grep -n output format varies across BSD/GNU

### Pitfalls to Avoid
- Unused variables trigger shellcheck SC2034

### Process Improvements
- Document thoroughly during build, not just at ship time
```

**Step 4: Optional CLAUDE.md Update**

If your project has a `CLAUDE.md`, you'll be asked:
> Update CLAUDE.md with these lessons? (y/n)

If yes, concise bullets are added to the "Lessons Learned" section:
```markdown
## Lessons Learned
- grep -n output format varies across BSD/GNU -- use POSIX-compatible extraction
- TDD approach catches edge cases early -- write failing tests before implementation
```

**Step 5: Future Sessions Benefit**

During execution tier sessions (building), the last 5 lessons appear in session context. Agents see past lessons and avoid repeated mistakes.

---

## Testing Documentation

### Test Coverage

**File:** `test/state-read.bats`
**Tests added:** 3 (total state-read tests: 12)

**Coverage:**
- Execution tier lessons display (positive case)
- Missing LESSONS.md graceful handling (negative case)
- Planning tier lessons exclusion (tier-appropriate behavior)

**Run tests:**
```bash
npm test
# or
bash test/run.sh
```

**Expected results:**
```
39/39 tests pass
```

### Test Design

**TDD Red-Green Cycle:**
1. Wrote 3 failing tests (Test 1 fails, Tests 2-3 pass)
2. Implemented lessons loading in `state-read.sh`
3. All 3 tests pass

**Edge Cases Covered:**
- LESSONS.md exists vs. does not exist
- Execution tier vs. planning tier
- Multiple lessons (3 sample entries)
- Section header detection (`grep -n "^## \["`)
- Line range extraction (`sed -n`)

---

## Gaps Identified

### Current Limitations

1. **No lessons deduplication** - If similar lessons appear across phases, they all persist. Mitigation: User review during capture can reject duplicates.

2. **No lessons search** - Currently no tool to search lessons by keyword or phase. Future: Add `/shipyard:lessons --search <term>` command.

3. **No lessons expiration** - All lessons persist indefinitely. As LESSONS.md grows, oldest lessons remain loaded. Mitigation: 5-lesson limit in `state-read.sh` naturally prioritizes recent lessons.

4. **No lessons migration** - If LESSONS.md format changes, no migration tool exists. Mitigation: Schema versioning in STATE.md provides precedent for future migrations.

### Recommended Future Enhancements

1. **Lessons Analytics** - Track which lessons are referenced most often (requires agent logging)
2. **Lessons Search Command** - `/shipyard:lessons --search <keyword>` to find relevant past lessons
3. **Lessons Pruning** - Optional flag to prune lessons older than N phases or N days
4. **Lessons Export** - Export lessons to external formats (JSON, CSV) for team sharing

---

## Quality Metrics

### Code Quality
- shellcheck: 0 warnings (severity=warning)
- bats tests: 39/39 pass
- Line count: All files within budget

### Token Efficiency
- Skill file: 108 lines (~320 tokens) - Under 500-token budget
- Session overhead: ~130-155 tokens (5 lessons) - Under 250-token budget
- Pre-population reduces user burden (no typing from scratch)

### User Experience
- Pre-population: Reduces friction (candidates auto-extracted)
- Skip handling: User can bypass if needed
- Quality standards: Explicit good/bad examples guide user
- Tier-appropriate loading: Planning tier not cluttered

### Maintainability
- Single source of truth: `skills/lessons-learned/SKILL.md` defines format
- Separation of concerns: Capture (ship.md), storage (LESSONS.md), display (state-read.sh)
- Test coverage: 3 dedicated tests ensure stability

---

## Integration with Existing Documentation

### Updated Files

**commands/ship.md:**
- Added Step 3a between existing Step 3 and Step 4
- Updated Step 9 final message
- No breaking changes to existing workflow

**commands/build.md:**
- Added "Lesson Seeding" note after SUMMARY.md template
- No breaking changes to builder agent instructions

**scripts/state-read.sh:**
- Added lessons loading in execution tier block
- No breaking changes to existing tier logic
- Backwards compatible (missing LESSONS.md gracefully handled)

### Consistency with Conventions

**Skill Structure:**
- Followed format from `security-audit/SKILL.md` (short, focused)
- Used `##` headings (matches other skills)
- Frontmatter present (`name: lessons-learned`, `description`)

**Markdown Format:**
- Used standard markdown headers (`##`, `###`)
- Followed existing SUMMARY.md structure (sections, bullets)
- LESSONS.md format aligns with existing `.shipyard/` file conventions

**Command Flow:**
- Step 3a maintains "3.X" numbering pattern (like Step 2a, 2b)
- No renumbering of existing steps (stability)

---

## Recommendations

### Short-Term (Next Phase)

1. **Add usage examples to skill file** - Include a complete end-to-end example in `lessons-learned/SKILL.md`
2. **Document LESSONS.md schema** - Add schema version field to LESSONS.md for future migrations
3. **User guide in docs/** - Create `docs/guides/lessons-learned.md` for end-user reference

### Medium-Term (Future Milestones)

1. **Lessons search command** - `/shipyard:lessons --search <term>` for keyword search
2. **Lessons analytics** - Track which lessons are most referenced, promote to CLAUDE.md
3. **Team lessons sharing** - Export/import lessons between team members' Shipyard instances

### Long-Term (Post-v2.0)

1. **AI-assisted lesson extraction** - Use LLM to auto-suggest lessons from git diffs
2. **Lessons prioritization** - Rank lessons by relevance, promote high-value lessons
3. **Cross-project lessons** - Share lessons across multiple Shipyard projects

---

## Verification Results

### All Success Criteria Met

1. After `/shipyard:ship`, user prompted with captured lessons - Implemented in ship.md Step 3a
2. Approved lessons appended to `.shipyard/LESSONS.md` with timestamp and phase - Implemented with date-stamped sections
3. CLAUDE.md integration (if exists) - Implemented with user confirmation
4. Lessons visible in `state-read.sh` output (execution tier only, max 5 recent) - Implemented in lines 166-181
5. Skill file under 200 lines - Achieved (108 lines)

### Test Results

```
Total tests: 39/39 pass
State-read tests: 12/12 pass (including 3 new lessons tests)
Shellcheck: 0 warnings
Token overhead: 130-155 tokens (within 250-token budget)
```

### Code Review

- No critical findings
- No minor findings
- Positive feedback: TDD approach, clear documentation, token efficiency

---

## Conclusion

Phase 5 successfully implemented a complete lessons-learned system that:

1. **Reduces friction** - Pre-population auto-extracts candidates from build summaries
2. **Improves learning** - Lessons persist across sessions, visible during execution
3. **Maintains quality** - Explicit standards and examples guide users
4. **Stays efficient** - 130-155 token overhead (within budget)
5. **Integrates seamlessly** - No breaking changes to existing workflows

The system creates a feedback loop: discoveries during building feed lesson capture at ship time, which feeds context in future sessions. Over time, the project accumulates actionable, specific lessons that prevent repeated mistakes.

**Next steps:**
- Phase 6: Developer Experience (CONTRIBUTING.md, documentation dedup)
- Consider adding lessons search command in future milestone
- Monitor LESSONS.md growth; consider pruning after 20+ phases

---

## Appendix: File Locations

- Skill: `/Users/lgbarn/Personal/shipyard/skills/lessons-learned/SKILL.md`
- Ship command: `/Users/lgbarn/Personal/shipyard/commands/ship.md` (Step 3a, lines 145-206)
- Build command: `/Users/lgbarn/Personal/shipyard/commands/build.md` (lines 90-96)
- State loader: `/Users/lgbarn/Personal/shipyard/scripts/state-read.sh` (lines 166-181)
- Tests: `/Users/lgbarn/Personal/shipyard/test/state-read.bats` (lines 163-212)
- Summaries: `/Users/lgbarn/Personal/shipyard/.shipyard/phases/5/results/SUMMARY-*.md`

**Phase artifacts:** `/Users/lgbarn/Personal/shipyard/.shipyard/phases/5/`
**Git commits:** 7 commits (4d548c5 through 5035da3)
