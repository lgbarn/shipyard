---
description: "Execute plans using fresh subagents with review gates"
disable-model-invocation: true
argument-hint: "[phase-number] [--plan N] [--light]"
---

# /shipyard:build - Plan Execution

You are executing the Shipyard build workflow. Follow these steps precisely.

## Step 0: Parse Arguments

- If a phase number is provided, use it.
- If `--plan N` is provided, execute only that specific plan (format: W.P).
- If `--light` is provided, skip post-phase auditor and simplifier (Steps 4a and 4b). Use this during early iteration — the full pipeline runs at ship time regardless.
- If no phase number, read `.shipyard/STATE.md` for the current phase.
- Read `.shipyard/config.json` for gate preferences (`security_audit`, `simplification_review`, `iac_validation`, `documentation_generation`).
- Follow **Worktree Protocol** (see `docs/PROTOCOLS.md`) -- detect worktree, record working directory and branch.
- Follow **Model Routing Protocol** (see `docs/PROTOCOLS.md`) -- read `model_routing` from config for agent model selection.

## Step 1: Validate State

1. Verify `.shipyard/` exists. If not, tell the user to run `/shipyard:init` first.
2. Read `.shipyard/ROADMAP.md` and locate the target phase.
3. Read `.shipyard/STATE.md` for current context.
4. Load all plan files from `.shipyard/phases/{N}/plans/`.
5. Check which plans have already been completed (have SUMMARY.md files in `.shipyard/phases/{N}/results/`).
6. If all plans are complete, inform the user and suggest `/shipyard:ship` or next phase.

## Step 2: Update State

Update `.shipyard/STATE.md`:
- **Current Phase:** {N}
- **Current Position:** Building phase {N}
- **Status:** building

## Step 2a: Create Checkpoint

Follow **Checkpoint Protocol** (see `docs/PROTOCOLS.md`) -- create `pre-build-phase-{N}` checkpoint.

## Step 3: Execute by Wave

Group plans by wave number. Execute waves sequentially, plans within a wave in parallel.

### For each wave (sequential):

#### 3a. Launch Builders (parallel within wave)

For each incomplete plan in this wave, dispatch a **builder agent** (subagent_type: "shipyard:builder") with:
- The full plan content (PLAN-{W}.{P}.md)
- `.shipyard/STATE.md` for project context
- `.shipyard/PROJECT.md` for requirements context
- Codebase conventions from `.shipyard/codebase/CONVENTIONS.md` (if exists)
- Results from previous waves (SUMMARY.md files)
- Working directory: the current working directory path
- Current branch: the active git branch
- Worktree status: whether this is a worktree or main working tree

**Builder agent instructions:**
- Execute each task in the plan sequentially
- After each task, verify the acceptance criteria
- Create an atomic git commit for each completed task:
  ```
  shipyard(phase-{N}): {task description}
  ```
- If a task fails, document the failure and stop (do not proceed to next task)
- When complete, produce `.shipyard/phases/{N}/results/SUMMARY-{W}.{P}.md`:
  ```markdown
  # Build Summary: Plan {W}.{P}

  ## Status: {complete|partial|failed}

  ## Tasks Completed
  - Task 1: {title} - {status} - {files changed}
  - Task 2: {title} - {status} - {files changed}

  ## Files Modified
  - {file path}: {what changed}

  ## Decisions Made
  - {any implementation decisions and rationale}

  ## Issues Encountered
  - {any problems and how they were resolved}

  ## Verification Results
  - {results of running acceptance criteria checks}
  ```

#### 3b. Collect Results

Wait for all builders in the wave to complete. Read their SUMMARY.md files.

#### 3c. Review Gate

For each completed plan, dispatch a **reviewer agent** (subagent_type: "shipyard:reviewer") with the same working directory context (path, branch, worktree status), performing a **two-stage review**:

**Stage 1 -- Correctness Review:**
- Read the plan and its SUMMARY.md
- Review the actual code changes (git diff for the plan's commits)
- Check acceptance criteria are met
- Check for bugs, security issues, or logic errors

**Stage 2 -- Integration Review:**
- Check for conflicts with other plans in the wave
- Verify conventions are followed
- Ensure no regressions in existing functionality

The reviewer produces `.shipyard/phases/{N}/results/REVIEW-{W}.{P}.md`:
```markdown
# Review: Plan {W}.{P}

## Verdict: {PASS|MINOR_ISSUES|CRITICAL_ISSUES}

## Findings
### Critical
- {issues that must be fixed}

### Minor
- {issues that should be noted but don't block}

### Positive
- {things done well}
```

#### 3d. Handle Critical Issues

If any review has `CRITICAL_ISSUES`:
1. Dispatch the builder agent again with the review feedback (max **2 retries**)
2. The builder should fix only the critical issues
3. Re-run the review after fixes
4. If still failing after 2 retries, mark the plan as `needs_attention` and continue

#### 3e. Update Tasks

For each plan that passed review, update its native task to `completed` using TaskUpdate.
For plans needing attention, update to `blocked` with a note.

### After all waves complete:

## Step 4: Phase Verification

Dispatch a **verifier agent** (subagent_type: "shipyard:verifier") with:
- All SUMMARY.md and REVIEW.md files for this phase
- The phase description from ROADMAP.md
- PROJECT.md requirements relevant to this phase
- Working directory, current branch, and worktree status

The verifier checks:
- All phase goals are met
- No critical review findings remain unresolved
- Integration between plans is sound
- Tests pass (run the test suite if one exists)
- Infrastructure validation passes (if IaC files were changed)

Produce `.shipyard/phases/{N}/VERIFICATION.md` with:
- Overall phase status
- Coverage of requirements
- Any gaps identified
- Infrastructure validation results (if applicable)
- Recommendations

## Step 4a: Security Audit

**Skip this step if:** `--light` flag was passed, OR `config.json` has `"security_audit": false`.

After verification passes, dispatch an **auditor agent** (subagent_type: "shipyard:auditor") with:
- Git diff of all files changed during this phase
- `.shipyard/PROJECT.md` for context
- `.shipyard/codebase/CONVENTIONS.md` (if exists)
- List of dependencies added/changed during the phase
- Working directory, current branch, and worktree status

The auditor performs comprehensive security analysis:
- Code security (OWASP Top 10)
- Secrets scanning across all changed files
- Dependency vulnerability check
- IaC security (if Terraform/Ansible/Docker files changed)
- Configuration security
- Cross-task security coherence

Produce `.shipyard/phases/{N}/results/AUDIT-{N}.md`.

**If CRITICAL security findings exist:**
1. Display the critical findings to the user
2. The user must decide: fix now (dispatch builder with audit feedback) or acknowledge and proceed
3. Critical findings will also block `/shipyard:ship` unless resolved

## Step 4b: Simplification Review

**Skip this step if:** `--light` flag was passed, OR `config.json` has `"simplification_review": false`.

After the audit (or directly after verification if audit was skipped), dispatch a **simplifier agent** (subagent_type: "shipyard:simplifier") with:
- Git diff of all files changed during this phase (from phase start)
- All SUMMARY.md files from this phase's plans
- `.shipyard/PROJECT.md` for context
- Working directory, current branch, and worktree status

The simplifier reviews cumulative changes for:
- Cross-task duplication
- Unnecessary abstractions
- Dead code introduced across tasks
- Complexity hotspots
- AI-generated bloat patterns

Produce `.shipyard/phases/{N}/results/SIMPLIFICATION-{N}.md`.

**Simplification findings are non-blocking but reported.** Present the report to the user with options:
1. **Implement simplifications** — Dispatch a builder agent with the simplification plan (recommended if High priority findings exist)
2. **Defer to later** — Note findings for a future cleanup phase
3. **Dismiss** — Acknowledge and proceed without changes

## Step 4c: Documentation Generation

**Skip this step if:** `--light` flag was passed, OR `config.json` has `"documentation_generation": false`.

After simplification review (or directly after verification if simplification was skipped), dispatch a **documenter agent** (subagent_type: "shipyard:documenter") with:
- Git diff of all files changed during this phase (from phase start)
- All SUMMARY.md files from this phase's plans
- `.shipyard/PROJECT.md` for context
- Existing documentation in `docs/` directory (if exists)
- Working directory, current branch, and worktree status

The documenter analyzes cumulative changes for:
- Public API documentation needs
- Architecture documentation updates
- User-facing documentation for new features
- Code documentation gaps

Produce `.shipyard/phases/{N}/results/DOCUMENTATION-{N}.md`.

**Documentation findings are non-blocking but reported.** Present the report to the user with options:
1. **Generate documentation** — Dispatch the documenter agent to create/update documentation in `docs/` (recommended if significant gaps exist)
2. **Defer to ship time** — Note findings for comprehensive documentation at ship time
3. **Dismiss** — Acknowledge and proceed without documentation changes

## Step 5: Update Roadmap & State

Update `.shipyard/ROADMAP.md`:
- Mark the phase status (complete, complete_with_gaps, needs_attention)

Update `.shipyard/STATE.md`:
- **Current Position:** Phase {N} build complete
- **Status:** {result}

## Step 6: Commit Artifacts

Create a git commit with build artifacts:
```
shipyard: complete phase {N} build
```

## Step 6a: Create Checkpoint

Follow **Checkpoint Protocol** (see `docs/PROTOCOLS.md`) -- create `post-build-phase-{N}` checkpoint.

## Step 7: Route Forward

Based on the verification result:

- **Gaps found:**
  > "Phase {N} is mostly complete but has gaps. Run `/shipyard:plan {N} --gaps` to create plans for the remaining work."

- **Phase complete, more phases remain:**
  > "Phase {N} is complete! Run `/shipyard:plan {N+1}` to begin planning the next phase."

- **Last phase complete:**
  > "All phases are complete! Run `/shipyard:ship` to finalize and deliver."

- **Critical issues unresolved:**
  > "Phase {N} has unresolved critical issues. Review the findings in `.shipyard/phases/{N}/results/` and decide how to proceed."

Also check `.shipyard/ISSUES.md` for open issues. If open issues exist, append:
> "Note: {count} open issue(s) tracked. Run `/shipyard:issues` to review."
