---
description: "Enable or disable memory"
disable-model-invocation: true
argument-hint: ""
---

# /memory:enable and /memory:disable - Toggle Memory

You are executing the memory toggle workflow. Determine from the command which action to take.

## Step 0: Determine Action

- `/memory:enable` → Enable memory
- `/memory:disable` → Disable memory

## Step 1: Read Current Configuration

Read `~/.config/shipyard/config.json` if it exists. Note current memory setting.

## Step 2: Handle Enable

If enabling and memory is already enabled:
> "Memory is already enabled. Use `/memory:status` to see current statistics."
Stop here.

If enabling and memory is disabled (or not configured):

1. Ensure `~/.config/shipyard/` directory exists
2. Update `config.json` with:
   ```json
   {
     "memory": true,
     "memory_storage_cap_mb": 1024
   }
   ```
3. Display:
   > "Memory enabled.
   >
   > Background indexing will begin shortly. New conversations will be indexed automatically.
   >
   > To import existing conversation history, run `/memory:import`."

## Step 3: Handle Disable

If disabling and memory is already disabled:
> "Memory is already disabled."
Stop here.

If disabling and memory is enabled:

1. Ask for confirmation using AskUserQuestion:
   > **Disable memory?**
   >
   > This will:
   > - Stop indexing new conversations
   > - Keep existing indexed exchanges (not deleted)
   >
   > To also delete existing memory, use `/memory:forget --all-sessions-today` or manually delete `~/.config/shipyard/memory.db`.
   >
   > 1. **Yes, disable** -- Stop indexing
   > 2. **No, keep enabled** -- Cancel

2. If confirmed, update `config.json` with:
   ```json
   {
     "memory": false
   }
   ```

3. Display:
   > "Memory disabled. Conversations will no longer be indexed.
   >
   > Existing memory data has been preserved. To delete it:
   > - Delete specific sessions with context
   > - Delete the database: `rm ~/.config/shipyard/memory.db`"

## Step 4: Verify

Display the new configuration state:
> "Memory is now: **{enabled/disabled}**"
