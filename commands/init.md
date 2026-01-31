---
description: "Initialize Shipyard for a new project or onboard to an existing codebase"
disable-model-invocation: true
argument-hint: ""
---

# /shipyard:init - Project Initialization

You are executing the Shipyard initialization workflow. Follow these steps precisely and in order.

## Step 1: Check Existing State

Check if a `.shipyard/` directory already exists in the current project root.

- **If it exists:** Ask the user whether they want to:
  - Create a new milestone within the existing project
  - Refresh the codebase analysis
  - Start fresh (requires explicit confirmation -- this will archive the current state)
  If they choose a new milestone, skip to Step 4 (brainstorming). If refresh, repeat Step 3 only.
- **If it does not exist:** Create the `.shipyard/` directory and proceed.

## Step 2: Detect Project Type

Determine whether this is a **brownfield** (existing source code) or **greenfield** (empty/new project).

- Look for source files, package manifests, configuration files, etc.
- If brownfield, proceed to Step 3.
- If greenfield, skip to Step 4.

## Step 3: Codebase Mapping (Brownfield Only)

Dispatch **4 parallel mapper agents** using the Task tool to analyze the existing codebase. Each agent writes its findings to `.shipyard/codebase/`.

Use `subagent_type: "shipyard:mapper"` for each.

**Agent 1 -- Technology Focus:**
- Analyze all package manifests, dependency files, and configuration
- Produce `.shipyard/codebase/STACK.md` (languages, frameworks, versions, build tools)
- Produce `.shipyard/codebase/INTEGRATIONS.md` (external services, APIs, databases)

**Agent 2 -- Architecture Focus:**
- Analyze project structure, entry points, module boundaries
- Produce `.shipyard/codebase/ARCHITECTURE.md` (patterns, layers, data flow)
- Produce `.shipyard/codebase/STRUCTURE.md` (directory layout with purpose annotations)

**Agent 3 -- Quality Focus:**
- Analyze code style, linting configs, test infrastructure
- Produce `.shipyard/codebase/CONVENTIONS.md` (naming, formatting, patterns in use)
- Produce `.shipyard/codebase/TESTING.md` (test framework, coverage, test patterns)

**Agent 4 -- Concerns Focus:**
- Identify technical debt, security concerns, performance issues
- Produce `.shipyard/codebase/CONCERNS.md` (prioritized list with evidence)

Wait for all 4 agents to complete before proceeding.

## Step 4: Requirements Brainstorming

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

## Step 5: Workflow Preferences

Ask the user about their preferred workflow using these questions:

1. **Interaction style:** "Do you prefer interactive mode (approve each phase) or autonomous mode (execute full roadmap with checkpoints)?"
2. **Git tracking:** "Should Shipyard create commits for each completed task, or batch commits per phase?"
3. **Review depth:** "Do you want detailed review gates between build steps, or lightweight verification?"

Also ask about quality gates:
4. **Security auditing:** "Should Shipyard run a security audit after each phase build? (Recommended for production projects)"
5. **Code simplification:** "Should Shipyard check for duplication and complexity after each phase? (Recommended for AI-heavy workflows)"
6. **IaC validation:** "Should Shipyard run infrastructure validation when Terraform/Ansible/Docker files are changed? (auto = detect IaC files automatically)"
7. **Documentation generation:** "Should Shipyard generate documentation after each phase build? (Recommended for all projects — helps maintain up-to-date docs)"

Store preferences in `.shipyard/config.json`:
```json
{
  "interaction_mode": "interactive|autonomous",
  "git_strategy": "per_task|per_phase|manual",
  "review_depth": "detailed|lightweight",
  "security_audit": true,
  "simplification_review": true,
  "iac_validation": "auto|true|false",
  "documentation_generation": true,
  "created_at": "<timestamp>",
  "version": "1.1"
}
```

**Defaults:** `security_audit: true`, `simplification_review: true`, `iac_validation: "auto"`, `documentation_generation: true`. The `"auto"` setting for IaC detects IaC files and only runs validation when they're present.

## Step 6: Roadmap Generation

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

## Step 7: Task Scaffolding

For each phase in the approved roadmap, create a native task using TaskCreate:
- Title: "Phase {N}: {phase_title}"
- Description: Phase description from ROADMAP.md
- Status: not_started (except Phase 1 which should be next)

## Step 8: Initialize State

Create `.shipyard/STATE.md`:
```markdown
# Shipyard State

**Last Updated:** <timestamp>
**Current Phase:** 1
**Current Position:** Initialization complete, ready for planning
**Status:** ready

## History

- [<timestamp>] Project initialized
```

## Step 9: Commit

Create a git commit with the entire `.shipyard/` directory:
```
shipyard: initialize project
```

## Step 10: Route Forward

Tell the user initialization is complete and suggest:
> "Project initialized! Run `/shipyard:plan 1` to begin planning Phase 1."

Display a brief summary of the roadmap phases.
