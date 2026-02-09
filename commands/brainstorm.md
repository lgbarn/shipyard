---
description: "Explore requirements through Socratic dialogue and capture project definition"
disable-model-invocation: true
argument-hint: "[topic] — optional focus area for brainstorming"
---

# /shipyard:brainstorm - Requirements Exploration

You are executing the Shipyard brainstorming workflow. Follow these steps precisely and in order.

<prerequisites>

## Step 1: Check Project Exists

Verify `.shipyard/` directory exists. If not, tell the user:
> "No Shipyard project found. Run `/shipyard:init` first to create a project."

Then stop.

## Step 2: Check Existing Project Definition

Check if `.shipyard/PROJECT.md` already exists.

- **If it exists:** Use `AskUserQuestion` to ask: "A project definition already exists. What would you like to do?"
  - `Update existing` — Load the current PROJECT.md and use it as starting context for the brainstorming dialogue. The user can refine, expand, or modify the existing definition.
  - `Start fresh` — Ignore the existing PROJECT.md and begin a new brainstorming session from scratch.

</prerequisites>

<execution>

## Step 3: Socratic Dialogue

Invoke the `shipyard:shipyard-brainstorming` skill to conduct a Socratic dialogue with the user.

- Explore what they want to build or change
- Ask clarifying questions about scope, constraints, and priorities
- Identify non-functional requirements (performance, security, accessibility)
- Determine success criteria
- If a topic argument was provided, focus the dialogue on that area

Continue the dialogue until the user indicates they are satisfied with the requirements exploration.

## Step 4: Capture Project Definition

When the user is satisfied, capture all decisions into `.shipyard/PROJECT.md` with these sections:

- **Project Name**
- **Description** (1-2 paragraphs)
- **Goals** (numbered list)
- **Non-Goals** (explicitly out of scope)
- **Requirements** (functional, grouped by area)
- **Non-Functional Requirements**
- **Success Criteria**
- **Constraints** (technical, timeline, budget)

## Step 5: Offer Roadmap Creation

Use `AskUserQuestion` to ask: "Would you like to generate a roadmap now?"

- `Yes (Recommended)` — Dispatch an **architect agent** (subagent_type: `"shipyard:architect"`) with the full PROJECT.md content to generate `.shipyard/ROADMAP.md`. Present the roadmap to the user for approval. Allow up to **3 revision cycles** where the user can request changes. After approval (or 3 rounds), finalize.
- `Not now` — Tell the user: "You can run `/shipyard:plan` later — it will offer to create a roadmap if one doesn't exist."

## Step 6: Commit & Update State

Create a git commit with the project definition (and roadmap if created):

```bash
git add .shipyard/PROJECT.md
# If ROADMAP.md was created, also stage it:
git add .shipyard/ROADMAP.md
git commit -m "shipyard: capture project definition"
```

Follow **State Update Protocol** (update `.shipyard/STATE.json` and `.shipyard/HISTORY.md` via state-write.sh; see `docs/PROTOCOLS.md`) -- update state:
- **Phase:** 1
- **Position:** Project definition captured, ready for planning
- **Status:** ready

</execution>

<output>

## Step 7: Route Forward

Display contextual guidance:

> Requirements captured! Next steps:

Check whether `.shipyard/ROADMAP.md` exists. If a roadmap was created:
> - `/shipyard:plan 1` — Start planning Phase 1

If no roadmap was created:
> - `/shipyard:plan` — Plan a phase of work (will offer to create a roadmap)

Check whether codebase analysis docs exist (in configured `codebase_docs_path`). If they do NOT exist and the project has existing source code:
> - `/shipyard:map` — Analyze your existing codebase

</output>
