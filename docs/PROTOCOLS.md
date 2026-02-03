# Shipyard Protocols

Shared protocols referenced by commands and agents. Each protocol is self-contained.

## State Loading Protocol

Load project state files to establish context for the current session.

Read the following files (skip any that don't exist):
- `.shipyard/STATE.md` -- current phase, position, status, and history
- `.shipyard/ROADMAP.md` -- phases and progress
- `.shipyard/PROJECT.md` -- project overview and requirements
- `.shipyard/config.json` -- workflow preferences, model routing, gate settings
- Recent `SUMMARY.md` files from `.shipyard/phases/` -- decisions and results
- Any `VERIFICATION.md` files from `.shipyard/phases/` -- phase-level outcomes

Use STATE.md to determine the current phase and what was last completed. Use ROADMAP.md to understand the full scope. Use PROJECT.md for requirements context.

## Model Routing Protocol

Select the correct model for each agent role using `model_routing` from `.shipyard/config.json`.

**Role-to-key mapping:**
| Agent Role | Config Key | Default |
|---|---|---|
| Builder | `model_routing.building` | sonnet |
| Reviewer | `model_routing.review` | sonnet |
| Verifier | `model_routing.validation` | haiku |
| Auditor | `model_routing.security_audit` | sonnet |
| Simplifier | `model_routing.review` | sonnet |
| Documenter | `model_routing.review` | sonnet |
| Researcher | `model_routing.planning` | sonnet |
| Architect | `model_routing.architecture` | opus |

If `model_routing` is not present in config, use agent defaults.

**Full config.json structure** (used during `/shipyard:init`):
```json
{
  "interaction_mode": "interactive|autonomous",
  "git_strategy": "per_task|per_phase|manual",
  "review_depth": "detailed|lightweight",
  "security_audit": true,
  "simplification_review": true,
  "iac_validation": "auto|true|false",
  "documentation_generation": true,
  "codebase_docs_path": ".shipyard/codebase|docs/codebase",
  "model_routing": {
    "validation": "haiku",
    "building": "sonnet",
    "planning": "sonnet",
    "architecture": "opus",
    "debugging": "opus",
    "review": "sonnet",
    "security_audit": "sonnet"
  },
  "context_tier": "auto",
  "created_at": "<timestamp>",
  "version": "1.2"
}
```

**Defaults:** `security_audit: true`, `simplification_review: true`, `iac_validation: "auto"`, `documentation_generation: true`, `codebase_docs_path: ".shipyard/codebase"`. Model routing defaults to the table above. Context tier defaults to `"auto"`.

## Checkpoint Protocol

Create named checkpoints for rollback safety at key pipeline stages.

**Command:**
```bash
${CLAUDE_PLUGIN_ROOT}/scripts/checkpoint.sh "<label>"
```

**Standard checkpoint names:**
- `pre-build-phase-{N}` -- before build execution starts
- `post-plan-phase-{N}` -- after planning completes
- `post-build-phase-{N}` -- after build and verification complete

Create checkpoints at the pipeline stages specified by the command workflow. Each checkpoint is a lightweight git tag that enables rollback if a subsequent step fails.

## Worktree Protocol

Detect and record the git worktree context so agents operate on the correct paths and branch.

**Detection steps:**
1. Run `git worktree list` to identify if operating in a worktree
2. Record `$(pwd)` as the working directory
3. Record `$(git branch --show-current)` as the current branch

**If operating in a worktree:**
- All file operations should be relative to the worktree directory
- Git operations (commit, diff, status) operate on the worktree's branch
- The `.shipyard/` directory lives in the main working tree -- reference it via the path provided

**If operating in the main working tree:**
- Assume standard paths relative to the project root

Pass working directory, current branch, and worktree status to all dispatched agents.

## Issue Tracking Protocol

Append non-blocking findings to `.shipyard/ISSUES.md` so they persist across sessions.

When non-blocking issues are found (Important or Suggestion severity):
1. Check if `.shipyard/ISSUES.md` exists
2. Append findings as new rows to the Open Issues table
3. Auto-increment the ID from the highest existing ID
4. Set `source` to the agent role (e.g., "reviewer", "auditor")
5. Set severity: Important -> medium, Suggestion -> low
6. Set date to current timestamp

This ensures findings are tracked rather than lost between sessions.

## Codebase Docs Protocol

Resolve the configured codebase documentation path and load relevant files.

1. Read `codebase_docs_path` from `.shipyard/config.json`
   - If not specified, use default: `.shipyard/codebase`
2. Load files from that path (skip any that don't exist):
   - `CONVENTIONS.md` -- Code style and project conventions
   - `STACK.md` -- Technology stack information
   - `ARCHITECTURE.md` -- Project architecture
   - `CONCERNS.md` -- Known technical concerns
   - `TESTING.md` -- Test framework and patterns
   - `INTEGRATIONS.md` -- External services and APIs
   - `STRUCTURE.md` -- Directory layout with annotations
3. Pass loaded content to agents as context

The path is either `.shipyard/codebase/` (private, gitignored) or `docs/codebase/` (committed to git), based on user choice at init time.

## Agent Context Protocol

Standard context to pass when dispatching any agent via the Task tool.

**Essential context (pass to all agents):**
- `.shipyard/PROJECT.md` -- Project overview and requirements
- `.shipyard/config.json` -- Workflow preferences
- Working directory path (`$(pwd)`)
- Current git branch (`$(git branch --show-current)`)
- Worktree status (via **Worktree Protocol**)

**Conditional context (pass if exists and relevant):**
- `.shipyard/STATE.md` -- Current state and history
- Codebase docs (via **Codebase Docs Protocol**)
- Previous phase/plan results (SUMMARY.md, RESEARCH.md files)
- `.shipyard/ISSUES.md` -- Open issues
- `.shipyard/phases/{N}/CONTEXT-{N}.md` -- User decisions from discussion capture

**Agent-specific additions:**
- **Builder:** CONVENTIONS.md, results from previous waves, CONTEXT file
- **Reviewer:** Git diff of changed files, the plan being reviewed, CONTEXT file
- **Auditor:** All changed files, dependency manifests (package.json, Cargo.toml, etc.)
- **Documenter:** Existing docs in `docs/`, all SUMMARY.md files

## State Update Protocol

Update `.shipyard/STATE.md` to reflect current progress after each workflow step.

**Required fields to update:**
- `**Last Updated:** {current timestamp}`
- `**Current Phase:** {phase number, or "N/A" if between milestones}`
- `**Current Position:** {human-readable description}`
- `**Status:** {status value}`

**Append to History section:**
- `- [{timestamp}] {What action was just completed}`

**Canonical status values:**
- `ready` -- Initialized, ready to plan
- `planning` -- Currently planning a phase
- `planned` -- Phase planned, ready to build
- `building` -- Currently executing a phase
- `shipped` -- Delivery complete

Always commit STATE.md updates along with related artifacts.

## Native Task Scaffolding Protocol

Map Shipyard workflow stages to native tasks (TaskCreate/TaskUpdate) for progress tracking.

**At planning time (per phase):**
- Create one task per plan: "Phase {N} / Plan {W}.{P}: {plan_title}"
- Set status: `not_started`
- Set `blockedBy` for plans that depend on earlier waves

**At build time (per plan):**
- When builder completes: check SUMMARY.md status
  - `complete` → mark task as `completed`
  - `partial` or `failed` → keep task as `in_progress`
- When review has `CRITICAL_ISSUES` after retries → mark task as `blocked`

**At resume time:**
- Call TaskList to check for existing tasks
- If missing or stale, recreate from ROADMAP.md and artifact existence
- Set status based on whether SUMMARY.md exists and its content

**At init time (per phase):**
- Create one task per phase: "Phase {N}: {phase_title}"
- All start as `not_started` except Phase 1 (next)

## Discussion Capture Protocol

Capture user decisions and preferences for a phase before planning begins.

1. Read the target phase description from ROADMAP.md
2. Present the phase scope to the user
3. Identify gray areas: ambiguous requirements, design choices, approach decisions
4. Ask targeted questions one at a time (multiple choice preferred via AskUserQuestion)
5. Write decisions to `.shipyard/phases/{N}/CONTEXT-{N}.md`

**CONTEXT file format:**
```markdown
# Phase {N} Context: {phase title}

**Captured:** {timestamp}

## Decisions

### {Topic 1}
**Question:** {What was asked}
**Decision:** {What the user chose}
**Rationale:** {Why, if provided}

### {Topic 2}
...
```

**Skip conditions:**
- User passes `--no-discuss`
- CONTEXT-{N}.md already exists (ask user if they want to redo it)

All downstream agents (researcher, architect, builder, reviewer) should receive CONTEXT-{N}.md as input context when it exists.

## Commit Convention

Use conventional commits for all Shipyard work.

**Standard prefixes:**
- `feat(scope)`: New feature
- `fix(scope)`: Bug fix
- `refactor(scope)`: Code change that neither fixes a bug nor adds a feature
- `test(scope)`: Adding or updating tests
- `docs(scope)`: Documentation changes
- `chore(scope)`: Maintenance tasks

**IaC prefixes** (for infrastructure-as-code changes):
- `infra(terraform)`: Terraform changes
- `infra(ansible)`: Ansible changes
- `infra(docker)`: Docker/container changes
- `infra(ci)`: CI/CD pipeline changes
