---
name: import-spec-file
description: Import a handwritten spec document into Shipyard, replacing brainstorming. Use when a freeform spec, requirements, or design document exists.
argument-hint: "[file-path] — path to a spec document (e.g. docs/my-spec.md or /abs/path/spec.md)"
---

# /shipyard:import-spec-file - Import Handwritten Spec Document

You are executing the Shipyard spec-file import workflow. This is the path for handwritten, freeform, or pre-existing specification documents — use this instead of `/shipyard:brainstorm` when a spec already exists in a non-spec-kit format. Follow these steps precisely.

<prerequisites>

## Step 1: Parse Argument

- If an argument is provided, treat it as the spec file path. Resolve relative paths from the project root (cwd). Absolute paths are used as-is.
- If no argument is provided, check for common spec file patterns in the project root and one level deep:
  - Files matching `*spec*.md`, `*SPEC*.md`, `*requirements*.md`, `*design*.md`
  - If exactly one match: offer to use it. Ask: "Found `<path>`. Use this as the spec?"
  - If multiple matches: use `AskUserQuestion` to present the matches and ask the user to select one.
  - If no matches: tell the user: "No spec file found. Provide the path as an argument: `/shipyard:import-spec-file path/to/spec.md`" and stop.

## Step 2: Validate Prerequisites

1. Verify `.shipyard/` directory exists. If not, tell the user to run `/shipyard:init` first, then stop.
2. Verify the spec file exists and is readable. If not, tell the user: "Spec file not found: `<path>`" and stop.
3. Note the spec file's filename, directory, and size (line count) for use in later steps.

## Step 3: Check Existing PROJECT.md

If `.shipyard/PROJECT.md` already exists, use `AskUserQuestion` to ask:
> "A project definition already exists in `.shipyard/PROJECT.md`. What would you like to do?"
- `Replace with spec import (Recommended)` — overwrite PROJECT.md with content derived from the spec
- `Merge — update requirements section only` — keep existing PROJECT.md but replace the Requirements section with content from the spec
- `Cancel` — stop

</prerequisites>

<execution>

## Step 4: Read, Analyze, and Interview

Read the full spec file. Then analyze its structure to identify the following sections (the document may use any section names — use judgment to identify the semantic equivalent):

| PROJECT.md section | Look for in the spec |
|---|---|
| **Project Name** | Document title (first `#` heading), filename, or explicit name field |
| **Description** | Overview, Introduction, Summary, Purpose, Background, Scope sections |
| **Goals** | Goals, Objectives, Features, Intended behavior summary, What this covers |
| **Non-Goals** | Non-Goals, Out-of-Scope, Exclusions, What this does not cover |
| **Requirements (Functional)** | Requirements, Rules, Validation rules, Behavior specification, Protocol, Acceptance criteria |
| **Non-Functional Requirements** | Performance, Security, Scale, Reliability, Compliance, Non-functional constraints |
| **Success Criteria** | Test scenarios, Acceptance tests, Examples, Verification cases |
| **Constraints** | Assumptions, Constraints, Limitations, Dependencies, Technology choices, Deviations |
| **Open Questions** | Open questions, TBD, TODO, Unresolved items, `[NEEDS CLARIFICATION]` markers, flagged gaps |

**Mapping rules:**

- **Project Name**: use the first `#` heading; if absent, derive from the filename (e.g., `amver-validation-spec.md` -> `AMVER Validation`)
- **Description**: synthesize 1-2 paragraphs from the spec's overview/purpose prose; do not copy verbatim — write a summary that orients a new engineer
- **Goals**: each top-level capability or major section of behavior becomes a numbered goal; for rule-set specs, goals are the major categories of validation (e.g., "Structural validation", "Content validation", "Wire format handling")
- **Non-Goals**: extract explicit exclusions; if none present, write "Not explicitly defined in spec"
- **Requirements (Functional)**: for each major section or rule category in the spec, create a `### [Section Name]` subsection with bullet points derived from the rules. For rule-set specs with identifiers (e.g., VR-WF-1, VR-STR-4), group by category and summarize each rule as a requirement bullet. Do NOT copy rules verbatim — write them as requirement statements.
- **Non-Functional Requirements**: extract security notes, performance constraints, encoding requirements, compliance notes
- **Success Criteria**: derive from test scenarios, example inputs/outputs, or scenario tables in the spec. If no explicit test cases exist, write: "To be defined — see spec scenarios in RESEARCH.md"
- **Constraints**: extract all explicit assumptions, technology choices (e.g., "Rust regex crate"), deviations from prior behavior, and encoding requirements. Each becomes a constraint bullet.
- **Open Questions**: extract every item the spec marks as unresolved, flagged, or requiring confirmation. Include section references.

**After analyzing the spec, conduct a gap-filling interview before writing PROJECT.md.**

Identify which of the following are missing, ambiguous, or incomplete in the spec:
- Goals / intended scope
- Non-Goals (what is explicitly excluded)
- Success criteria or acceptance tests
- Non-functional requirements (performance, security, scale)
- Deployment or integration context (what system uses this? what calls it?)
- Known deviations from prior behavior or existing implementation

For each gap found, ask the user directly. Keep questions focused — one topic per question. Do not ask about things the spec already covers clearly. Aim for 2-5 questions total; stop when you have enough to write a complete PROJECT.md.

Invoke the `shipyard:shipyard-brainstorming` skill to guide this dialogue. Frame questions around the spec content — e.g., "The spec defines validation rules but doesn't describe where this library gets called from. Is it embedded in the report-service, or is it a standalone library?"

Continue until the user confirms they are satisfied or there are no remaining gaps.

**Handle open questions**: If the spec contains unresolved items (open questions section, TBD markers, `[NEEDS CLARIFICATION]` tags, or explicit "requires verification" language), surface these during the interview and let the user clarify or acknowledge them as open. Count remaining unresolved items after the interview for the Open Questions section.

**Write `.shipyard/PROJECT.md`** using this structure:
```markdown
# [Project Name]

> Imported from: `[spec file path]` on [date]

## Description
[1-2 paragraphs]

## Goals
1. [Major goal / capability]
2. [Major goal / capability]
...

## Non-Goals
- [explicit exclusions or "Not explicitly defined in spec"]

## Requirements

### [Major Section / Category Name]
- [requirement derived from spec rule or behavior]
- [requirement derived from spec rule or behavior]

### [Next Category]
...

## Non-Functional Requirements
- [security, performance, encoding, compliance constraints]

## Success Criteria
- [from test scenarios or derived verification statements]

## Constraints
- [from assumptions, technology choices, deviations, encoding requirements]

## Open Questions
- [unresolved spec items with section references]
```

## Step 5: Stage the Spec as a Research Artifact

Create the phase 1 directory and copy the spec file as the primary research artifact:

```bash
mkdir -p .shipyard/phases/1
```

Copy the spec file to `.shipyard/phases/1/RESEARCH.md`:
```bash
cp <spec-file-path> .shipyard/phases/1/RESEARCH.md
```

If the spec file is very large (>500 lines), prepend a navigation header to RESEARCH.md:
```markdown
# Research: [Project Name]

> Source: `[original spec file path]`
> This document is the full specification imported via `/shipyard:import-spec-file`.
> See `.shipyard/PROJECT.md` for the synthesized project definition.

---

[original spec contents follow]
```

## Step 6: Generate ROADMAP.md

Check if `.shipyard/ROADMAP.md` already exists.

**If ROADMAP.md does not exist (or user chose Replace in Step 3):**

Follow **Model Routing Protocol** (select the correct model for each agent role using `model_routing` from config; see `docs/PROTOCOLS.md`) — read `model_routing` from config for architect model selection.

Use `AskUserQuestion` to ask: "Generate a roadmap from this spec?"
- `Yes (Recommended)` — Dispatch an **architect agent** (subagent_type: `"shipyard:architect"`) with context per **Agent Context Protocol** (pass PROJECT.md, config.json, working directory, branch, and worktree status to all agents; see `docs/PROTOCOLS.md`) with:
  - The full content of the just-written `.shipyard/PROJECT.md`
  - Instruction: "Generate `.shipyard/ROADMAP.md` from this project definition. This is a spec-driven implementation task. Decompose into logical phases (1-3 typical). Each phase should represent a coherent milestone. Do not break into tasks — only phases with titles and descriptions."

  Present the roadmap for approval. Allow up to **2 revision cycles**. After approval, finalize.
- `Not now` — skip; user can run `/shipyard:plan` later which will generate ROADMAP.md

**If ROADMAP.md already exists:**
Ask: "ROADMAP.md already exists. Regenerate it from the imported spec?" (Yes / Keep existing)

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
git commit -m "shipyard: import spec from <spec-filename>"
```

Follow **State Update Protocol** (update `.shipyard/STATE.json` and `.shipyard/HISTORY.md` via state-write.sh; see `docs/PROTOCOLS.md`) -- update state:
- **Phase:** 1
- **Position:** Project definition imported from handwritten spec, ready for planning
- **Status:** ready

## Step 8: Route Forward

Display next step based on project state:

Check whether `.shipyard/ROADMAP.md` exists and whether codebase analysis docs exist (in configured `codebase_docs_path`).

**If no codebase docs AND the project has existing source code:**
> Import complete! Your next step:
>
> **Run `/shipyard:map`** — Analyze your existing codebase so Shipyard understands the stack, architecture, and conventions before planning. This makes plans much more accurate. The staged spec will be available as research context after mapping.

**If ROADMAP.md was created (and codebase is mapped or greenfield):**
> Import complete! Your next step:
>
> **Run `/shipyard:plan 1`** — Your project definition and roadmap are ready. Phase 1 planning will use the staged spec as research context, giving the architect full access to the original spec during task decomposition.

**If ROADMAP.md was NOT created (and codebase is mapped or greenfield):**
> Import complete! Your next step:
>
> **Run `/shipyard:plan`** — This will generate a roadmap from your project definition, then plan the first phase. The staged spec will be used as research context automatically.

**Always append:**
> **Tip:** The original spec has been staged at `.shipyard/phases/1/RESEARCH.md` — all architect and builder agents will have access to the full spec during planning and implementation.

**If open questions were found:**
> **Note:** N open question(s) are recorded in `PROJECT.md`. Resolve these before or during Phase 1 to avoid implementation ambiguity.

</output>
