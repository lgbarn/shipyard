---
description: "Initialize Shipyard project settings and directory structure"
disable-model-invocation: true
argument-hint: "[--fresh] — start over with a fresh .shipyard/ directory"
---

# /shipyard:init - Project Initialization

You are executing the Shipyard initialization workflow. Follow these steps precisely and in order.

<prerequisites>

## Step 1: Check Existing State

Check if a `.shipyard/` directory already exists in the current project root.

- **If it exists AND `.shipyard/config.json` exists:** Tell the user:
  > "Project already initialized. Use `/shipyard:settings` to update preferences or run `/shipyard:init --fresh` to start over."
  Then stop.

- **If `--fresh` flag is provided:** Require explicit confirmation from the user before proceeding. If confirmed, rename `.shipyard/` to `.shipyard-archive-{YYYY-MM-DD}/` and create a fresh `.shipyard/` directory. If not confirmed, stop.

- **If `.shipyard/` does not exist:** Create the `.shipyard/` directory and proceed to Step 2.

## Step 2: Lightweight Project Detection

Determine whether this is a **brownfield** (existing source code) or **greenfield** (empty/new project) by checking for source files and package manifests (e.g., `package.json`, `go.mod`, `Cargo.toml`, `requirements.txt`, `*.py`, `*.ts`, `*.go`, `*.rs`, etc.).

This is only used to tailor next-steps guidance in Step 5 — no codebase mapping or analysis is performed.

</prerequisites>

<execution>

## Step 3: Collect Settings

Collect workflow preferences from the user using three `AskUserQuestion` calls. Each call stays within the 4-question limit. Wait for the user's answers before proceeding to the next batch.

### Batch 1: Workflow Preferences

Use `AskUserQuestion` with these 3 questions:

1. **Interaction style** — "Do you prefer interactive mode or autonomous mode?"
   - `Interactive (Recommended)` — Approve each phase before execution. Safer for unfamiliar codebases.
   - `Autonomous` — Execute full roadmap with checkpoints. Faster for well-defined projects.

2. **Git tracking** — "How should Shipyard create commits?"
   - `Per task (Recommended)` — Atomic commit after each completed task. Easy to review and revert.
   - `Per phase` — Batch all task changes into one commit per phase. Cleaner history.
   - `Manual` — Shipyard won't commit. You control all git operations.

3. **Review depth** — "How thorough should review gates be?"
   - `Detailed (Recommended)` — Two-stage review (spec compliance + code quality) between build steps.
   - `Lightweight` — Quick verification only. Faster but catches fewer issues.

### Batch 2: Quality Gates

Use `AskUserQuestion` with these 4 questions:

4. **Security auditing** — "Should Shipyard run a security audit after each phase build?"
   - `Yes (Recommended)` — OWASP checks, secrets detection, dependency vulnerabilities. Recommended for production projects.
   - `No` — Skip security auditing. You can still run `/shipyard:audit` manually.

5. **Code simplification** — "Should Shipyard check for duplication and complexity after each phase?"
   - `Yes (Recommended)` — Detects AI-generated bloat, dead code, and over-engineering. Recommended for AI-heavy workflows.
   - `No` — Skip simplification review. You can still run `/shipyard:simplify` manually.

6. **IaC validation** — "Should Shipyard validate infrastructure-as-code files (Terraform, Ansible, Docker)?"
   - `Auto (Recommended)` — Validate only when IaC files are detected in the changeset.
   - `Always` — Run IaC validation on every phase regardless.
   - `Never` — Skip IaC validation entirely.

7. **Documentation generation** — "Should Shipyard generate documentation after each phase build?"
   - `Yes (Recommended)` — Auto-generate and update docs after each phase. Keeps documentation current.
   - `No` — Skip documentation generation. You can still run `/shipyard:document` manually.

### Batch 3: Model & Context Preferences

Use `AskUserQuestion` with these 2 questions:

8. **Model routing** — "Which model routing strategy should Shipyard use for its agents?"
   - `Default routing (Recommended)` — Haiku for validation, Sonnet for building/review/planning/auditing/simplification/documentation/mapping, Opus for architecture/debugging. Balances cost and quality.
   - `All Sonnet` — Use Sonnet for everything. Good balance of speed and capability.
   - `All Opus` — Use Opus for everything. Maximum quality, highest cost.

9. **Context loading** — "How much project context should Shipyard load at session start?"
   - `Auto (Recommended)` — Adjusts based on current state (minimal when idle, full during execution).
   - `Minimal` — Always load minimal context. Fastest startup, less awareness.
   - `Full` — Always load everything including codebase docs. Slowest startup, maximum awareness.

## Step 4: Write Configuration & State

After collecting all answers, write the following files:

### config.json

Write `.shipyard/config.json` with the user's choices. Map answers to config keys:
- Batch 1: `interaction_mode` (`"interactive"` / `"autonomous"`), `git_strategy` (`"per_task"` / `"per_phase"` / `"manual"`), `review_depth` (`"detailed"` / `"lightweight"`)
- Batch 2: `security_audit` (`true` / `false`), `simplification_review` (`true` / `false`), `iac_validation` (`"auto"` / `true` / `false`), `documentation_generation` (`true` / `false`)
- Batch 3: `model_routing` (object — see **Model Routing Protocol** in `docs/PROTOCOLS.md` for the full key set and defaults per strategy), `context_tier` (`"auto"` / `"minimal"` / `"full"`)

Also include: `codebase_docs_path` (default `".shipyard/codebase"`), `created_at` (ISO timestamp), `version` (`"1.3"`).

Use defaults from `docs/PROTOCOLS.md` for any unanswered or skipped fields: `security_audit: true`, `simplification_review: true`, `iac_validation: "auto"`, `documentation_generation: true`, `context_tier: "auto"`.

### STATE.json & HISTORY.md

Follow **State Update Protocol** (update `.shipyard/STATE.json` and `.shipyard/HISTORY.md` via state-write.sh; see `docs/PROTOCOLS.md`) -- create initial state:
- **Phase:** 1
- **Position:** Initialization complete, ready for planning
- **Status:** ready
- **Message:** `Project initialized`

### Commit

```bash
git add .shipyard/
git commit -m "shipyard: initialize project"
```

</execution>

<output>

## Step 5: Guided Next Steps

Display contextual guidance based on brownfield/greenfield detection from Step 2:

**Brownfield (existing codebase):**
> Project initialized! Here's what to do next:
>
> - `/shipyard:map` — Analyze your existing codebase (recommended first step)
> - `/shipyard:brainstorm` — Explore requirements and capture project definition
> - `/shipyard:plan` — Plan a phase of work (creates roadmap if needed)
> - `/shipyard:quick` — Quick one-off task without full planning
>
> Use `/shipyard:settings` to change preferences later.

**Greenfield (new project):**
> Project initialized! Here's what to do next:
>
> - `/shipyard:brainstorm` — Explore requirements and capture project definition (recommended first step)
> - `/shipyard:plan` — Plan a phase of work (creates roadmap if needed)
> - `/shipyard:quick` — Quick one-off task without full planning
>
> Use `/shipyard:settings` to change preferences later.

</output>
