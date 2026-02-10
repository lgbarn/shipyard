---
name: git-workflow
description: Use when starting feature work that needs a branch, creating worktrees for isolation, making atomic commits during development, or completing a development branch via merge, PR, preserve, or discard
---

<!-- TOKEN BUDGET: 480 lines / ~1440 tokens -->

# Git Workflow

<activation>

## When This Skill Activates

- Starting feature work that needs branch isolation
- Creating, switching, or removing worktrees
- Completing a development branch (merge, PR, preserve, discard)
- `/shipyard:worktree` command invoked

## Natural Language Triggers
- "create branch", "commit this", "merge branch", "start feature", "set up worktree"

</activation>

## Overview

Comprehensive git workflow covering the full development lifecycle: branch creation, worktree isolation, atomic commits, and branch completion.

**Core principle:** Systematic directory selection + safety verification + structured completion options = reliable development workflow.

<instructions>

## Part 1: Branch and Worktree Setup

**Announce at start:** "I'm using the git-workflow skill to set up an isolated workspace."

### Directory Selection Process

Follow this priority order:

#### 1. Check Existing Directories

```bash
# Check in priority order
ls -d .worktrees 2>/dev/null     # Preferred (hidden)
ls -d worktrees 2>/dev/null      # Alternative
```

**If found:** Use that directory. If both exist, `.worktrees` wins.

#### 2. Check CLAUDE.md

```bash
grep -i "worktree.*director" CLAUDE.md 2>/dev/null
```

**If preference specified:** Use it without asking.

#### 3. Ask User

If no directory exists and no CLAUDE.md preference:

```
No worktree directory found. Where should I create worktrees?

1. .worktrees/ (project-local, hidden)
2. ~/.config/shipyard/worktrees/<project-name>/ (global location)

Which would you prefer?
```

### Safety Verification

**For Project-Local Directories (.worktrees or worktrees):**

**MUST verify directory is ignored before creating worktree:**

```bash
# Check if directory is ignored (respects local, global, and system gitignore)
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

**If NOT ignored:**

Fix immediately:
1. Add appropriate line to .gitignore
2. Commit the change
3. Proceed with worktree creation

**Why critical:** Prevents accidentally committing worktree contents to repository.

**For Global Directory (~/.config/shipyard/worktrees):**

No .gitignore verification needed - outside project entirely.

### Creation Steps

#### 1. Detect Project Name

```bash
project=$(basename "$(git rev-parse --show-toplevel)")
```

#### 2. Create Worktree

```bash
# Determine full path
case $LOCATION in
  .worktrees|worktrees)
    path="$LOCATION/$BRANCH_NAME"
    ;;
  ~/.config/shipyard/worktrees/*)
    path="~/.config/shipyard/worktrees/$project/$BRANCH_NAME"
    ;;
esac

# Create worktree with new branch
git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

#### 3. Run Project Setup

Auto-detect and run appropriate setup:

```bash
# Node.js
if [ -f package.json ]; then npm install; fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi

# Go
if [ -f go.mod ]; then go mod download; fi
```

#### 4. Verify Clean Baseline

Run tests to ensure worktree starts clean:

```bash
# Examples - use project-appropriate command
npm test
cargo test
pytest
go test ./...
```

**If tests fail:** Report failures, ask whether to proceed or investigate.

**If tests pass:** Report ready.

#### 5. Report Location

```
Worktree ready at <full-path>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

## Part 2: Atomic Commits During Development

**Commit frequently and atomically:**

- Each TDD cycle (test + implementation) gets its own commit
- Commit messages should be descriptive: `feat: add retry logic for failed operations`
- Use conventional commit prefixes: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`
- Stage specific files, not `git add -A`
- Never commit secrets, credentials, or large binaries

## Part 3: Branch Completion

**Announce at start:** "I'm using the git-workflow skill to complete this work."

### Step 1: Verify Tests

**Before presenting options, verify tests pass:**

```bash
# Run project's test suite
npm test / cargo test / pytest / go test ./...
```

**If tests fail:**
```
Tests failing (<N> failures). Must fix before completing:

[Show failures]

Cannot proceed with merge/PR until tests pass.
```

Stop. Don't proceed to Step 2.

**If tests pass:** Continue to Step 2.

### Step 2: Determine Base Branch

```bash
# Try common base branches
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

Or ask: "This branch split from main - is that correct?"

### Step 3: Present Options

Present exactly these 4 options:

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

**Don't add explanation** - keep options concise.

### Step 4: Execute Choice

#### Option 1: Merge Locally

```bash
# Switch to base branch
git checkout <base-branch>

# Pull latest
git pull

# Merge feature branch
git merge <feature-branch>

# Verify tests on merged result
<test command>

# If tests pass
git branch -d <feature-branch>
```

Then: Cleanup worktree (Step 5)

#### Option 2: Push and Create PR

```bash
# Push branch
git push -u origin <feature-branch>

# Create PR
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>
EOF
)"
```

Then: Cleanup worktree (Step 5)

#### Option 3: Keep As-Is

Report: "Keeping branch <name>. Worktree preserved at <path>."

**Don't cleanup worktree.**

#### Option 4: Discard

**Confirm first:**
```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for exact confirmation.

If confirmed:
```bash
git checkout <base-branch>
git branch -D <feature-branch>
```

Then: Cleanup worktree (Step 5)

### Step 5: Cleanup Worktree

**For Options 1, 2, 4:**

Check if in worktree:
```bash
git worktree list | grep $(git branch --show-current)
```

If yes:
```bash
git worktree remove <worktree-path>
```

**For Option 3:** Keep worktree.

</instructions>

<examples>

## Example: Worktree Setup Decision

<example type="good" title="Following directory priority correctly">
1. Check: `ls -d .worktrees` -- found!
2. Verify: `git check-ignore -q .worktrees` -- ignored, safe
3. Create: `git worktree add .worktrees/feat-retry -b feat-retry`
4. Setup: `npm install` (package.json detected)
5. Baseline: `npm test` -- 47 tests, 0 failures
6. Report: "Worktree ready at /project/.worktrees/feat-retry"
</example>

<example type="bad" title="Skipping safety checks">
1. Assume `.worktrees/` exists and is ignored
2. Create worktree without checking
3. Worktree contents show up in `git status`
4. Accidentally commit worktree files to repository
</example>

## Example: Branch Completion

<example type="good" title="Proper completion flow">
1. Run tests: `npm test` -- all pass
2. Present 4 options
3. User picks "2. Push and create PR"
4. Push: `git push -u origin feat-retry`
5. Create PR with summary and test plan
6. Cleanup: `git worktree remove .worktrees/feat-retry`
</example>

<example type="bad" title="Skipping test verification">
1. Skip tests -- "I ran them earlier"
2. User picks merge
3. Merge broken code into main
4. CI fails, team blocked
</example>

</examples>

## Quick Reference

| Situation | Action |
|-----------|--------|
| `.worktrees/` exists | Use it (verify ignored) |
| `worktrees/` exists | Use it (verify ignored) |
| Both exist | Use `.worktrees/` |
| Neither exists | Check CLAUDE.md -> Ask user |
| Directory not ignored | Add to .gitignore + commit |
| Tests fail during baseline | Report failures + ask |
| No package.json/Cargo.toml | Skip dependency install |

| Option | Merge | Push | Keep Worktree | Cleanup Branch |
|--------|-------|------|---------------|----------------|
| 1. Merge locally | Yes | - | - | Yes |
| 2. Create PR | - | Yes | Yes | - |
| 3. Keep as-is | - | - | Yes | - |
| 4. Discard | - | - | - | Yes (force) |

<rules>

## Common Mistakes

**Skipping ignore verification**
- **Problem:** Worktree contents get tracked, pollute git status
- **Fix:** Always use `git check-ignore` before creating project-local worktree

**Assuming directory location**
- **Problem:** Creates inconsistency, violates project conventions
- **Fix:** Follow priority: existing > CLAUDE.md > ask

**Proceeding with failing tests**
- **Problem:** Can't distinguish new bugs from pre-existing issues
- **Fix:** Report failures, get explicit permission to proceed

**Skipping test verification before completion**
- **Problem:** Merge broken code, create failing PR
- **Fix:** Always verify tests before offering options

**No confirmation for discard**
- **Problem:** Accidentally delete work
- **Fix:** Require typed "discard" confirmation

## Red Flags

**Never:**
- Create worktree without verifying it's ignored (project-local)
- Skip baseline test verification
- Proceed with failing tests without asking
- Assume directory location when ambiguous
- Skip CLAUDE.md check
- Proceed with failing tests for completion
- Merge without verifying tests on result
- Delete work without confirmation
- Force-push without explicit request

**Always:**
- Follow directory priority: existing > CLAUDE.md > ask
- Verify directory is ignored for project-local
- Auto-detect and run project setup
- Verify clean test baseline
- Present exactly 4 completion options
- Get typed confirmation for Option 4
- Clean up worktree for Options 1 & 4 only

</rules>

## Integration

**Called by:**
- **shipyard:shipyard-brainstorming** - When design is approved and implementation follows
- **shipyard:shipyard-executing-plans** - After all tasks complete
- Any skill needing isolated workspace

**Pairs with:**
- **shipyard:shipyard-executing-plans** - Work happens in the worktree this skill creates
- **shipyard:shipyard-writing-plans** - Plans are executed in worktrees
