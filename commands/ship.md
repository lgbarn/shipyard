---
description: "Finish and deliver completed work"
disable-model-invocation: true
argument-hint: "[--phase | --milestone | --branch]"
---

# /shipyard:ship - Delivery & Completion

You are executing the Shipyard shipping workflow. Follow these steps precisely.

<prerequisites>

## Step 1: Parse Arguments & Load Context

Determine the shipping scope:
- `--phase` -- Ship only the current phase (partial delivery)
- `--milestone` -- Ship the entire milestone (default if all phases complete)
- `--branch` -- Ship whatever is on the current branch
- No argument -- auto-detect the appropriate scope

Follow **Worktree Protocol** (detect if running in a git worktree; if so, use worktree root for paths and record the branch name; see `docs/PROTOCOLS.md`) -- detect worktree, record working directory and branch.
Follow **Model Routing Protocol** (select the correct model for each agent role using `model_routing` from config; see `docs/PROTOCOLS.md`) -- read `model_routing` from config for agent model selection.

## Step 2: Pre-Ship Verification

Invoke the `shipyard:shipyard-verification` skill to run a comprehensive check.

Verify:
- All acceptance criteria from plans are met
- No critical review findings are unresolved
- Code compiles/builds without errors
- Linting passes (if configured)

## Step 3: Run Test Suite

Detect and run the project's test suite:
- Look for test commands in package.json, Makefile, Cargo.toml, etc.
- Execute the test command
- **If tests fail:**
  Display the failures and stop:
  > "Tests are failing. Fix the issues before shipping. Failures:\n{test output summary}\n\nRun `/shipyard:build` to address these issues."
  Do not proceed.
- **If no test suite exists:** Note this and continue with a warning.

</prerequisites>

<execution>

## Step 3a: Pre-Ship Security Audit

**Note:** This audit runs regardless of `config.json` settings or `--light` usage during build. Shipping is the final gate — security is always checked here. If a passing `AUDIT-{N}.md` already exists from the build phase and no changes were made since, skip re-auditing and verify the existing report has no unresolved critical findings.

Dispatch an **auditor agent** (subagent_type: "shipyard:auditor") with context per **Agent Context Protocol** (pass PROJECT.md, config.json, working directory, branch, and worktree status to all agents; see `docs/PROTOCOLS.md`):
- Git diff of ALL changes in the shipping scope (phase, milestone, or branch)
- Codebase docs per **Codebase Docs Protocol** (resolve configured codebase docs path and load CONVENTIONS.md, STACK.md, ARCHITECTURE.md, etc.; see `docs/PROTOCOLS.md`)
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

## Step 3b: Comprehensive Documentation Generation

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

## Step 4: Determine Scope

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

## Step 4a: Capture Lessons Learned

Invoke the `shipyard:lessons-learned` skill for format and quality guidance.

### Step 4a-i: Extract Candidate Lessons from Build Summaries

Read all SUMMARY.md files in the shipping scope:
- For phase scope: `.shipyard/phases/{N}/results/SUMMARY-*.md`
- For milestone scope: all phases' SUMMARY files

Extract content from "Issues Encountered" and "Decisions Made" sections as candidate lessons.

### Step 4a-ii: Enrich with Memory (if enabled)

Check if Memory is enabled via `~/.config/shipyard/config.json`:

**If memory is enabled:**

1. Calculate the milestone's date range from `.shipyard/STATE.md` history entries
2. Use `/shipyard:memory-search` (or call the memory MCP server) to search for exchanges matching:
   - Date range of the current milestone
   - Current project path
   - Query: "debugging struggles, rejected approaches, decisions, issues resolved"
3. Dispatch a **Haiku subagent** to analyze memory results and extract:
   - Debugging struggles and their resolutions
   - Approaches that were tried and rejected (with reasons)
   - Key decisions made during implementation
   - Patterns that worked well or poorly
4. Add memory-derived insights to the candidate lessons, clearly marked:
   ```
   **From build summaries:**
   - {summary-derived lesson}

   **From conversation memory:**
   - {memory-derived insight about debugging X}
   - {memory-derived insight about decision Y}
   ```

**If memory is disabled:** Skip memory enrichment and continue with build summary lessons only.

### Step 4a-iii: Present to User

Use AskUserQuestion to present:

> **Phase {N} is complete. Let's capture lessons learned.**
>
> These will be saved to `.shipyard/LESSONS.md` and optionally to your project's `CLAUDE.md`.
>
> Based on the build summaries{and memory if enabled}, here are some candidate lessons:
> {Pre-populated from SUMMARY.md extracts and memory insights, or "No candidates found" if empty}
>
> **What went well?**
> **What surprised you or what did you learn?**
> **What should future work avoid?**
> **Any process improvements?**
>
> Edit, add to, or approve the above. Type "skip" to skip lesson capture.

### Step 4a-iv: Persist Lessons

If user does not type "skip":

1. Format lessons as a markdown section following the LESSONS.md format from the skill:
   ```
   ## [YYYY-MM-DD] Phase N: {Phase Name}

   ### What Went Well
   - {user input}

   ### Surprises / Discoveries
   - {user input}

   ### Pitfalls to Avoid
   - {user input}

   ### Process Improvements
   - {user input}

   ---
   ```
2. Append to `.shipyard/LESSONS.md` (create file with `# Shipyard Lessons Learned` header if it does not exist).
3. If `CLAUDE.md` exists in the project root:
   - Ask user: "Update CLAUDE.md with these lessons? (y/n)"
   - If yes: check for existing `## Lessons Learned` section
     - If section exists: append new lessons under it (with date separator)
     - If not: append `## Lessons Learned` section at end of file
4. Commit: `shipyard(phase-{N}): capture lessons learned`

If user types "skip", continue to Step 5 with no lesson capture.

## Step 5: Present Delivery Options

Use AskUserQuestion to present four options:

> **Your work is ready to ship. Choose a delivery method:**
>
> 1. **Merge locally** -- Merge this branch into the base branch on your machine
> 2. **Push & create PR** -- Push the branch and create a pull request
> 3. **Preserve branch** -- Keep the branch as-is for later
> 4. **Discard work** -- Delete the branch and all changes (DESTRUCTIVE)
>
> Enter 1, 2, 3, or 4:

## Step 6: Execute Delivery

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

## Step 7: Archive Artifacts

If the milestone is complete (not just a phase):
1. Create `.shipyard/archive/{milestone-name}/` directory
2. Move all phase directories into the archive
3. Move ROADMAP.md, PROJECT.md, MILESTONE-REPORT.md to archive
4. Keep STATE.md and config.json in `.shipyard/` (reset state for next milestone)

## Step 8: Update Tasks & State

Follow **Native Task Scaffolding Protocol** (create/update native tasks for progress tracking via TaskCreate/TaskUpdate; see `docs/PROTOCOLS.md`) -- mark all relevant native tasks as `completed`.

Follow **State Update Protocol** (update `.shipyard/STATE.md` with current phase, position, status, and append to history; see `docs/PROTOCOLS.md`) -- set:
- **Current Phase:** N/A (or next milestone)
- **Current Position:** Milestone shipped
- **Status:** shipped
- **History:** append `[{timestamp}] Milestone shipped via {method}`

## Step 9: Commit Archive

If archiving was done:
```
shipyard: archive milestone {name}
```

</execution>

<output>

## Step 10: Final Message

Display:
> "Ship complete! {summary of what was delivered}"
>
> If there are more milestones planned:
> "To start the next milestone, run `/shipyard:init` to define new goals."
>
> If lessons were captured in Step 4a:
> "Lessons learned have been saved to `.shipyard/LESSONS.md`."
>
> If `.shipyard/ISSUES.md` has open issues:
> "Note: {count} issue(s) remain open and have been preserved in `.shipyard/ISSUES.md` for the next milestone. Run `/shipyard:issues` to review."

</output>
