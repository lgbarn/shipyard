---
description: "Initialize Shipyard for a new project or onboard to an existing codebase"
disable-model-invocation: true
argument-hint: ""
---

# /shipyard:init - Project Initialization

You are executing the Shipyard initialization workflow. Follow these steps precisely and in order.

<prerequisites>

## Step 1: Check Existing State

Check if a `.shipyard/` directory already exists in the current project root.

- **If it exists:** Ask the user whether they want to:
  - Create a new milestone within the existing project
  - Refresh the codebase analysis
  - Start fresh (requires explicit confirmation -- this will archive the current state)
  If they choose a new milestone, skip to Step 5 (brainstorming). If refresh, repeat Step 4 only.
- **If it does not exist:** Create the `.shipyard/` directory and proceed.

## Step 2: Detect Project Type

Determine whether this is a **brownfield** (existing source code) or **greenfield** (empty/new project).

- Look for source files, package manifests, configuration files, etc.
- If brownfield, proceed to Step 3.
- If greenfield, skip to Step 5.

## Step 3: Codebase Docs Location (Brownfield Only)

If this is a brownfield project (determined in Step 2), ask the user where to store codebase analysis documentation using AskUserQuestion:

> **Where should codebase analysis documentation be stored?**
>
> 1. **`.shipyard/codebase/`** -- Private, gitignored with the rest of `.shipyard/`
> 2. **`docs/codebase/`** -- Committed to git, visible to collaborators in the repository

Store the chosen path for use in Step 4 and Step 6:
- Option 1: `codebase_docs_path = ".shipyard/codebase"`
- Option 2: `codebase_docs_path = "docs/codebase"`

Create the target directory if it does not exist (`mkdir -p`).

</prerequisites>

<execution>

## Step 4: Codebase Mapping (Brownfield Only)

Dispatch **4 parallel mapper agents** using the Task tool to analyze the existing codebase. Each agent writes its findings to the configured codebase docs path (from Step 3).

Use `subagent_type: "shipyard:mapper"` for each. Pass the target output path to each agent.

**Agent 1 -- Technology Focus:**
- Analyze all package manifests, dependency files, and configuration
- Produce `{codebase_docs_path}/STACK.md` (languages, frameworks, versions, build tools)
- Produce `{codebase_docs_path}/INTEGRATIONS.md` (external services, APIs, databases)

**Agent 2 -- Architecture Focus:**
- Analyze project structure, entry points, module boundaries
- Produce `{codebase_docs_path}/ARCHITECTURE.md` (patterns, layers, data flow)
- Produce `{codebase_docs_path}/STRUCTURE.md` (directory layout with purpose annotations)

**Agent 3 -- Quality Focus:**
- Analyze code style, linting configs, test infrastructure
- Produce `{codebase_docs_path}/CONVENTIONS.md` (naming, formatting, patterns in use)
- Produce `{codebase_docs_path}/TESTING.md` (test framework, coverage, test patterns)

**Agent 4 -- Concerns Focus:**
- Identify technical debt, security concerns, performance issues
- Produce `{codebase_docs_path}/CONCERNS.md` (prioritized list with evidence)

Wait for all 4 agents to complete before proceeding.

## Step 5: Requirements Brainstorming

Invoke the `shipyard:shipyard-brainstorming` skill to conduct a Socratic dialogue with the user.

- Explore what they want to build or change
- Ask clarifying questions about scope, constraints, and priorities
- Identify non-functional requirements (performance, security, accessibility)
- Determine success criteria

When the user indicates they are satisfied with the requirements exploration, capture all decisions into `.shipyard/PROJECT.md` with these sections:
- **Project Name**
- **Description** (1-2 paragraphs)
- **Goals** (numbered list)
- **Non-Goals** (explicitly out of scope)
- **Requirements** (functional, grouped by area)
- **Non-Functional Requirements**
- **Success Criteria**
- **Constraints** (technical, timeline, budget)

## Step 6: Workflow Preferences

Ask the user about their preferred workflow using these questions:

1. **Interaction style:** "Do you prefer interactive mode (approve each phase) or autonomous mode (execute full roadmap with checkpoints)?"
2. **Git tracking:** "Should Shipyard create commits for each completed task, or batch commits per phase?"
3. **Review depth:** "Do you want detailed review gates between build steps, or lightweight verification?"

Also ask about quality gates:
4. **Security auditing:** "Should Shipyard run a security audit after each phase build? (Recommended for production projects)"
5. **Code simplification:** "Should Shipyard check for duplication and complexity after each phase? (Recommended for AI-heavy workflows)"
6. **IaC validation:** "Should Shipyard run infrastructure validation when Terraform/Ansible/Docker files are changed? (auto = detect IaC files automatically)"
7. **Documentation generation:** "Should Shipyard generate documentation after each phase build? (Recommended for all projects — helps maintain up-to-date docs)"

Also ask about model and context preferences:
8. **Model routing:** "Which model routing strategy should Shipyard use for its agents?"
   - **Default routing** (recommended): Haiku for validation, Sonnet for building/review/planning/auditing/simplification/documentation/mapping, Opus for architecture/debugging
   - **All Sonnet:** Use Sonnet for everything
   - **All Opus:** Use Opus for everything
9. **Context loading:** "How much context should Shipyard load at session start?"
   - **Auto** (recommended): Loads based on current state
   - **Minimal:** Always load minimal context
   - **Full:** Always load everything

Store preferences in `.shipyard/config.json`. Follow **Model Routing Protocol** (select the correct model for each agent role using `model_routing` from config; see `docs/PROTOCOLS.md`) for the full `config.json` structure, model routing keys, and defaults.

Non-routing fields: `interaction_mode`, `git_strategy`, `review_depth`, `security_audit`, `simplification_review`, `iac_validation`, `documentation_generation`, `codebase_docs_path`, `context_tier`, `created_at`, `version`.

**Defaults:** `security_audit: true`, `simplification_review: true`, `iac_validation: "auto"`, `documentation_generation: true`, `context_tier: "auto"`.

## Step 7: Roadmap Generation

Dispatch an **architect agent** (subagent_type: "shipyard:architect") with:
- The full PROJECT.md content
- The codebase analysis (if brownfield)
- User preferences from config.json

The architect agent must produce `.shipyard/ROADMAP.md` containing:
- **Milestone** name and description
- **Phases** (numbered, sequential): Each phase has a title, description, estimated complexity (S/M/L), and dependencies
- **Phases should be ordered** so that foundational work comes first
- Each phase should be completable in a single focused session
- Maximum 7 phases per milestone

Present the roadmap to the user for approval. Allow up to **3 revision cycles** where the user can request changes. After approval (or 3 rounds), finalize.

## Step 8: Task Scaffolding

Follow **Native Task Scaffolding Protocol** (create native tasks for each phase/plan to enable progress tracking via TaskCreate/TaskUpdate; see `docs/PROTOCOLS.md`) -- create a native task for each phase in the approved roadmap.

## Step 9: Initialize State

Follow **State Update Protocol** (update `.shipyard/STATE.json` and `.shipyard/HISTORY.md` via state-write.sh; see `docs/PROTOCOLS.md`) -- create `.shipyard/STATE.json` and `.shipyard/HISTORY.md` with:
- **Phase:** 1
- **Position:** Initialization complete, ready for planning
- **Status:** ready
- **Message:** `Project initialized`

</execution>

<output>

## Step 10: Commit

Create a git commit with the `.shipyard/` directory and, if `codebase_docs_path` is `docs/codebase`, also stage `docs/codebase/`:
```bash
git add .shipyard/
# If codebase docs are in docs/codebase/, also stage them (they are git-committed, not gitignored)
git add docs/codebase/  # only if codebase_docs_path = "docs/codebase"
git commit -m "shipyard: initialize project"
```

## Step 11: Route Forward

Display a summary of the roadmap phases and tell the user initialization is complete:
> "Project initialized! Run `/shipyard:plan 1` to begin planning Phase 1."

</output>
