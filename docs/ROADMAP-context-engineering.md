# Roadmap: Context Engineering v4.1.0

**Created:** 2026-03-24
**Source:** `docs/PROPOSAL-context-engineering.md`
**Scope:** 5 context engineering improvements across 3 phases. Backward-compatible minor release. Builds on the adaptive context tier system shipped in v3.2.0.

---

## Phase 1: Smarter Context Loading

### Objective
Refine the Select and Compress pillars of Shipyard's context engineering. Phase-scope the ROADMAP injection so builders only see their phase, and add a heuristic to warn when total context is bloated. Both changes touch `state-read.sh` — doing them together avoids double-modifying the same file.

Concerns addressed: CTX-001, CTX-005

### Files to Modify
1. `scripts/state-read.sh` -- Add phase-scoped ROADMAP extraction in execution tier; add context size measurement and warning at end of output
2. `test/state-read.bats` -- Add tests for phase-scoped extraction, fallback behavior, and context rot warning

### Changes

**CTX-001: Phase-scoped context loading (state-read.sh)**
In the execution tier branch where ROADMAP.md is loaded (currently `head -80`), replace with phase-scoped extraction:
1. Read the current phase number from STATE.json (`jq -r '.phase'`)
2. Use awk to extract from `^## Phase {N}` to the next `^## Phase` or `^---$` delimiter
3. If awk output is empty (malformed ROADMAP, missing phase section), fall back to `head -80`
4. Add config check: if `.shipyard/config.json` has `"context_phase_scope": false`, skip scoping and use `head -80`

The awk pattern: `awk "/^## Phase ${phase}([^0-9]|$)/,/^(## Phase [0-9]|---)/" ROADMAP.md | head -n -1`

This reduces execution-tier ROADMAP injection from ~80 lines to ~30-50 lines (typical phase size), freeing ~500 tokens for actual task context.

**CTX-005: Context rot detection (state-read.sh)**
After the final `additionalContext` string is assembled but before outputting:
1. Measure `${#additional_context}` (bash string length)
2. Read threshold from config: `jq -r '.context_warn_threshold // 8000'` from `.shipyard/config.json`
3. If length exceeds threshold, prepend a warning line to the context output:
   `"**Warning:** Context is large (~${size} chars). Consider pruning NOTES.md or clearing old phase artifacts with \`/shipyard:status\`."`
4. The warning appears inside the agent's context, not on stderr

### Success Criteria
1. With STATE.json at phase 3, `state-read.sh` output contains "## Phase 3" but NOT "## Phase 1" or "## Phase 2"
2. With STATE.json at phase 3 and a ROADMAP missing "## Phase 3", output contains first 80 lines (fallback)
3. With `context_phase_scope: false` in config, output contains first 80 lines regardless of phase
4. With >8000 chars of context, output contains "Warning" and "pruning"
5. With <8000 chars of context, no warning appears
6. All existing BATS tests pass: `npm test`
7. ShellCheck passes: `shellcheck --severity=warning scripts/state-read.sh`

### Estimated Scope
- 2 files modified (1 script, 1 test file)
- ~20 lines added to state-read.sh (phase extraction + rot detection)
- ~8 test cases added

---

## Phase 2: Handoff Protocol + Micro-Lessons

### Objective
Add two new Write-pillar mechanisms: a structured handoff skill for clean session transfers, and mid-execution micro-lessons for tighter within-phase feedback loops. These are independent of phase 1's script changes — they add new files and modify skills rather than core scripts.

Concerns addressed: CTX-003, CTX-004

### Files to Modify
1. `skills/shipyard-handoff/SKILL.md` -- Create new skill for structured session handoff
2. `scripts/state-read.sh` -- Add HANDOFF.md detection and injection in session start
3. `skills/shipyard-executing-plans/SKILL.md` -- Add micro-lesson extraction step after builder completion
4. `test/state-read.bats` -- Add tests for HANDOFF.md detection and consumption

### Changes

**CTX-003: Structured handoff skill**

Create `skills/shipyard-handoff/SKILL.md` with:
- Activation triggers: "handoff", "hand off", "transfer session", "save context", "I'm done for now", "wrap up session"
- Instructions: read current STATE.json, NOTES.md, recent git log, and in-progress task context. Produce `.shipyard/HANDOFF.md` with five sections:
  ```
  # Session Handoff
  **Created:** {ISO 8601 timestamp}
  ## Current Task
  {what was being worked on}
  ## Approach
  {strategy being followed}
  ## Tried
  {what was attempted, with outcomes}
  ## Remaining
  {what's left to do}
  ## Open Questions
  {unresolved decisions or blockers}
  ```
- The skill writes the file and confirms to the user

Add HANDOFF.md consumption to `state-read.sh`:
- In the context loading section (after STATE.json is read, before tier-based loading), check for `.shipyard/HANDOFF.md`
- If present, read its contents and prepend to `additionalContext` with header: `"### Session Handoff (from previous session)"`
- After reading, rename to `.shipyard/HANDOFF.md.consumed` so it only injects once
- The `.consumed` file is kept for debugging but ignored on future session starts

**CTX-004: Mid-execution micro-lessons**

Modify `skills/shipyard-executing-plans/SKILL.md` to add a post-builder step:
- After each builder agent returns, before dispatching the next builder, add instruction:
  ```
  After the builder completes, extract one actionable takeaway from its output.
  Append to `.shipyard/phases/{N}/MICRO-LESSONS.md`:
  - [{task-label}]: {one-line lesson}
  Skip if no clear takeaway — silence is better than noise.
  ```
- When dispatching subsequent builders in the same phase, include `MICRO-LESSONS.md` in their context prompt:
  ```
  If `.shipyard/phases/{N}/MICRO-LESSONS.md` exists, include:
  "### Lessons from earlier tasks in this phase:
  {contents of MICRO-LESSONS.md}"
  ```
- Micro-lessons file is phase-scoped. The existing lessons-learned skill handles cross-phase knowledge transfer.

### Success Criteria
1. `/shipyard:handoff` produces `.shipyard/HANDOFF.md` with all five sections
2. Next session start injects HANDOFF.md content and renames to `.shipyard/HANDOFF.md.consumed`
3. Third session start does NOT inject consumed handoff
4. `grep -q 'handoff\|hand off\|transfer session' skills/shipyard-handoff/SKILL.md` succeeds
5. After a builder completes, `MICRO-LESSONS.md` exists with at least one entry
6. Second builder in same phase receives micro-lessons in its context
7. All BATS tests pass: `npm test`

### Estimated Scope
- 4 files modified/created (1 new skill, 2 modified skills/scripts, 1 test file)
- ~80 lines added (handoff skill)
- ~15 lines added to state-read.sh (HANDOFF detection)
- ~20 lines added to executing-plans skill (micro-lesson extraction + injection)
- ~4 test cases added

---

## Phase 3: Agent Observability + Documentation

### Objective
Close the observability gap in agent isolation by surfacing context consumption patterns. Then document the full context engineering design for contributors. This phase depends on phases 1-2 being in use so the documentation reflects real behavior.

Concerns addressed: CTX-002, documentation

### Files to Modify
1. `skills/shipyard-executing-plans/SKILL.md` -- Add context report request to dispatch prompts; add metrics parsing after agent completion
2. `docs/CONTEXT-ENGINEERING.md` -- Create new documentation file explaining the WISC-aligned design

### Changes

**CTX-002: Sub-agent context reporting**

Modify `skills/shipyard-executing-plans/SKILL.md` to add context reporting:

1. In the builder/reviewer/auditor dispatch prompt template, append:
   ```
   At the end of your response, include exactly this line (filled in):
   <!-- context: turns={number of tool calls you made}, compressed={yes if you hit context limits, otherwise no}, task_complete={yes if fully done, no if cut short} -->
   ```

2. After each agent returns, parse the context report line:
   ```
   Extract the <!-- context: ... --> line from agent output.
   If found, append to `.shipyard/phases/{N}/AGENT-METRICS.md`:
   {ISO timestamp} | {agent-type} | {task-label} | turns={N} | compressed={yes|no} | complete={yes|no}
   ```

3. At the end of a build phase (after all waves complete), if AGENT-METRICS.md exists, summarize:
   ```
   Review AGENT-METRICS.md for patterns:
   - Any agent that compressed? → Note in phase summary that task was too large
   - Any agent with turns < 3? → Note that task could be batched
   - Any agent with complete=no? → Flag as incomplete work
   Include a one-paragraph "Context Health" section in the phase SUMMARY.md
   ```

**Documentation: docs/CONTEXT-ENGINEERING.md**

Create a contributor-facing document explaining:
1. The WISC framework and how Shipyard implements each pillar
2. Adaptive context tiers (minimal, planning, execution, brownfield, full) with token budgets
3. Phase-scoped loading (CTX-001) and why it matters
4. Handoff protocol (CTX-003) and the one-shot consumption pattern
5. Micro-lessons (CTX-004) and how they differ from full lesson capture
6. Agent metrics (CTX-002) and how to interpret AGENT-METRICS.md
7. Context rot detection (CTX-005) and tuning the threshold
8. References: ACE paper (arXiv:2510.04618), LangChain context engineering blog, Anthropic engineering blog

### Success Criteria
1. Builder dispatch prompts include the `<!-- context: ... -->` instruction
2. After a build phase, `AGENT-METRICS.md` exists with at least one entry per agent
3. Phase SUMMARY.md includes a "Context Health" section
4. `test -f docs/CONTEXT-ENGINEERING.md` succeeds
5. `grep -q 'WISC' docs/CONTEXT-ENGINEERING.md` succeeds
6. `grep -q 'adaptive.*tier\|context.*tier' docs/CONTEXT-ENGINEERING.md` succeeds
7. All BATS tests pass: `npm test`

### Estimated Scope
- 2 files modified/created (1 skill modification, 1 new doc)
- ~30 lines added to executing-plans skill (dispatch instruction + metrics parsing + summary)
- ~150 lines added (CONTEXT-ENGINEERING.md documentation)
- 0 new test cases (skill behavior is validated manually via build execution)

---

## Summary

| Phase | Concerns | Risk | Key Deliverable |
|-------|----------|------|-----------------|
| 1 | CTX-001, CTX-005 | Medium | Phase-scoped ROADMAP loading + context rot warning |
| 2 | CTX-003, CTX-004 | Low | Handoff skill + mid-execution micro-lessons |
| 3 | CTX-002, docs | Low | Agent context observability + WISC documentation |

**Total:** 5 features across 3 phases, ~8 files touched, ~315 lines added, ~12 test cases added.

**Dependency chain:** Phase 1 (state-read.sh changes) is independent. Phase 2 also touches state-read.sh (HANDOFF detection) but in a different section — can proceed after phase 1 or in parallel with care. Phase 3 depends on phases 1-2 for accurate documentation.

**Prerequisite:** v4.0.0 must be released first (phases 5-7 of the production hardening roadmap). This milestone builds on the hardened scripts.
