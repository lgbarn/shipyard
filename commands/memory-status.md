---
description: "Show memory storage statistics"
disable-model-invocation: true
argument-hint: ""
---

# /shipyard:memory-status - Memory Statistics

You are executing the memory status workflow. Follow these steps precisely.

## Step 1: Check Memory Configuration

Read `~/.config/shipyard/config.json` for memory settings.

Display configuration status:
- **Memory enabled:** Yes/No
- **Storage cap:** {memory_storage_cap_mb} MB

## Step 2: Check Database Exists

Check if `~/.config/shipyard/memory.db` exists.

- **If it does not exist:**
  Display:
  > "Memory database not found. Memory may not have been initialized yet.
  > Run `/shipyard:memory-import` to initialize and import existing conversation history."
  Stop here.

## Step 3: Query Statistics

Call the memory MCP server's `memory_status` tool to retrieve:
- Total database size (bytes)
- Total indexed exchanges
- Oldest exchange date
- Newest exchange date
- Last index run time
- Projects with indexed exchanges

## Step 4: Display Dashboard

Present statistics in a clear format:

```
Memory Status
═══════════════════════════════════════════

Configuration:
  Enabled:     {yes/no}
  Storage cap: {cap} MB

Storage:
  Database size:  {size} MB ({percent}% of cap)
  Exchanges:      {count}
  Date range:     {oldest} to {newest}
  Last indexed:   {time} ago

Top Projects:
  {project_path_1}  {count_1} exchanges
  {project_path_2}  {count_2} exchanges
  {project_path_3}  {count_3} exchanges

Index Status:
  {status: "healthy" | "indexing" | "error"}
  {if error: error_message}
```

## Step 5: Suggest Actions

Based on status, suggest relevant actions:

| Condition | Suggestion |
|-----------|------------|
| Storage > 80% of cap | Consider increasing cap or pruning old exchanges |
| No exchanges | Run `/shipyard:memory-import` to index existing history |
| Last index > 1 hour ago | Background indexer may be paused; check logs |
| Index error | Check `~/.config/shipyard/memory.log` for details |
| Memory disabled | Use `/shipyard:memory-enable` to start indexing |
