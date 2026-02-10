---
description: "Move codebase documentation between .shipyard/codebase and docs/codebase"
disable-model-invocation: true
argument-hint: ""
---

# /shipyard:move-docs - Relocate Codebase Documentation

Move brownfield codebase analysis documentation between `.shipyard/codebase/` and `docs/codebase/`, updating configuration and committing the change.

<prerequisites>

## Step 1: Validate State

1. Verify `.shipyard/` exists. If not, tell the user to run `/shipyard:init` first.
2. Read `codebase_docs_path` from `.shipyard/config.json` (default: `.shipyard/codebase`).
3. If `codebase_docs_path` is not set in config, infer from file existence:
   - If `.shipyard/codebase/` has docs: current = `.shipyard/codebase`
   - If `docs/codebase/` has docs: current = `docs/codebase`
   - If neither has docs: display error and suggest `/shipyard:map` to generate codebase documentation first. Stop.
4. If docs exist in **both** locations: display conflict error and ask the user to resolve manually. Stop.

</prerequisites>

<execution>

## Step 2: Determine Target & Confirm

The target is the opposite of the current location:
- Current `.shipyard/codebase` → Target `docs/codebase`
- Current `docs/codebase` → Target `.shipyard/codebase`

Use AskUserQuestion to confirm:

> **Move codebase documentation?**
>
> - **From:** `{current_path}/`
> - **To:** `{target_path}/`
>
> Files: STACK.md, ARCHITECTURE.md, CONVENTIONS.md, CONCERNS.md, INTEGRATIONS.md, STRUCTURE.md, TESTING.md
>
> If moving to `docs/codebase/`: files will be git-committed (visible in repository).
> If moving to `.shipyard/codebase/`: files will be gitignored (private).

If user declines, stop.

## Step 3: Move Files

Create the target directory if it does not exist:
```bash
mkdir -p {target_path}
```

For each of these 7 files, if it exists in the current path:
- STACK.md
- ARCHITECTURE.md
- CONVENTIONS.md
- CONCERNS.md
- INTEGRATIONS.md
- STRUCTURE.md
- TESTING.md

Move using `git mv` (preserves history):
```bash
git mv {current_path}/{file} {target_path}/{file}
```

If `git mv` fails (file not tracked), fall back to `mv`:
```bash
mv {current_path}/{file} {target_path}/{file}
```

Track: count of files moved, list of files skipped (not found).

## Step 4: Update Config

Read `.shipyard/config.json`, set `codebase_docs_path` to `{target_path}`, write back.

## Step 5: Clean Up

If the source directory is now empty, remove it:
```bash
rmdir {current_path} 2>/dev/null || true
```

## Step 6: Commit

```bash
git add .shipyard/config.json {target_path}/
git commit -m "shipyard: move codebase docs to {target_path}"
```

</execution>

<output>

## Step 7: Report

Display:
```
Codebase documentation moved successfully.

Moved ({count} files):
- {list}

Skipped (not found):
- {list or "none"}

New location: {target_path}/
Config updated: .shipyard/config.json
```

If moved to `docs/codebase/`:
> Documentation is now tracked in git and visible to collaborators.

If moved to `.shipyard/codebase/`:
> Documentation is now gitignored and private to your local workspace.

</output>
