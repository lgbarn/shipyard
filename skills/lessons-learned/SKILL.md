---
name: lessons-learned
description: Use when capturing discoveries after phase completion, before shipping, or when reflecting on completed work to extract reusable patterns
---

<!-- TOKEN BUDGET: 155 lines / ~465 tokens -->

# Lessons Learned

<activation>

## When to Use

- After phase completion during `/shipyard:ship` (Step 3a)
- When reflecting on completed work to extract reusable knowledge
- When a build summary contains notable discoveries worth preserving

## Natural Language Triggers
- "what did we learn", "capture lessons", "retrospective", "lessons learned"

</activation>

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

## CLAUDE.md Integration

After the user approves lessons, optionally append to `CLAUDE.md`:

1. If no `CLAUDE.md` exists, skip entirely.
2. Find or create a `## Lessons Learned` section.
3. Append concise single-line bullets (omit phase dates, focus on actionable guidance).

</instructions>

<rules>

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

**Referenced by:** `commands/ship.md` Step 7 for post-phase lesson capture.

**Pairs with:** `shipyard:shipyard-verification` for validating lesson quality before persisting.
