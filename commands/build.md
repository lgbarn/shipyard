---
description: "Execute plans using fresh subagents with review gates"
disable-model-invocation: true
argument-hint: "[phase-number] [--plan N] [--light]"
---

# /shipyard:build - Plan Execution

You are executing the Shipyard build workflow. Follow these steps precisely.

<prerequisites>

## Step 1: Parse Arguments

- If a phase number is provided, use it.
- If `--plan N` is provided, execute only that specific plan (format: W.P).
- If `--light` is provided, skip post-phase auditor and simplifier (Steps 5a and 5b). Use this during early iteration — the full pipeline runs at ship time regardless.
- If no phase number, read `.shipyard/STATE.json` for the current phase.
- Read `.shipyard/config.json` for gate preferences (`security_audit`, `simplification_review`, `iac_validation`, `documentation_generation`).
- Follow **Worktree Protocol** (detect if running in a git worktree; if so, use worktree root for paths and record the branch name; see `docs/PROTOCOLS.md`) -- detect worktree, record working directory and branch.
- Follow **Model Routing Protocol** (select the correct model for each agent role using `model_routing` from config; see `docs/PROTOCOLS.md`) -- read `model_routing` from config for agent model selection.

## Step 2: Validate State

1. Verify `.shipyard/` exists. If not, tell the user to run `/shipyard:init` first.
2. Read `.shipyard/ROADMAP.md` and locate the target phase.
3. Read `.shipyard/STATE.json` for current context.
4. Load all plan files from `.shipyard/phases/{N}/plans/`.
5. Check which plans have already been completed (have SUMMARY.md files in `.shipyard/phases/{N}/results/`).
6. If all plans are complete, inform the user and suggest `/shipyard:ship` or next phase.

## Step 2b: Team or Agent Dispatch

**Detection:** Check the `SHIPYARD_TEAMS_ENABLED` environment variable (exported by `scripts/team-detect.sh`). This variable is set to `true` when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

**Prompt (conditional):** If `SHIPYARD_TEAMS_ENABLED=true`, use `AskUserQuestion` with exactly two options:
- "Team mode (parallel teammates)" -- uses TeamCreate/TaskCreate/SendMessage/TeamDelete lifecycle
- "Agent mode (subagents)" -- uses standard Task dispatch (current behavior)

Question text: "Teams available. Use team mode (parallel teammates) or agent mode (subagents)?"

**Silent fallback:** If `SHIPYARD_TEAMS_ENABLED` is `false` or unset, silently set `dispatch_mode` to `agent` with no prompt (zero overhead).

**Variable storage:** Store the result as `dispatch_mode` (value: `team` or `agent`). This variable is referenced by all subsequent dispatch steps.

**Note:** In team mode, single-agent steps (verifier, auditor, simplifier, documenter) still use Task dispatch -- team overhead is not justified for one agent. Team mode applies only to multi-agent steps (builders per wave, reviewers per wave).

</prerequisites>

<execution>

## Step 3: Update State

Follow **State Update Protocol** (update `.shipyard/STATE.json` and `.shipyard/HISTORY.md` via state-write.sh; see `docs/PROTOCOLS.md`) -- set:
- **Phase:** {N}
- **Position:** Building phase {N}
- **Status:** building

## Step 3a: Create Checkpoint

Follow **Checkpoint Protocol** (create a named git tag for rollback safety at key pipeline stages; see `docs/PROTOCOLS.md`) -- create `pre-build-phase-{N}` checkpoint.

## Step 4: Execute by Wave

Group plans by wave number. Execute waves sequentially, plans within a wave in parallel.

### For each wave (sequential):

#### Step 4a: Launch Builders (parallel within wave)

For each incomplete plan in this wave, dispatch a **builder agent** (subagent_type: "shipyard:builder") with context per **Agent Context Protocol** (pass PROJECT.md, config.json, working directory, branch, and worktree status to all agents; see `docs/PROTOCOLS.md`):
- The full plan content (PLAN-{W}.{P}.md)
- Codebase docs per **Codebase Docs Protocol** (resolve configured codebase docs path and load CONVENTIONS.md, STACK.md, ARCHITECTURE.md, etc.; see `docs/PROTOCOLS.md`)
- `.shipyard/phases/{N}/CONTEXT-{N}.md` (if exists) -- user decisions to guide implementation
- Results from previous waves (SUMMARY.md files)

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

**Lesson Seeding:** Document all discoveries thoroughly in "Issues Encountered" and "Decisions Made":
- Unexpected behaviors or edge cases found
- Workarounds applied and why
- Assumptions proven wrong during implementation
- Things that were harder or easier than expected

These entries will be used as pre-populated suggestions when capturing lessons at ship time.

#### Step 4b: Collect Results

Wait for all builders in the wave to complete. Read their SUMMARY.md files.

#### Step 4c: Review Gate

For each completed plan, dispatch a **reviewer agent** (subagent_type: "shipyard:reviewer") following the **Model Routing Protocol** (select the correct model for each agent role using `model_routing` from config; see `docs/PROTOCOLS.md`) with the same working directory context (path, branch, worktree status) and `.shipyard/phases/{N}/CONTEXT-{N}.md` (if exists) for user intent, performing a **two-stage review**:

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

#### Step 4d: Handle Critical Issues

If any review has `CRITICAL_ISSUES`:
1. Dispatch the builder agent again with the review feedback (max **2 retries** -- each retry is one additional builder dispatch that attempts to fix critical issues; if the second retry still fails, the plan is marked `needs_attention`)
2. The builder should fix only the critical issues
3. Re-run the review after fixes
4. If still failing after 2 retries, mark the plan as `needs_attention` and continue

#### Step 4e: Update Tasks

Follow **Native Task Scaffolding Protocol** (create/update native tasks for progress tracking via TaskCreate/TaskUpdate; see `docs/PROTOCOLS.md`) -- update task status based on build and review results.

### After all waves complete:

## Step 5: Phase Verification

Dispatch a **verifier agent** (subagent_type: "shipyard:verifier") following the **Model Routing Protocol** (select the correct model for each agent role using `model_routing` from config; see `docs/PROTOCOLS.md`) with:
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

## Step 5a: Security Audit

**Skip this step if:** `--light` flag was passed, OR `config.json` has `"security_audit": false`.

After verification passes, dispatch an **auditor agent** (subagent_type: "shipyard:auditor") with context per **Agent Context Protocol** (pass PROJECT.md, config.json, working directory, branch, and worktree status to all agents; see `docs/PROTOCOLS.md`):
- Git diff of all files changed during this phase
- Codebase docs per **Codebase Docs Protocol** (resolve configured codebase docs path and load CONVENTIONS.md, STACK.md, ARCHITECTURE.md, etc.; see `docs/PROTOCOLS.md`)
- List of dependencies added/changed during the phase

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

## Step 5b: Simplification Review

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

## Step 5c: Documentation Generation

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

## Step 6: Update Roadmap & State

Update `.shipyard/ROADMAP.md`:
- Mark the phase status (complete, complete_with_gaps, needs_attention)

Follow **State Update Protocol** (update `.shipyard/STATE.json` and `.shipyard/HISTORY.md` via state-write.sh; see `docs/PROTOCOLS.md`) -- set:
- **Position:** Phase {N} build complete
- **Status:** {result}

</execution>

<output>

## Step 7: Commit Artifacts

Create a git commit with build artifacts:
```
shipyard: complete phase {N} build
```

## Step 7a: Create Checkpoint

Follow **Checkpoint Protocol** (create a named git tag for rollback safety at key pipeline stages; see `docs/PROTOCOLS.md`) -- create `post-build-phase-{N}` checkpoint.

## Step 8: Route Forward

Display the appropriate next step based on the verification result:

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

</output>
