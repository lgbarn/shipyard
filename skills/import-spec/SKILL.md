---
name: import-spec
description: Import a spec-kit feature spec into Shipyard, replacing brainstorming. Use when a spec-kit feature directory exists with spec.md.
argument-hint: "[feature-path] — path to spec-kit feature directory (e.g. specs/003-chat-system)"
---

# /shipyard:import-spec - Import spec-kit Artifacts

You are executing the Shipyard spec-kit import workflow. This replaces `/shipyard:brainstorm` when you have already created a spec using spec-kit. Follow these steps precisely.

<prerequisites>

## Step 1: Parse Argument

- If an argument is provided, use it as the feature path (e.g., `specs/003-chat-system`).
- If no argument is provided, check if a `specs/` directory exists in the project root.
  - If `specs/` exists and contains subdirectories: use `AskUserQuestion` to present the available feature directories and ask the user to choose one.
  - If `specs/` does not exist or is empty: tell the user: "No spec-kit feature directory found. Provide the path as an argument: `/shipyard:import-spec specs/<feature-name>`" and stop.

## Step 2: Validate Prerequisites

1. Verify `.shipyard/` directory exists. If not, tell the user to run `/shipyard:init` first, then stop.
2. Verify the feature path exists and contains `spec.md`. If `spec.md` is missing, tell the user: "spec.md not found in `<feature-path>`. Run `/speckit.specify` first to generate the feature spec." and stop.
3. Inventory which artifacts exist — note which are present for use in later steps:
   - `<feature-path>/spec.md` (required)
   - `<feature-path>/plan.md` (optional — used for ROADMAP.md generation)
   - `<feature-path>/research.md` (optional — copied to phase RESEARCH.md)
   - `<feature-path>/data-model.md` (optional — appended to RESEARCH.md)
   - `<feature-path>/contracts/` directory (optional — summarized into RESEARCH.md)
   - `<feature-path>/tasks.md` (optional — seeded into architect input at plan time)
   - `.specify/constitution.md` (optional — added to PROJECT.md constraints)

## Step 3: Check Existing PROJECT.md

If `.shipyard/PROJECT.md` already exists, use `AskUserQuestion` to ask:
> "A project definition already exists in `.shipyard/PROJECT.md`. What would you like to do?"
- `Replace with spec-kit import (Recommended)` — overwrite PROJECT.md with the imported spec content
- `Merge — update requirements section only` — keep existing PROJECT.md but replace the Requirements section with spec-kit user stories
- `Cancel` — stop

</prerequisites>

<execution>

## Step 4: Map spec.md -> .shipyard/PROJECT.md

Read `<feature-path>/spec.md` and extract the following to write `.shipyard/PROJECT.md`:

**Mapping rules:**
- **Project Name**: extract the feature name from the spec's `# Feature Specification: [NAME]` heading or the directory name
- **Description**: synthesize a 1-2 paragraph description from the spec's user story context and purpose
- **Goals**: each user story (US1, US2, US3...) becomes a numbered goal in priority order (P1 first)
- **Non-Goals**: look for any explicit exclusions in the spec; if none present, write "Not yet defined"
- **Requirements (Functional)**: expand each user story's acceptance scenarios into concrete requirements, grouped by user story
- **Non-Functional Requirements**: extract any performance, security, or scale constraints mentioned
- **Success Criteria**: map each user story's "Independent Test" description into a success criterion
- **Constraints**: note any `[NEEDS CLARIFICATION]` markers as open questions; if `.specify/constitution.md` exists, extract relevant principles as technical constraints

**Handle `[NEEDS CLARIFICATION]` markers:** If spec.md contains unresolved `[NEEDS CLARIFICATION: ...]` markers, list them in a `## Open Questions` section at the bottom of PROJECT.md and notify the user: "The imported spec has N unresolved clarification items — see Open Questions in PROJECT.md."

**Write `.shipyard/PROJECT.md`** using this structure:
```markdown
# [Project Name]

## Description
[1-2 paragraphs]

## Goals
1. [Goal from US1 — P1]
2. [Goal from US2 — P2]
...

## Non-Goals
- [explicit exclusions or "Not yet defined"]

## Requirements

### [User Story 1 Title]
- [requirement derived from acceptance scenario 1]
- [requirement derived from acceptance scenario 2]

### [User Story 2 Title]
...

## Non-Functional Requirements
- [extracted constraints]

## Success Criteria
- [from US1 Independent Test]
- [from US2 Independent Test]

## Constraints
- [from constitution.md principles, if present]
- [technical constraints from plan.md, if present]

## Open Questions
- [any [NEEDS CLARIFICATION] items from spec.md]
```

## Step 5: Generate ROADMAP.md

Check if `.shipyard/ROADMAP.md` already exists.

**If plan.md exists (and ROADMAP.md does not exist or user chose Replace):**

Follow **Model Routing Protocol** (select the correct model for each agent role using `model_routing` from config; see `docs/PROTOCOLS.md`) -- read `model_routing` from config for architect model selection.

Dispatch an **architect agent** (subagent_type: `"shipyard:architect"`) with:
- The full content of `<feature-path>/plan.md`
- The just-written `.shipyard/PROJECT.md`
- Instruction: "Generate `.shipyard/ROADMAP.md` from this spec-kit implementation plan. Decompose the plan into logical phases (1-3 phases typical). Each phase should represent a coherent milestone. Do not break into tasks — only phases with titles and descriptions."

Present the roadmap to the user for approval. Allow up to **2 revision cycles**. After approval, finalize.

**If plan.md does not exist:**
Offer to dispatch the architect with PROJECT.md alone (same as `/shipyard:brainstorm` step 5). Ask: "No plan.md found. Generate a roadmap from the project definition alone?"
- `Yes` — dispatch architect with PROJECT.md
- `Not now` — skip; user can run `/shipyard:plan` later which will generate ROADMAP.md

**If ROADMAP.md already exists:**
Ask: "ROADMAP.md already exists. Replace it using plan.md?" (Yes / Keep existing)

## Step 6: Stage Research Artifacts

Create the phase 1 directory and stage spec-kit research artifacts:

```bash
mkdir -p .shipyard/phases/1
```

**If `research.md` exists:**
Copy it as the base:
```bash
cp <feature-path>/research.md .shipyard/phases/1/RESEARCH.md
```

**If `data-model.md` exists:**
Append to RESEARCH.md with a section header:
```markdown

---
## Data Model (from spec-kit)
[contents of data-model.md]
```

**If `contracts/` directory exists:**
List its files and append a summary section to RESEARCH.md:
```markdown

---
## API Contracts (from spec-kit)
[brief summary of each contract file found, with the file path]
```

**If none of research.md, data-model.md, or contracts/ exist:** skip this step.

**If `tasks.md` exists:**
Write a note file at `.shipyard/phases/1/SPECKIT-TASKS.md` with:
```markdown
# spec-kit Tasks (seed input for architect)

> These tasks were generated by `/speckit.tasks` and are available as input when running `/shipyard:plan 1`.
> The architect agent will use these to seed task decomposition into Shipyard's wave/plan format.

[full contents of tasks.md]
```

</execution>

<output>

## Step 7: Commit & Update State

Create a git commit:
```bash
git add .shipyard/PROJECT.md
# Stage ROADMAP.md if created:
git add .shipyard/ROADMAP.md 2>/dev/null || true
# Stage phase research if created:
git add .shipyard/phases/ 2>/dev/null || true
git commit -m "shipyard: import spec-kit spec from <feature-path>"
```

Follow **State Update Protocol** (update `.shipyard/STATE.json` and `.shipyard/HISTORY.md` via state-write.sh; see `docs/PROTOCOLS.md`) -- update state:
- **Phase:** 1
- **Position:** Project definition imported from spec-kit, ready for planning
- **Status:** ready

## Step 8: Route Forward

Display next step based on what was created:

**If ROADMAP.md was created:**
> Import complete! Your next step:
>
> **Run `/shipyard:plan 1`** — Your project definition and roadmap are ready. Shipyard will use the staged research artifacts and spec-kit tasks to accelerate phase 1 planning.

**If ROADMAP.md was NOT created:**
> Import complete! Your next step:
>
> **Run `/shipyard:plan`** — This will generate a roadmap from your project definition, then plan the first phase. Staged research artifacts will be used automatically.

**Always append this tip if tasks.md was staged:**
> **Tip:** spec-kit tasks have been staged at `.shipyard/phases/1/SPECKIT-TASKS.md` — the architect will use these as a seed when you run `/shipyard:plan 1`, so you'll get accurate task decomposition with less hallucination.

</output>
