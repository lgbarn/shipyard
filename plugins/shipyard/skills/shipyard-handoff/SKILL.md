---
name: shipyard-handoff
description: Captures session context into .shipyard/HANDOFF.md so the next session can resume without losing progress.
---

<!-- TOKEN BUDGET: 80 lines / ~240 tokens -->

# Session Handoff

<activation>

## When to Use

- User says "handoff", "hand off", "transfer session", "save context", or "I'm done for now"
- User is ending a session and wants context preserved for the next session
- A long work session is wrapping up and state should be recorded

## Natural Language Triggers
- "handoff", "hand off", "transfer session", "save context", "I'm done for now"

</activation>

## Overview

Capture the current session's progress into `.shipyard/HANDOFF.md` so the next session can resume immediately with full context. The orchestrator writes the file directly — this is never delegated to a sub-agent.

I'm using the handoff skill to capture session context.

<instructions>

## The Process

Write `.shipyard/HANDOFF.md` with exactly these five sections in order:

### 1. Current Task
What was being worked on at handoff time. Be specific: which file, which feature, which plan task.

### 2. Approach
The strategy or design being followed. Include key decisions already made so the next session doesn't re-litigate them.

### 3. Tried
What has been attempted and the outcomes — both successes and failures. Include error messages or unexpected behaviors observed.

### 4. Remaining
Concrete next steps not yet done. List as actionable items, ordered by priority.

### 5. Open Questions
Unresolved decisions or blockers that need human input or further investigation.

## File Format

```markdown
## Current Task
[What was being worked on]

## Approach
[Strategy and key decisions]

## Tried
[What was attempted and results]

## Remaining
[Concrete next steps]

## Open Questions
[Unresolved decisions or blockers]
```

</instructions>

<rules>

## Key Principles

- **Orchestrator writes the file** — never delegate to a sub-agent; sub-agents frequently fail to write output files
- **File path is always** `.shipyard/HANDOFF.md` relative to the project root
- **All five sections are required** — do not omit any section, even if the content is "none"
- **Be concrete** — vague handoffs are useless; include file paths, line numbers, error text where relevant
- **After writing**, confirm to the user: "HANDOFF.md is ready. The next session will automatically pick it up when it starts."

</rules>
