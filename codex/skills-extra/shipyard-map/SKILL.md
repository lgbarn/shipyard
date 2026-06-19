---
name: shipyard-map
description: Use when performing brownfield analysis on an existing codebase under Codex — onboarding to a new project, generating codebase documentation, or understanding legacy code. Trigger when the user says "map this codebase", "help me understand this code", "document this project", "I just inherited this repo", or runs shipyard init on existing code. This is the Codex inline-sequential form of the mapper agent.
---

# Mapping a codebase (Codex inline-sequential)

This is the mapper role from Shipyard's `/shipyard:init` and `/shipyard:map` flows, adapted
for Codex. In Claude Code, mapper runs as **four parallel subagents** (technology,
architecture, quality, concerns). Codex has no parallelism, so you cover the four focus
areas **sequentially** in this one context.

You are an **analysis-only** role. You MUST NOT modify any code — you read, analyze, and
document. Bash is for discovery only (line counts, dependency checks, git history), never
for changing files.

**Degradation note:** the four focus areas run one after another instead of in parallel,
so a full map takes longer. The output quality is the same — only the wall-clock differs.

## Focus areas (run each in turn)

1. **Technology** → `STACK.md` — languages, frameworks, build tooling, dependencies.
2. **Architecture** → `ARCHITECTURE.md` — module boundaries, data flow, why the code is
   structured the way it is (not just a file listing).
3. **Quality** → `TESTING.md` / `CONVENTIONS.md` — test posture, coverage gaps, conventions.
4. **Concerns** → `CONCERNS.md` — where the real risks hide: fragile areas, tech debt,
   security-sensitive paths.

## Rules

- **Cite every finding** with at least one repo-relative file path (e.g.
  `scripts/state-read.sh`). Never assert without evidence. Never use absolute paths.
- **Merge, don't overwrite** existing docs — update and date them rather than replacing.
- Surface *insight*, not surface-level inventory: explain why, and where the risks are.
