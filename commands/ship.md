---
description: "Finish and deliver completed work"
disable-model-invocation: true
argument-hint: "[--phase | --milestone | --branch]"
---

# /shipyard:ship - Delivery & Completion

You are executing the Shipyard shipping workflow. Follow these steps precisely.

## Step 0: Parse Arguments

Determine the shipping scope:
- `--phase` -- Ship only the current phase (partial delivery)
- `--milestone` -- Ship the entire milestone (default if all phases complete)
- `--branch` -- Ship whatever is on the current branch
- No argument -- auto-detect the appropriate scope

## Step 1: Pre-Ship Verification

Invoke the `shipyard:shipyard-verification` skill to run a comprehensive check.

This should verify:
- All acceptance criteria from plans are met
- No critical review findings are unresolved
- Code compiles/builds without errors
- Linting passes (if configured)

## Step 2: Run Test Suite

Detect and run the project's test suite:
- Look for test commands in package.json, Makefile, Cargo.toml, etc.
- Execute the test command
- **If tests fail:**
  Display the failures and stop:
  > "Tests are failing. Fix the issues before shipping. Failures:\n{test output summary}\n\nRun `/shipyard:build` to address these issues."
  Do not proceed.
- **If no test suite exists:** Note this and continue with a warning.

## Step 2a: Pre-Ship Security Audit

**Note:** This audit runs regardless of `config.json` settings or `--light` usage during build. Shipping is the final gate — security is always checked here. If a passing `AUDIT-{N}.md` already exists from the build phase and no changes were made since, skip re-auditing and verify the existing report has no unresolved critical findings.

Dispatch an **auditor agent** (subagent_type: "shipyard:auditor") with:
- Git diff of ALL changes in the shipping scope (phase, milestone, or branch)
- `.shipyard/PROJECT.md` for context
- `.shipyard/codebase/CONVENTIONS.md` (if exists)
- All dependency files (package.json, requirements.txt, Cargo.toml, go.mod, etc.)

This is a comprehensive audit covering:
- Code security (OWASP Top 10) across all changes
- Secrets scanning in all modified files
- Dependency vulnerability check
- IaC security review (Terraform, Ansible, Docker)
- Cross-component security coherence

Produce audit report.

**If CRITICAL security findings exist:**
1. Display: "Security audit found critical issues that must be resolved before shipping:"
2. List each critical finding with location and remediation
3. > "Fix these issues and run `/shipyard:ship` again."
4. **Do not proceed.** Critical security findings are a hard gate.

**If no critical findings:** Continue. Display advisory/important findings as informational.

**If a phase-level audit was already run during `/shipyard:build` (AUDIT-{N}.md exists):**
- Only re-audit if new changes were made after the build audit
- Otherwise, verify the existing audit report shows no unresolved critical findings

## Step 2b: Comprehensive Documentation Generation

**Note:** This step runs regardless of `config.json` settings or `--light` usage during build. Shipping should produce comprehensive documentation.

If phase-level `DOCUMENTATION-{N}.md` files exist from the build phase and are up-to-date (no changes since last documentation run), verify completeness and skip to documentation assembly. Otherwise, dispatch a **documenter agent** (subagent_type: "shipyard:documenter") with:
- Git diff of ALL changes in the shipping scope (phase, milestone, or branch)
- `.shipyard/PROJECT.md` for context
- All SUMMARY.md files from all completed phases
- Existing documentation in `docs/` directory (if exists)

This is comprehensive documentation generation covering:
- Complete API reference documentation in `docs/api/`
- Architecture documentation in `docs/architecture/`
- User guides in `docs/guides/`
- README updates for new features and changes
- Migration guides for breaking changes

The documenter produces:
1. Complete documentation in the `docs/` directory
2. `.shipyard/DOCUMENTATION-SHIP.md` summarizing what was generated

**If critical documentation gaps exist** (e.g., public APIs without docs, user-facing features without guides):
1. Display the gaps to the user
2. > "Generate documentation now (recommended) or acknowledge and proceed?"
3. User decides whether to generate docs or ship without complete documentation

**If no critical gaps:** Continue. Display informational findings about optional improvements.

## Step 3: Determine Scope

Based on the argument and project state:

**Phase scope:**
- Verify the current phase's VERIFICATION.md shows pass
- Collect all changes in this phase

**Milestone scope:**
- Audit ALL phases: each must have a passing VERIFICATION.md
- If any phase is incomplete, list them and ask the user to complete them first
- Generate a milestone report in `.shipyard/MILESTONE-REPORT.md`:
  ```markdown
  # Milestone Report: {name}

  **Completed:** {timestamp}
  **Phases:** {X}/{Y} complete

  ## Phase Summaries
  ### Phase 1: {title}
  {summary from VERIFICATION.md}

  ### Phase 2: {title}
  ...

  ## Key Decisions
  {aggregated from all SUMMARY.md files}

  ## Documentation Status
  - API documentation: {coverage summary}
  - Architecture documentation: {completeness status}
  - User guides: {count of guides generated/updated}
  - README updated: {yes/no}

  ## Known Issues
  {any minor issues or technical debt noted}

  ## Metrics
  - Files created: {count}
  - Files modified: {count}
  - Total commits: {count}
  ```

**Branch scope:**
- Use whatever is on the current branch regardless of phase state

## Step 4: Present Delivery Options

Use AskUserQuestion to present four options:

> **Your work is ready to ship. Choose a delivery method:**
>
> 1. **Merge locally** -- Merge this branch into the base branch on your machine
> 2. **Push & create PR** -- Push the branch and create a pull request
> 3. **Preserve branch** -- Keep the branch as-is for later
> 4. **Discard work** -- Delete the branch and all changes (DESTRUCTIVE)
>
> Enter 1, 2, 3, or 4:

## Step 5: Execute Delivery

### Option 1: Merge Locally
1. Identify the base branch (main/master/develop)
2. Switch to the base branch
3. Merge the working branch
4. Delete the working branch
5. Display: "Merged to {base_branch}. Your work is now on the base branch."

### Option 2: Push & Create PR
1. Push the branch to the remote
2. Use `gh pr create` to create a pull request with:
   - Title from the milestone/phase name
   - Body from MILESTONE-REPORT.md or phase VERIFICATION.md
   - Appropriate labels if detectable
3. Display the PR URL

### Option 3: Preserve Branch
1. Ensure all changes are committed
2. Display: "Branch `{branch_name}` is preserved. You can return to it anytime."
3. Optionally switch back to the base branch

### Option 4: Discard Work
1. **Require explicit confirmation:** "Type 'DISCARD' to confirm you want to delete all work on this branch."
2. Only proceed if the user types exactly "DISCARD"
3. Switch to base branch
4. Delete the working branch
5. Display: "Branch deleted. All work has been discarded."

## Step 6: Archive Artifacts

If the milestone is complete (not just a phase):
1. Create `.shipyard/archive/{milestone-name}/` directory
2. Move all phase directories into the archive
3. Move ROADMAP.md, PROJECT.md, MILESTONE-REPORT.md to archive
4. Keep STATE.md and config.json in `.shipyard/` (reset state for next milestone)

## Step 7: Update Tasks & State

Mark all relevant native tasks as `completed` using TaskUpdate.

Update `.shipyard/STATE.md`:
```markdown
# Shipyard State

**Last Updated:** {timestamp}
**Current Phase:** {N/A or next milestone}
**Current Position:** Milestone shipped
**Status:** shipped

## History
{previous history}
- [{timestamp}] Milestone shipped via {method}
```

## Step 8: Commit Archive

If archiving was done:
```
shipyard: archive milestone {name}
```

## Step 9: Final Message

> "Ship complete! {summary of what was delivered}"
>
> If there are more milestones planned:
> "To start the next milestone, run `/shipyard:init` to define new goals."
>
> If `.shipyard/ISSUES.md` has open issues:
> "Note: {count} issue(s) remain open and have been preserved in `.shipyard/ISSUES.md` for the next milestone. Run `/shipyard:issues` to review."
