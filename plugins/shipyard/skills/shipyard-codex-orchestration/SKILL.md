---
name: shipyard-codex-orchestration
description: Use when running any multi-step Shipyard workflow under Codex — build, audit, plan, ship, review, research, or map. Explains how Shipyard's parallel-agent workflows degrade to inline sequential execution in Codex, and routes intent to the right workflow skill. Trigger when the user says "build the plan", "audit this", "ship it", "review the code", "run the shipyard build", or asks how Shipyard works in Codex.
---

# Shipyard orchestration under Codex

Shipyard was built for Claude Code, where workflows dispatch **fresh subagents in
parallel** (builder, reviewer, auditor, architect, verifier, researcher, mapper, …)
via the Task tool. Codex has no equivalent — it runs in a single context.

So under Codex, Shipyard workflows run as **inline sequential personas**: instead of
dispatching a separate agent, you adopt each role yourself, one after another, in this
same conversation.

## Honest degradation — what you lose

- **No parallelism.** Roles run one at a time, so multi-agent phases are slower.
- **No context isolation.** In Claude Code a fresh reviewer can't be biased by the
  builder's reasoning. Here the same context does both, so a review is less independent.
  Compensate by being deliberately skeptical when you switch into a review/verify role —
  re-read the actual artifact, don't trust your own prior step.

What you keep: the **discipline** — the review and verify gates still run, just sequentially.

## The inline-sequential pattern

When a workflow calls for "dispatch the X agent", instead:

1. State which role you're entering ("Now acting as the reviewer…").
2. Adopt that role's mandate fully — including its MUST-NOT constraints (a reviewer
   makes no code edits; a mapper only documents).
3. Produce the role's deliverable.
4. Exit the role and continue the workflow.

## Routing — which skill for which intent

| Intent | Skill / behavior |
|---|---|
| Implement a plan | `shipyard-executing-plans` skill, run builder→reviewer→verifier inline |
| Security/compliance audit | `security-audit` skill, adopting the auditor mandate |
| Create a plan | `shipyard-writing-plans` skill (+ `shipyard-brainstorming` first) |
| Code review after a build | `shipyard-review` skill |
| Domain/technology research | `shipyard-research` skill |
| Map/onboard a codebase | `shipyard-map` skill |
| Ship/release a completed phase | `shipyard-ship` skill |
| TDD a feature | `shipyard-tdd` skill |
| Debug a failure | `shipyard-debugging` skill |

If a workflow has a dedicated skill, use it and apply the inline-sequential pattern above
to any agent dispatch it describes. The `shipyard-review`, `shipyard-research`,
`shipyard-map`, and `shipyard-ship` skills exist because those roles have no other skill
home in Codex.

## State

Codex has no SessionStart hook, so Shipyard state is not auto-loaded. When a workflow
needs project state, run `scripts/state-read.sh` yourself at the start (see the
state/utility skills).
