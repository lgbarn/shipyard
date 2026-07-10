# Context Engineering: Smarter Agent Context Management v4.1.0

## Description

Apply WISC context engineering principles (Write, Isolate, Select, Compress) to tighten the feedback loop between what agents need and what they receive. Shipyard already implements adaptive context tiers, external state files, and agent isolation — this milestone refines each pillar with five targeted improvements informed by the ACE research (arXiv:2510.04618) and practitioner patterns from LangChain and Anthropic's engineering blog.

This is a backward-compatible release (minor version bump). No breaking changes.

## Goals

1. Reduce unnecessary context loading by scoping ROADMAP injection to the current phase (CTX-001)
2. Detect context bloat before it degrades agent reasoning (CTX-005)
3. Enable clean session transfers with structured handoff documents (CTX-003)
4. Create a tighter feedback loop within phases via mid-execution micro-lessons (CTX-004)
5. Surface agent context consumption patterns for task sizing decisions (CTX-002)

## Non-Goals

- Not redesigning the adaptive tier system — refining it
- Not adding token counting (character heuristics are sufficient)
- Not enforcing context budgets — warnings only, no blocking
- Not changing agent definition files or tool restrictions
- Not adding external observability (dashboards, metrics services)

## Requirements

### Select: Smarter Context Loading

#### CTX-001: Phase-Scoped Context Loading
- When `state-read.sh` is in execution tier and STATE.json has a phase number, extract only the current phase's section from ROADMAP.md
- Use awk to pull from `## Phase {N}` to the next `## Phase` delimiter
- Fallback: if extraction fails or returns empty, load first 80 lines (current behavior)
- Configurable override: `context_phase_scope: false` in `.shipyard/config.json` disables scoping

#### CTX-005: Context Rot Detection
- At the end of `state-read.sh`, measure total output size in characters
- If output exceeds configurable threshold (default: 8000 chars, ~2000 tokens), emit a warning suggesting the user prune NOTES.md or old phase artifacts
- Threshold configurable via `context_warn_threshold` in `.shipyard/config.json`
- Warning only — no blocking behavior

### Write: Structured Handoff

#### CTX-003: Handoff Skill (`/shipyard:handoff`)
- New skill: `skills/shipyard-handoff/SKILL.md`
- Produces `.shipyard/HANDOFF.md` with structured sections:
  - **Current task**: what was being worked on
  - **Approach**: strategy being followed
  - **Tried**: what was attempted and outcomes
  - **Remaining**: what's left
  - **Open questions**: unresolved decisions
- `state-read.sh` detects `HANDOFF.md` on session start and injects into context
- After injection, renames to `HANDOFF.md.consumed` (one-shot — doesn't persist)
- Natural language triggers: "handoff", "hand off", "transfer session", "save context", "I'm done for now"

### ACE: Mid-Execution Feedback Loop

#### CTX-004: Mid-Execution Micro-Lessons
- After each builder agent completes a task, the orchestrator extracts a one-line takeaway
- Appended to `.shipyard/phases/{N}/MICRO-LESSONS.md`
- Format: `- [{task-label}]: {what was learned}`
- Next builder in the same phase receives this file as additional context
- File is phase-scoped — does not carry forward to future phases
- Full lessons-learned capture still happens at phase end via existing skill
- Implementation: add extraction step to `shipyard-executing-plans` skill

### Isolate: Context Observability

#### CTX-002: Sub-Agent Context Reporting
- Add convention to agent dispatch prompts requesting a context report line:
  `<!-- context: turns={N}, compressed={yes|no}, task_complete={yes|no} -->`
- Orchestrator (executing-plans skill) parses this line from agent output
- Appends to `.shipyard/phases/{N}/AGENT-METRICS.md` with timestamp and agent type
- Patterns to watch for:
  - Consistently compressing → tasks too large
  - Finishing in <3 turns → tasks too small
  - `task_complete=no` → timeout or scope issue
- Opt-in: agents that don't include the line just don't get logged
- No changes to agent definition files — instruction goes in dispatch prompt
- Documentation: `docs/CONTEXT-ENGINEERING.md` explaining the WISC-aligned design

## Non-Functional Requirements

- All existing BATS tests must continue to pass
- No new runtime dependencies (bash, jq, git only)
- Changes to bash scripts must pass ShellCheck `--severity=warning`
- Context rot warning must not add measurable latency (<5ms overhead)
- Handoff skill must work in solo mode (no teams dependency)
- Phase-scoped loading must degrade gracefully (never load less than minimal tier)

## Success Criteria

1. Builder in phase 3 receives only phase 3's roadmap section, not the full 80 lines
2. Session with >8000 chars of context shows a pruning suggestion
3. `/shipyard:handoff` produces HANDOFF.md; next session consumes it and shows the content
4. After a builder completes a task, MICRO-LESSONS.md exists with a one-liner
5. After a build phase, AGENT-METRICS.md shows turn counts and compression status
6. `docs/CONTEXT-ENGINEERING.md` exists explaining the design
7. All BATS tests pass: `npm test`

## Constraints

- **Shipyard workflow is immutable** — no changes to commands, state machine, or orchestration protocols
- Pure bash plugin — no TypeScript, no new runtime dependencies
- Must pass ShellCheck and existing pre-commit hooks
- Backward-compatible — minor version bump to 4.1.0
- Micro-lessons are best-effort — if extraction fails, skip silently
- Agent metrics are opt-in — missing reports are not errors
