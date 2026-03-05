---
name: lessons-learned
description: Use when a phase or milestone is complete and you need to extract reusable knowledge, before shipping, or when reflecting on completed work. Also use when the user says "what did we learn", "capture lessons", "retrospective", "wrap up", "ship this phase", or "done with this phase". If a phase is about to ship without lesson capture, this skill must activate.
---

<!-- TOKEN BUDGET: 215 lines / ~645 tokens -->

# Lessons Learned

<activation>

## When to Use

- After phase completion during `/shipyard:ship` (Step 3a)
- When reflecting on completed work to extract reusable knowledge
- When a build summary contains notable discoveries worth preserving

## Natural Language Triggers
- "what did we learn", "capture lessons", "retrospective", "lessons learned"

</activation>

## When NOT to Use

- Mid-implementation (wait until the phase ships — partial lessons lack full context)
- Documenting code design decisions (put those in inline comments or architecture docs)
- Tracking active bugs (use issue tracker; lessons capture completed learning, not open problems)

## Timing Rule

**Run immediately after ship, before the next phase starts.** Lessons captured 24+ hours later lose the "why" behind decisions. If you're about to start the next phase, capture lessons first.

## Overview

The lessons-learned system captures discoveries, patterns, and pitfalls found during implementation and feeds them back into the project. Lessons are stored in `.shipyard/LESSONS.md` and optionally surfaced in `CLAUDE.md` so future agents benefit from past experience.

<instructions>

## LESSONS.md Format

Store lessons in `.shipyard/LESSONS.md` using this exact structure:

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

New entries are prepended after the `# Shipyard Lessons Learned` heading so the most recent phase appears first. Each phase gets its own dated section with all four subsections.

## Prioritization Order

When multiple lessons compete for a limited CLAUDE.md budget, prioritize in this order:

1. **Pitfalls to Avoid** — prevents repeated mistakes (highest value)
2. **Process Improvements** — improves next phase execution
3. **Surprises / Discoveries** — corrects wrong mental models
4. **What Went Well** — confirms what to repeat (lowest urgency — already working)

## Structured Prompts

Present these four questions to the user during lesson capture:

1. **What went well in this phase?** -- Patterns, tools, or approaches that worked effectively.
2. **What surprised you or what did you learn?** -- Unexpected behaviors, new techniques, or revised assumptions.
3. **What should future work avoid?** -- Anti-patterns, dead ends, or approaches that caused problems.
4. **Any process improvements discovered?** -- Workflow changes, tooling suggestions, or efficiency gains.

Pre-populate suggested answers from build artifacts before asking (see Pre-Population below).

## Pre-Population

Before presenting prompts, extract candidate lessons from completed build summaries:

1. Read all `SUMMARY-*.md` files in `.shipyard/phases/{N}/results/`.
2. Extract entries from **"Issues Encountered"** sections -- these often contain workarounds and edge cases.
3. Extract entries from **"Decisions Made"** sections -- these capture rationale worth preserving.
4. Present extracted items as pre-populated suggestions the user can accept, edit, or discard.

This reduces friction and ensures discoveries documented during building are not lost.

## Multi-Agent Synthesis

When lessons come from multiple builder agents working in parallel:

1. **Collect** — gather SUMMARY-*.md from all agents in the phase
2. **Group** — sort entries by the four lesson categories
3. **De-duplicate** — merge entries that describe the same issue with different wording
4. **Prioritize by frequency** — if 3 agents hit the same pitfall, it ranks higher than a one-off
5. **Cross-reference** — check against existing LESSONS.md entries to avoid duplicates

Do not skip de-duplication. Parallel agents frequently discover the same issues independently.

## CLAUDE.md Integration

After the user approves lessons, optionally append to `CLAUDE.md`:

1. If no `CLAUDE.md` exists, skip entirely.
2. Find or create a `## Lessons Learned` section.
3. Append concise single-line bullets (omit phase dates, focus on actionable guidance).

**Selection criteria for CLAUDE.md** (be selective — CLAUDE.md has a token budget):
- Actionable every session, not just in this phase context
- Not phase-specific (generic enough to apply to future work)
- Fits as a one-liner (two sentences → split or summarize)
- Not already captured in existing CLAUDE.md entries

</instructions>

<rules>

## Iron Law

```
NO PHASE SHIPS WITHOUT LESSON CAPTURE
```

No exceptions:
- Not for "small phases" or "just a bugfix"
- Not for "we're in a hurry"
- Not for "nothing notable happened"
- Even smooth phases confirm what's working — capture it

## Quality Standards

Lessons must be **specific, actionable, and reusable**. Apply these filters:

**Anti-Patterns to reject:**
- Lessons that duplicate existing entries in LESSONS.md
- Lessons that reference specific line numbers or ephemeral file locations
- Lessons that are generic truisms rather than discovered knowledge
- Lessons longer than two sentences -- split or summarize

</rules>

<examples>

## Lesson Quality Examples

### Good Lesson -- specific, transferable, actionable

```
### Pitfalls to Avoid
- bats-core `run` captures exit code but swallows stderr -- use `2>&1` to capture both
```

Why it works: Names the exact tool and behavior, explains the symptom, and gives the fix.

### Good Lesson -- documents a non-obvious decision

```
### Surprises / Discoveries
- jq `.field // "default"` prevents null propagation in optional config values --
  without the fallback, downstream commands silently receive "null" as a string
```

### Good Lesson -- process improvement example

```
### Process Improvements
- Run `shellcheck` on test helper files, not just source scripts —
  helper functions have the same quoting bugs as production code
```

Why it works: Identifies a concrete workflow gap and specifies exactly what to add.

### Bad Lesson -- vague platitude

```
### What Went Well
- Tests are important
```

Why it fails: Generic truism. Zero discovered knowledge.

### Bad Lesson -- too specific, not transferable

```
### Pitfalls to Avoid
- Fixed a bug on line 47 of parser.py
```

Why it fails: Line 47 will change. Future readers cannot act on this.

### Bad Lesson -- implementation detail, not a lesson

```
### Process Improvements
- Changed variable name from x to y
```

Why it fails: A code change, not a reusable insight.

</examples>

## Integration

**Called by:** commands/ship.md — Step 7 for post-phase lesson capture
**Pairs with:** shipyard:shipyard-verification — validate lesson quality before persisting
**Leads to:** shipyard:documentation — update project docs with any discovered conventions
