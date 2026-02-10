---
description: "View or update Shipyard workflow settings"
disable-model-invocation: true
argument-hint: "[action] — list, or a key name to view/set (default: interactive)"
---

# /shipyard:settings - Workflow Settings

You are executing the Shipyard settings workflow. Follow these steps precisely.

<prerequisites>

## Step 1: Check State Exists

Verify `.shipyard/config.json` exists. If not, tell the user:
> "No Shipyard project found. Run `/shipyard:init` first to create a project and configure settings."

Then stop.

## Step 2: Read Current Settings

Read `.shipyard/config.json` and parse all fields.

## Step 3: Determine Mode

Check if the user provided arguments:

- **No arguments** — proceed to Step 4 (interactive mode).
- **`list`** — proceed to Step 5 (display all settings).
- **A single key name** (e.g., `security_audit`, `model_routing.building`) — proceed to Step 6 (display one setting).
- **A key name followed by a value** (e.g., `security_audit false`, `context_tier minimal`) — proceed to Step 7 (set one setting).

</prerequisites>

<execution>

## Step 4: Interactive Mode

Display current settings as a readable summary:

```
Shipyard Settings (.shipyard/config.json)

Workflow:
  Interaction mode:  {interaction_mode}
  Git strategy:      {git_strategy}
  Review depth:      {review_depth}

Quality Gates:
  Security audit:         {security_audit}
  Simplification review:  {simplification_review}
  IaC validation:         {iac_validation}
  Documentation:          {documentation_generation}

Model Routing:
  Architecture:    {model_routing.architecture}
  Building:        {model_routing.building}
  Review:          {model_routing.review}
  Planning:        {model_routing.planning}
  Validation:      {model_routing.validation}
  Security audit:  {model_routing.security_audit}
  Simplification:  {model_routing.simplification}
  Documentation:   {model_routing.documentation}
  Mapping:         {model_routing.mapping}
  Debugging:       {model_routing.debugging}

Context:
  Context tier:        {context_tier}
  Codebase docs path:  {codebase_docs_path}
```

Then use `AskUserQuestion` to ask: "Which settings category would you like to change?"
- `Workflow` — Interaction mode, git strategy, review depth
- `Quality gates` — Security audit, simplification, IaC validation, documentation
- `Model routing` — Model assignments per agent role
- `Context` — Context tier and codebase docs path

Based on the user's choice, present the relevant questions using `AskUserQuestion`:

### If Workflow:

Use `AskUserQuestion` with 3 questions (show current value in each question text):

1. **Interaction style** (currently: {interaction_mode}) — "Do you prefer interactive mode or autonomous mode?"
   - `Interactive` — Approve each phase before execution.
   - `Autonomous` — Execute full roadmap with checkpoints.
   - `Keep current` — No change.

2. **Git tracking** (currently: {git_strategy}) — "How should Shipyard create commits?"
   - `Per task` — Atomic commit after each completed task.
   - `Per phase` — Batch all task changes into one commit per phase.
   - `Manual` — Shipyard won't commit.
   - `Keep current` — No change.

3. **Review depth** (currently: {review_depth}) — "How thorough should review gates be?"
   - `Detailed` — Two-stage review between build steps.
   - `Lightweight` — Quick verification only.
   - `Keep current` — No change.

### If Quality gates:

Use `AskUserQuestion` with 4 questions (show current value in each question text):

1. **Security auditing** (currently: {security_audit}) — "Run security audit after each phase?"
   - `Yes` — OWASP checks, secrets detection, dependency vulnerabilities.
   - `No` — Skip. Use `/shipyard:audit` manually.
   - `Keep current` — No change.

2. **Code simplification** (currently: {simplification_review}) — "Check for duplication and complexity?"
   - `Yes` — Detect AI-generated bloat and dead code.
   - `No` — Skip. Use `/shipyard:simplify` manually.
   - `Keep current` — No change.

3. **IaC validation** (currently: {iac_validation}) — "Validate infrastructure-as-code files?"
   - `Auto` — Only when IaC files are detected.
   - `Always` — Every phase regardless.
   - `Never` — Skip entirely.
   - `Keep current` — No change.

4. **Documentation** (currently: {documentation_generation}) — "Generate docs after each phase?"
   - `Yes` — Auto-generate and update documentation.
   - `No` — Skip. Use `/shipyard:document` manually.
   - `Keep current` — No change.

### If Model routing:

Use `AskUserQuestion` with 1 question:

1. **Routing strategy** — "Which model routing strategy?"
   - `Default routing` — Haiku for validation, Sonnet for most roles, Opus for architecture/debugging.
   - `All Sonnet` — Sonnet for everything.
   - `All Opus` — Opus for everything.
   - `Custom` — Set individual agent models (will ask follow-up questions).

If the user chooses `Custom`, use `AskUserQuestion` to ask about each agent role in batches of 4:

**Batch A** (4 questions): architecture, building, review, planning — each with options: haiku, sonnet, opus, keep current.

**Batch B** (4 questions): validation, security_audit, simplification, documentation — each with options: haiku, sonnet, opus, keep current.

**Batch C** (2 questions): mapping, debugging — each with options: haiku, sonnet, opus, keep current.

### If Context:

Use `AskUserQuestion` with 2 questions (show current value in each question text):

1. **Context tier** (currently: {context_tier}) — "How much context to load at session start?"
   - `Auto` — Adjust based on current state.
   - `Minimal` — Fastest startup, less awareness.
   - `Full` — Load everything including codebase docs.
   - `Keep current` — No change.

2. **Codebase docs path** (currently: {codebase_docs_path}) — "Where should codebase docs be stored?"
   - `.shipyard/codebase` — Private, gitignored.
   - `docs/codebase` — Committed to git, visible to collaborators.
   - `Keep current` — No change.

After collecting answers, update `.shipyard/config.json` — merge the changed fields into the existing config, preserving all unchanged fields. Skip any "Keep current" answers.

Proceed to Step 8.

## Step 5: Display All Settings

Display the same formatted summary as Step 4, then stop.

## Step 6: Display One Setting

Look up the key in `.shipyard/config.json`. Support dot-notation for nested keys (e.g., `model_routing.building`).

- If the key exists, display: `{key}: {value}`
- If the key does not exist, display: `Unknown setting: {key}. Run /shipyard:settings list to see all available settings.`

Then stop.

## Step 7: Set One Setting

Validate the key and value:

**Valid keys and their allowed values:**
| Key | Allowed Values |
|---|---|
| `interaction_mode` | `interactive`, `autonomous` |
| `git_strategy` | `per_task`, `per_phase`, `manual` |
| `review_depth` | `detailed`, `lightweight` |
| `security_audit` | `true`, `false` |
| `simplification_review` | `true`, `false` |
| `iac_validation` | `auto`, `true`, `false` |
| `documentation_generation` | `true`, `false` |
| `context_tier` | `auto`, `minimal`, `planning`, `execution`, `brownfield`, `full` |
| `codebase_docs_path` | `.shipyard/codebase`, `docs/codebase` |
| `model_routing.validation` | `haiku`, `sonnet`, `opus` |
| `model_routing.building` | `haiku`, `sonnet`, `opus` |
| `model_routing.planning` | `haiku`, `sonnet`, `opus` |
| `model_routing.architecture` | `haiku`, `sonnet`, `opus` |
| `model_routing.debugging` | `haiku`, `sonnet`, `opus` |
| `model_routing.review` | `haiku`, `sonnet`, `opus` |
| `model_routing.security_audit` | `haiku`, `sonnet`, `opus` |
| `model_routing.simplification` | `haiku`, `sonnet`, `opus` |
| `model_routing.documentation` | `haiku`, `sonnet`, `opus` |
| `model_routing.mapping` | `haiku`, `sonnet`, `opus` |

- If the key is unknown: `Unknown setting: {key}. Run /shipyard:settings list to see all available settings.` Then stop.
- If the value is invalid for the key: `Invalid value "{value}" for {key}. Allowed: {allowed_values}.` Then stop.

Read `.shipyard/config.json`, update the specified field (for dot-notation keys, update the nested object), and write back. For boolean fields (`security_audit`, `simplification_review`, `documentation_generation`), convert string `"true"`/`"false"` to JSON booleans.

Proceed to Step 8.

</execution>

<output>

## Step 8: Commit & Confirm Changes

Commit the updated config:

```bash
git add .shipyard/config.json
git commit -m "shipyard: update settings"
```

Append a HISTORY.md entry: `- [<timestamp>] Settings updated: {list of changed keys}`

Display a summary of what changed:

```
Updated .shipyard/config.json:
  {key}: {old_value} -> {new_value}
  ...
```

If no changes were made (all "Keep current"), display: `No settings changed.` (skip commit and history entry)

</output>
