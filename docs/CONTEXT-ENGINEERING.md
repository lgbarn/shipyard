# Shipyard Context Engineering

Contributor reference for Shipyard's context engineering design. Covers the WISC framework, adaptive context tiers, and the five CTX features shipped in v4.1.0.

---

## The WISC Framework

WISC (Write, Isolate, Select, Compress) is a context engineering acronym coined by Cole Medin, synthesizing patterns from LangChain's context engineering research and Anthropic's agent engineering blog. It provides a vocabulary for the four things an orchestration system controls about what an agent sees.

| Pillar | Goal | Shipyard implementation |
|--------|------|------------------------|
| **Write** | Produce structured, reusable context artifacts | HANDOFF.md (CTX-003), MICRO-LESSONS.md (CTX-004), NOTES.md, HISTORY.md |
| **Isolate** | Prevent agents from cross-contaminating each other's context | Sub-agent dispatch (one agent per task), AGENT-METRICS.md (CTX-002) |
| **Select** | Load only what the current task needs | Adaptive context tiers, phase-scoped ROADMAP loading (CTX-001) |
| **Compress** | Reduce volume without losing signal | Context rot detection (CTX-005), one-shot HANDOFF consumption |

Shipyard was already WISC-aligned before v4.1.0 — external state files (Select), isolated sub-agents (Isolate), and structured summaries (Write) have been core since v3.0.0. The CTX features refine each pillar with targeted improvements.

---

## Adaptive Context Tiers

`state-read.sh` selects one of five tiers based on current project state. Each tier adds more context, using more tokens.

| Tier | When used | Approximate token budget |
|------|-----------|--------------------------|
| **minimal** | No `.shipyard/` directory exists | ~100 tokens |
| **planning** | STATE.json exists, status is `planning` | ~600 tokens |
| **execution** | STATUS is `building` or `reviewing` | ~3,000 tokens |
| **brownfield** | Multi-phase project, phase > 1 | ~3,000 tokens + prior phase summaries |
| **full** | Explicit override or debugging | All available state files |

In **execution** tier, `state-read.sh` loads: STATE.json, the current phase section of ROADMAP.md (CTX-001), NOTES.md, the active plan, and any HANDOFF.md (CTX-003). This is the tier most builders operate in.

Tiers degrade gracefully — if a file is missing, it is skipped and the next available context is loaded. The tier never drops below `minimal`.

---

## Phase-Scoped Context Loading (CTX-001)

**Problem:** In execution tier, `state-read.sh` previously loaded the first 80 lines of ROADMAP.md. For a multi-phase project, that included phase 1 and 2 content irrelevant to a phase 3 builder.

**Solution:** When STATE.json has a `phase` value, extract only that phase's section from ROADMAP.md using awk:

```bash
awk "/^## Phase ${phase}([^0-9]|$)/,/^(## Phase [0-9]|---)/" ROADMAP.md | head -n -1
```

This reduces execution-tier ROADMAP injection from ~80 lines to ~30-50 lines (a typical phase section), freeing roughly 500 tokens for actual task context.

**Fallback:** If the extraction returns empty (malformed ROADMAP, phase section missing), `state-read.sh` falls back to `head -80` — the previous behavior. The system never loads less than the minimal tier.

**Configuration:**

```json
// .shipyard/config.json
{ "context_phase_scope": false }
```

Setting `context_phase_scope` to `false` disables scoping and always loads `head -80`. Default: `true` (scoping enabled).

---

## Context Rot Detection (CTX-005)

**Problem:** Over a long project, NOTES.md accumulates, old phase artifacts pile up, and assembled context quietly grows past the point where an agent can reason effectively.

**Solution:** At the end of `state-read.sh`, after assembling the full context string, measure its character count. If it exceeds the configured threshold, prepend a warning:

```
**Warning:** Context is large (~{N} chars). Consider pruning NOTES.md or clearing
old phase artifacts with `/shipyard:status`.
```

The warning appears inside the agent's context (not on stderr), so the agent can act on it. This is advisory — no blocking behavior.

**Configuration:**

```json
// .shipyard/config.json
{ "context_warn_threshold": 8000 }
```

Default threshold: `8000` characters (~2,000 tokens). Lower it if your project has dense state files; raise it if warnings appear too early.

---

## Handoff Protocol (CTX-003)

**Problem:** Ending a Claude session mid-task loses working memory. The next session starts cold with no knowledge of what was tried, what worked, or what is left.

**Solution:** The `/shipyard:handoff` skill captures session state to `.shipyard/HANDOFF.md` before the user leaves.

**Activation phrases:** "handoff", "hand off", "transfer session", "save context", "I'm done for now", "wrap up session"

**HANDOFF.md structure:**

```markdown
# Session Handoff
**Created:** {ISO 8601 timestamp}

## Current Task
{what was being worked on}

## Approach
{strategy being followed}

## Tried
{what was attempted and outcomes}

## Remaining
{what's left to do}

## Open Questions
{unresolved decisions or blockers}
```

**One-shot consumption:** On the next session start, `state-read.sh` detects `.shipyard/HANDOFF.md`, injects its contents into context under the header `### Session Handoff (from previous session)`, then renames the file to `.shipyard/HANDOFF.md.consumed`. The `.consumed` file is retained for debugging but ignored on all future session starts. The handoff never injects twice.

**Orchestrator writes, not sub-agents.** The handoff skill runs in the orchestrator's context where full project state is visible. Sub-agents should not write HANDOFF.md.

---

## Micro-Lessons (CTX-004)

**Problem:** Within a build phase, later builders repeat mistakes made by earlier builders in the same phase. Full lessons-learned capture (the existing skill) runs at phase end — too late to help the current phase.

**Solution:** After each builder agent completes a task, the orchestrator (`shipyard-executing-plans` skill) extracts one actionable takeaway and appends it to `.shipyard/phases/{N}/MICRO-LESSONS.md`:

```
- [{task-label}]: {one-line lesson}
```

When dispatching subsequent builders in the same phase, the orchestrator includes MICRO-LESSONS.md in the dispatch context:

```
### Lessons from earlier tasks in this phase:
{contents of MICRO-LESSONS.md}
```

**Scope and behavior:**
- Phase-scoped — the file does not carry forward to future phases
- Best-effort — if extraction fails or there is no clear takeaway, the step is silently skipped
- Distinct from the lessons-learned skill, which runs at phase end and feeds into the project's long-term knowledge base

---

## Agent Metrics (CTX-002)

**Problem:** It is hard to know whether task sizing is right. A builder that compresses mid-task is overloaded; one that finishes in two tool calls was underloaded.

**Solution:** Builder, reviewer, and auditor dispatch prompts request a context report line at the end of the agent's response:

```
<!-- context: turns={number of tool calls made}, compressed={yes|no}, task_complete={yes|no} -->
```

This is opt-in — agents that omit the line are simply not logged. No error, no retry.

After each agent returns, the orchestrator parses the line and appends to `.shipyard/phases/{N}/AGENT-METRICS.md`:

```
{ISO timestamp} | {agent-type} | {task-label} | turns={N} | compressed={yes|no} | complete={yes|no}
```

**Interpreting AGENT-METRICS.md:**

| Pattern | Signal | Action |
|---------|--------|--------|
| `compressed=yes` consistently | Tasks too large for one agent | Split tasks in future plans |
| `turns < 3` consistently | Tasks too small; agents underutilized | Batch related tasks |
| `complete=no` | Timeout or scope overrun | Review task scope; add explicit stopping points |

At the end of a build phase, the orchestrator reviews AGENT-METRICS.md and includes a one-paragraph "Context Health" section in the phase SUMMARY.md.

**No changes to agent definition files.** The context report instruction is injected into the dispatch prompt at runtime — `.claude/agents/shipyard-*.md` files are unchanged.

---

## Configuration Reference

All keys live in `.shipyard/config.json`. All are optional — defaults apply when absent.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `context_tier` | string | auto-detected | Override tier selection. Values: `minimal`, `planning`, `execution`, `brownfield`, `full` |
| `context_phase_scope` | boolean | `true` | Extract only the current phase from ROADMAP.md in execution tier (CTX-001) |
| `context_warn_threshold` | number | `8000` | Character count above which context rot warning is emitted (CTX-005) |

---

## References

- **ACE: Agent Context Engineering** — arXiv:2510.04618. The research paper Shipyard's context engineering design is informed by.
- **LangChain context engineering blog** — Practitioner patterns for building effective agent context pipelines.
- **Anthropic engineering blog** — Guidance on agent design, tool use, and context management from the Claude team.
