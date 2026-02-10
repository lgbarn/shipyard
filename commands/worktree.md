---
description: "Manage git worktrees for isolated feature development"
disable-model-invocation: true
argument-hint: "[create <name>] [list] [switch <name>] [remove <name>]"
---

# /shipyard:worktree - Worktree Management

You are executing the Shipyard worktree management workflow. This provides explicit worktree lifecycle management for isolated feature development.

<prerequisites>

## Step 1: Parse Arguments

Parse the subcommand from arguments:
- `create <name>` — Create a new worktree for isolated development
- `list` — Show all worktrees with status
- `switch <name>` — Switch to a worktree directory
- `remove <name>` — Remove a worktree after confirmation

If no subcommand is provided, default to `list`.

## Step 2: Validate Git State

1. Verify this is a git repository: `git rev-parse --show-toplevel`
2. If not a git repo, tell the user: "Not a git repository. Initialize with `git init` first."

</prerequisites>

---

<execution>

## Subcommand: create

### Step C1: Determine Branch Name

- Use `<name>` as provided, or derive from phase context:
  - If `.shipyard/STATE.json` exists and has a current phase, suggest: `phase-{N}-{name}`
- Verify the branch doesn't already exist: `git branch --list <name>`
- If it exists, inform the user and ask for an alternative name.

### Step C2: Select Worktree Directory

Follow the git-workflow skill's directory selection priority (checks existing dirs, CLAUDE.md prefs, then asks user):

1. **Check existing directories:**
   ```bash
   ls -d .worktrees 2>/dev/null
   ls -d worktrees 2>/dev/null
   ```
   If found, use that directory. If both exist, `.worktrees` wins.

2. **Check CLAUDE.md:**
   ```bash
   grep -i "worktree.*director" CLAUDE.md 2>/dev/null
   ```
   If preference specified, use it.

3. **Ask user:**
   ```
   No worktree directory found. Where should I create worktrees?

   1. .worktrees/ (project-local, hidden)
   2. ~/.config/shipyard/worktrees/<project-name>/ (global location)

   Which would you prefer?
   ```

### Step C3: Verify Safety

**For project-local directories (.worktrees or worktrees):**

```bash
git check-ignore -q <directory> 2>/dev/null
```

If NOT ignored:
1. Add the directory to `.gitignore`
2. Commit the change: `shipyard: add worktree directory to .gitignore`
3. Proceed with creation

**For global directories (~/.config/shipyard/worktrees):** No verification needed.

### Step C4: Create Worktree

```bash
project=$(basename "$(git rev-parse --show-toplevel)")

# For project-local
path="<directory>/<name>"

# For global
path="$HOME/.config/shipyard/worktrees/$project/<name>"

# Create worktree with new branch
git worktree add "$path" -b "<name>"
```

### Step C5: Run Project Setup

Auto-detect and run appropriate setup in the new worktree:

```bash
cd "$path"

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

### Step C6: Verify Baseline

Run the project's test suite to confirm a clean starting point:

```bash
# Use project-appropriate test command
npm test / cargo test / pytest / go test ./...
```

- **If tests pass:** Report ready.
- **If tests fail:** Report failures, ask whether to proceed or investigate.

### Step C7: Report

Display the worktree creation summary (see Output section below).

---

## Subcommand: list

### Step L1: List Worktrees

```bash
git worktree list
```

### Step L2: Annotate Status

For each worktree:
- Show the path, branch, and commit hash
- Check if `.shipyard/` exists in the worktree (indicates Shipyard state)
- Check if the branch has unpushed commits: `git log origin/<branch>..HEAD --oneline 2>/dev/null`
- Mark the current worktree with `(current)`

### Step L3: Display

Display the worktree list (see Output section below).

---

## Subcommand: switch

### Step S1: Find Worktree

```bash
git worktree list | grep "<name>"
```

If not found, show available worktrees and ask the user to pick one.

### Step S2: Switch

Display the worktree path and branch (see Output section below).

Note: Claude Code operates in the directory it was started in. The user will need to `cd` to the worktree path or start a new session from there.

---

## Subcommand: remove

### Step R1: Find Worktree

```bash
git worktree list | grep "<name>"
```

If not found, show available worktrees and inform the user.

### Step R2: Check State

Check if the worktree has uncommitted or unpushed changes:

```bash
cd <worktree-path>
git status --porcelain
git log origin/<branch>..HEAD --oneline 2>/dev/null
```

### Step R3: Confirm

If clean (no uncommitted changes, no unpushed commits):
```
Remove worktree <name> at <path>? (y/n)
```

If dirty (uncommitted or unpushed changes):
```
WARNING: Worktree <name> has uncommitted/unpushed changes:
<list changes>

This will permanently remove the worktree. The branch will be preserved.
Type 'remove' to confirm.
```

### Step R4: Execute Removal

```bash
git worktree remove <worktree-path>
```

If the branch should also be deleted (user confirmed), optionally:
```bash
git branch -d <branch-name>
```

### Step R5: Report

Display the removal summary (see Output section below).

</execution>

<output>

## Output by Subcommand

### create

```
Worktree created:
  Branch: <name>
  Path: <full-path>
  Tests: <N> passing, 0 failures

Ready to develop. Run `/shipyard:build` or `/shipyard:quick` from the worktree.
```

### list

```
Worktrees:
  * /path/to/main                  main        (current, shipyard state)
    /path/to/.worktrees/feature-x  feature-x   (3 unpushed commits)
    /path/to/.worktrees/phase-2    phase-2     (clean)
```

### switch

```
Worktree for <name>:
  Path: <full-path>
  Branch: <branch-name>

Navigate to: cd <full-path>
```

### remove

```
Worktree removed:
  Path: <path> (deleted)
  Branch: <branch-name> (preserved / deleted)
```

</output>
