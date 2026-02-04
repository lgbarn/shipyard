---
description: "Delete the current session from memory"
disable-model-invocation: true
argument-hint: "[--all-sessions-today]"
---

# /memory:forget - Delete Session from Memory

You are executing the memory forget workflow. Follow these steps precisely.

## Step 0: Parse Arguments

Check for flags:
- `--all-sessions-today`: Delete all sessions from today, not just current session

## Step 1: Check Memory Enabled

Check `~/.config/shipyard/config.json` for memory settings.

- **If memory is disabled:**
  Display:
  > "Memory is not enabled. Nothing to forget."
  Stop here.

## Step 2: Get Current Session ID

Determine the current session ID from the conversation context.

## Step 3: Confirm Deletion

Ask for confirmation using AskUserQuestion:

> **Delete session from memory?**
>
> This will permanently remove all exchanges from {scope} from memory.
> This action cannot be undone.
>
> 1. **Yes, delete** -- Remove the exchanges
> 2. **No, cancel** -- Keep the exchanges

Where `{scope}` is either "this session" or "all sessions today" based on flags.

## Step 4: Execute Deletion

If confirmed, call the memory MCP server's `memory_forget` tool:

For current session only:
```json
{
  "session_id": "{current_session_id}"
}
```

For all sessions today:
```json
{
  "after": "{today_date}",
  "before": "{tomorrow_date}"
}
```

## Step 5: Confirm Result

Display the result:

> "Deleted {N} exchanges from memory.
>
> Note: New exchanges in this session will still be indexed unless you run `/memory:forget` again before the session ends, or disable memory entirely with `/memory:disable`."
