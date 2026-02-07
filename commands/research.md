---
description: "On-demand domain research — evaluate technology options, investigate ecosystem choices"
disable-model-invocation: true
argument-hint: "<topic> — required: technology choice, domain question, or ecosystem investigation"
---

# /shipyard:research - On-Demand Domain Research

You are executing on-demand domain research. Follow these steps precisely.

<prerequisites>

## Step 1: Parse Arguments

Extract from the command:
- `topic` (REQUIRED): The research topic. Examples:
  - `"React vs Vue for dashboard"` — technology comparison
  - `"best Postgres connection pooling library"` — ecosystem investigation
  - `"authentication approaches for REST API"` — architectural research
  - `"gRPC vs REST for microservices"` — protocol comparison

If no topic is provided, ask the user what they want to research.

## Step 2: Detect Context

1. Check if `.shipyard/` exists (optional — this command works anywhere).
2. If `.shipyard/config.json` exists, read `model_routing.planning` for model selection.
3. Otherwise, use default model: **sonnet**.
4. Follow **Worktree Protocol** (see `docs/PROTOCOLS.md`) — detect worktree context.

</prerequisites>

<execution>

## Step 3: Build Agent Context

Assemble context per **Agent Context Protocol** (see `docs/PROTOCOLS.md`):
- The research topic from Step 1
- `.shipyard/PROJECT.md` (if exists) — for project stack context
- Codebase docs per **Codebase Docs Protocol** (if `.shipyard/` exists) — especially STACK.md, ARCHITECTURE.md
- Working directory and current branch
- Any existing technology choices to consider compatibility with

## Step 4: Dispatch Researcher

Dispatch a **researcher agent** (subagent_type: "shipyard:researcher") with:
- Follow **Model Routing Protocol** — resolve model from `model_routing.planning` (default: sonnet)
- max_turns: 15
- All context from Step 3
- Instruction: Investigate the topic thoroughly — identify candidates, deep-dive each via web search and documentation, analyze codebase compatibility, build comparison matrix, formulate recommendation with risks and mitigations

</execution>

<output>

## Step 5: Present Results

Display the research document to the user.

Offer follow-up:
> "Would you like me to:
> - Save this research to `.shipyard/` for future reference
> - Create an implementation plan based on the recommendation
> - Research a related topic"

</output>
