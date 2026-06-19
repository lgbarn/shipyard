# Using Shipyard with Codex

Shipyard is authored for [Claude Code](https://docs.claude.com/claude-code) but also ships a
generated plugin for [Codex CLI](https://github.com/openai/codex) (0.124.0+). Codex support is
**best-effort, not parity**: all skills run natively, but the parts of Shipyard that depend on
Claude Code's parallel subagents and lifecycle hooks degrade honestly.

This guide explains how to install it, how to drive it, and exactly what you gain and give up.

## Install

```bash
codex plugin marketplace add lgbarn/shipyard
```

`add` accepts an `owner/repo`, a Git URL, or a local checkout path. Then enable the **shipyard**
plugin in Codex. Pull updates later with:

```bash
codex plugin marketplace upgrade
```

To install from a local clone instead:

```bash
git clone git@github.com:lgbarn/shipyard.git
codex plugin marketplace add /absolute/path/to/shipyard
```

## How it differs from Claude Code

The Codex tree is **generated** from the canonical Claude Code artifacts (`scripts/build-codex.sh`)
and verified against drift in CI, so it always tracks the same source — but the two runtimes have
different primitives. Here is the mapping.

| Capability | Claude Code | Codex |
|---|---|---|
| Skills | `skills/<name>/SKILL.md` auto-activate | **Identical** — all 19 skills run natively |
| Slash commands | `/shipyard:build`, etc. | No plugin commands — invoke workflows **by intent** (skills auto-activate), routed by `shipyard-codex-orchestration` |
| Parallel subagents | builder/reviewer/auditor/… dispatched concurrently | **Inline sequential personas** — one context adopts each role in turn |
| Context isolation | fresh-context reviewer can't be biased by the builder | **Not available** — same context builds and reviews |
| Lifecycle hooks | `SessionStart` auto-loads state; teammate hooks | **None** — state loads on demand; teammate hooks are moot |

## Invoking workflows

There are no `/shipyard:*` commands in Codex. Instead, describe what you want and the matching
skill activates:

| You want to… | Say something like | Skill |
|---|---|---|
| Shape an idea | "let's design the auth feature" | `shipyard-brainstorming` |
| Write a plan | "plan the notifications phase" | `shipyard-writing-plans` |
| Build a plan | "build the plan" | `shipyard-executing-plans` (+ inline reviewer/verifier) |
| Review code | "review this implementation" | `shipyard-review` |
| Security audit | "audit this for vulnerabilities" | `security-audit` |
| Research options | "what are our options for X" | `shipyard-research` |
| Map a codebase | "map this repo" | `shipyard-map` |
| Ship a phase | "ship it" | `shipyard-ship` |
| Inspect/resume state | "shipyard status" / "resume" | `shipyard-state` |

When unsure, the `using-shipyard` and `shipyard-codex-orchestration` skills explain the workflow
and route you to the right one.

## Accepted costs (read this before relying on it)

Codex support deliberately trades parity for reach. The three concrete costs:

1. **Sequential, not parallel.** Multi-agent phases (build → review → verify) run one role at a
   time, so they are slower than Claude Code's concurrent dispatch.
2. **No fresh-context review isolation.** In Claude Code a brand-new reviewer subagent judges the
   build without the builder's context. In Codex the same context does both, so reviews are less
   independent. The orchestration skills counter this by telling you to re-read the actual
   artifact before judging — but it is not a substitute for true isolation.
3. **On-demand state, not auto-injected.** Without a `SessionStart` hook, Shipyard state is not
   loaded automatically. The `shipyard-state` skill runs `scripts/state-read.sh` on demand
   instead. Full fidelity (status/resume/checkpoint) is retained — it just isn't automatic.

The teammate lifecycle hooks (`TeammateIdle`, `TaskCompleted`, `Stop`) are **not** ported. That
is correct, not a regression: they only ever served the parallel-agent model that Codex doesn't
have.

## Future upgrade path (not implemented)

True context isolation could be restored on Codex by shelling out to `codex exec` as a child
process per agent role, recovering both isolation and some parallelism. This is intentionally
**not** built — it contradicts the best-effort scope and adds significant complexity. It is
documented here only so the option is on record.

## Reporting issues

Codex support is new and intentionally shipped early so real usage surfaces rough edges. If a
skill misbehaves under Codex, please open an issue at
<https://github.com/lgbarn/shipyard/issues> with the skill name and what you expected.
