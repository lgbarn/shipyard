---
description: "Import existing conversation history into memory"
disable-model-invocation: true
argument-hint: "[--force]"
---

# /shipyard:memory-import - Import Conversation History

You are executing the memory import workflow. Follow these steps precisely.

## Step 0: Parse Arguments

Check for flags:
- `--force`: Re-import even if already imported (useful after exclusion changes)

## Step 1: Check Memory Enabled

Check `~/.config/shipyard/config.json` for memory settings.

- **If memory is disabled:**
  Display:
  > "Memory is not enabled. Use `/shipyard:memory-enable` first, then run this command."
  Stop here.

## Step 2: Check Existing Import

Check if an import has already been completed by looking for a marker in the database or config.

- **If already imported and not --force:**
  Display:
  > "Conversation history has already been imported.
  >
  > Use `--force` to re-import (e.g., after changing project exclusions).
  > Note: Re-importing will not duplicate existing exchanges."
  Stop here.

## Step 3: Locate History

Check for conversation history in `~/.claude/projects/`.

- **If directory doesn't exist or is empty:**
  Display:
  > "No conversation history found at `~/.claude/projects/`.
  >
  > This is normal if you're using Claude Code for the first time or have a custom configuration.
  > New conversations will be indexed automatically going forward."
  Stop here.

## Step 4: Estimate Scope

Count the number of JSONL files to be imported and estimate:
- Number of conversation files
- Approximate total size
- Estimated processing time (rough: ~100 exchanges per minute)

Display:
> "Found {N} conversation files ({size} total).
>
> Import will:
> - Parse all conversation exchanges
> - Scrub secrets before storing
> - Generate embeddings for semantic search
> - Respect project exclusions
>
> This will run in the background and not block your work.
> Estimated time: {estimate}"

## Step 5: Confirm Import

Ask for confirmation using AskUserQuestion:

> **Import conversation history?**
>
> 1. **Yes, start import** -- Begin background import
> 2. **No, cancel** -- Skip import for now

## Step 6: Start Background Import

If confirmed:

1. Trigger the background import process
2. Display:
   > "Import started in background.
   >
   > Use `/shipyard:memory-status` to check progress.
   > You can continue working -- indexing won't interrupt your session.
   >
   > The import will:
   > - Skip projects with `memory: false`
   > - Scrub secrets (API keys, tokens, passwords)
   > - Create searchable embeddings"

## Step 7: Monitor Progress (Optional)

If user wants to wait:
> "Import is running. Check `/shipyard:memory-status` periodically for progress.
>
> Current: {indexed} / {total} files processed"
