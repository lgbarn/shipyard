---
phase: token-optimization
plan: "2.1"
wave: 2
dependencies: ["1.1", "1.2"]
must_haves:
  - Duplicated instruction blocks consolidated (at least 3 instances removed)
  - Shared protocols extracted to a single reference file
  - Commands and agents reference protocols instead of duplicating content
files_touched:
  - docs/PROTOCOLS.md (new)
  - commands/build.md
  - commands/plan.md
  - commands/init.md
  - commands/status.md
  - commands/resume.md
  - commands/quick.md
  - agents/builder.md
  - agents/reviewer.md
tdd: false
---

# Plan 2.1: Extract Shared Protocols and Deduplicate Commands/Agents

## Context

The research phase identified 15+ instances of duplicated instruction blocks across 11 command and agent files. Four major patterns repeat frequently: state loading, model routing configuration, checkpoint creation, and worktree awareness. Extracting these into a `docs/PROTOCOLS.md` reference file creates a single source of truth, reduces per-file size, and makes future maintenance easier. Commands and agents will reference protocols by name with a parenthetical description so they remain understandable without requiring PROTOCOLS.md to be loaded.

This plan depends on Wave 1 being complete because it needs to confirm the final structure of `state-read.sh` (Plan 1.1) before consolidating references to it across commands.

## Dependencies

Plans 1.1 and 1.2 (Wave 1).

## Tasks

### Task 1: Create docs/PROTOCOLS.md with extracted protocol modules
**Files:** `docs/PROTOCOLS.md` (new)
**Action:** create
**Description:**
Create `docs/PROTOCOLS.md` in the plugin root containing these protocol modules, each as a self-contained section:

1. **State Loading Protocol** (~25 lines): How to read STATE.md, ROADMAP.md, PROJECT.md, and config.json. Extract from the common pattern in `commands/status.md` (lines 22-28), `commands/resume.md` (lines 22-27), `commands/plan.md` (lines 20-23), `commands/build.md` (lines 33-36).

2. **Model Routing Protocol** (~35 lines): Full `config.json` model routing structure with all agent role mappings and defaults. Extract from `commands/init.md` (lines 90-125), `commands/plan.md` (lines 25-31), `commands/build.md` (lines 22-29).

3. **Checkpoint Protocol** (~15 lines): How to create checkpoints with naming convention (`pre-build-phase-N`, `post-plan-phase-N`, `post-build-phase-N`). Extract from `commands/plan.md` (lines 141-147), `commands/build.md` (lines 47-53, 267-273).

4. **Worktree Protocol** (~20 lines): How to detect worktree status, record working directory and branch, handle file paths. Extract from `commands/build.md` (lines 17-20, 66-72), `commands/quick.md` (lines 41-46), `agents/builder.md` (lines 91-102).

5. **Issue Tracking Protocol** (~15 lines): How to append to ISSUES.md, auto-increment IDs, set severity and source. Extract from `agents/reviewer.md` (lines 86-94).

6. **Commit Convention** (~15 lines): Conventional commit format including IaC prefixes. Extract from `agents/builder.md` (lines 43-50, 83-89).

Each module should have a clear `## Protocol Name` header, a 1-line purpose statement, and the consolidated content.

**Acceptance Criteria:**
- `docs/PROTOCOLS.md` exists with all 6 protocol sections
- Total file is under 175 lines
- Each protocol is self-contained and clearly titled
- No protocol references another protocol

### Task 2: Replace duplicated blocks in commands with protocol references
**Files:** `commands/build.md`, `commands/plan.md`, `commands/init.md`, `commands/status.md`, `commands/resume.md`, `commands/quick.md`
**Action:** modify
**Description:**
For each command file, replace duplicated instruction blocks with concise protocol references. Each reference should follow this format:
```
Follow **[Protocol Name]** (see `docs/PROTOCOLS.md`) -- [one-line description of what it does].
```

Specific replacements:

**`commands/build.md`:**
- Lines 18-21 (worktree detection) -> "Follow **Worktree Protocol** (see `docs/PROTOCOLS.md`) -- detect worktree, record working directory and branch."
- Lines 22-29 (model routing) -> "Follow **Model Routing Protocol** (see `docs/PROTOCOLS.md`) -- read `model_routing` from config for agent model selection."
- Lines 49-53 (pre-build checkpoint) -> "Follow **Checkpoint Protocol** (see `docs/PROTOCOLS.md`) -- create `pre-build-phase-{N}` checkpoint."
- Lines 267-273 (post-build checkpoint) -> "Follow **Checkpoint Protocol** (see `docs/PROTOCOLS.md`) -- create `post-build-phase-{N}` checkpoint."

**`commands/plan.md`:**
- Lines 25-32 (model routing) -> Model Routing Protocol reference
- Lines 141-147 (post-plan checkpoint) -> Checkpoint Protocol reference

**`commands/init.md`:**
- Lines 90-125 (full config structure) -> Model Routing Protocol reference + keep only the non-routing config fields inline (since init is where the config is *created*, keep the config structure but replace the model_routing details with a protocol reference)

**`commands/quick.md`:**
- Lines 42-46 (worktree detection) -> Worktree Protocol reference

**`commands/resume.md`:**
- Lines 22-27 (state reading) -> State Loading Protocol reference

**`commands/status.md`:**
- Lines 22-28 (state reading) -> State Loading Protocol reference

**Acceptance Criteria:**
- At least 6 duplicated blocks replaced across command files
- Each replacement includes the protocol name, file reference, and a brief inline description
- No command file lost any net functionality (the behavior is described in the protocol)

### Task 3: Replace duplicated blocks in agents with protocol references
**Files:** `agents/builder.md`, `agents/reviewer.md`
**Action:** modify
**Description:**
Replace duplicated instruction blocks in agent files:

**`agents/builder.md`:**
- Lines 43-50 (commit convention) -> "Follow **Commit Convention** (see `docs/PROTOCOLS.md`)."
- Lines 83-89 (IaC commit convention) -> "For IaC changes, follow **Commit Convention** IaC section (see `docs/PROTOCOLS.md`)."
- Lines 91-102 (worktree awareness) -> "Follow **Worktree Protocol** (see `docs/PROTOCOLS.md`)."

**`agents/reviewer.md`:**
- Lines 86-94 (issue tracking) -> "Follow **Issue Tracking Protocol** (see `docs/PROTOCOLS.md`) for non-blocking findings."

Count total deduplication instances removed to confirm >= 3 (the success criterion). The target from research is 10+ instances, but at minimum 3 distinct pattern types must be consolidated.

**Acceptance Criteria:**
- At least 3 duplicated blocks replaced in agent files
- Total across Tasks 2 and 3: at least 10 instances of deduplication
- `agents/builder.md` no longer contains the full commit convention table inline
- `agents/reviewer.md` no longer contains the full issue tracking procedure inline

## Verification

```bash
# 1. PROTOCOLS.md exists and has all sections
for protocol in "State Loading Protocol" "Model Routing Protocol" "Checkpoint Protocol" "Worktree Protocol" "Issue Tracking Protocol" "Commit Convention"; do
  grep -q "$protocol" docs/PROTOCOLS.md || echo "MISSING: $protocol"
done
# Expected: no output

# 2. PROTOCOLS.md line count
wc -l docs/PROTOCOLS.md
# Expected: < 175

# 3. Protocol references exist in commands
grep -c "PROTOCOLS.md" commands/build.md
# Expected: >= 3

grep -c "PROTOCOLS.md" commands/plan.md
# Expected: >= 2

# 4. Protocol references exist in agents
grep -c "PROTOCOLS.md" agents/builder.md
# Expected: >= 2

# 5. Deduplication count -- count total protocol references across all files
grep -rl "PROTOCOLS.md" commands/ agents/ | wc -l
# Expected: >= 6 files reference PROTOCOLS.md
```
