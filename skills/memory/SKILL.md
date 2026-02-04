---
name: memory
description: Use when needing past context from previous sessions, when stuck on a problem you may have solved before, or when proposing lessons-learned during shipping
---

<!-- TOKEN BUDGET: 200 lines / ~600 tokens -->

# Memory

## Overview

Memory provides searchable cross-session conversation recall. When you're stuck or need context from past work, search memory for relevant exchanges.

**Core principle:** Memory helps you find how problems were solved before, not just recall that they were solved.

## When to Use

**Search memory when:**
- Stuck on a problem you may have encountered before
- User mentions "we did this before" or "remember when"
- Need context about past decisions or approaches
- Proposing lessons-learned during `/shipyard:ship`

**Don't search when:**
- Current session has all needed context
- Problem is clearly novel
- User explicitly wants a fresh approach

## How It Works

Memory indexes conversation exchanges (user message + assistant response + tool names) across all projects. It stores them locally in `~/.config/shipyard/memory.db` with semantic embeddings for search.

**What's indexed:**
- User messages and assistant responses
- Tool names used (not tool inputs/outputs)
- Project path, timestamp, git branch

**What's excluded:**
- Tool inputs and outputs (file contents, command results)
- Projects with `"memory": false` in config
- Secrets (auto-scrubbed before indexing)

## Using Memory

### Explicit Search

```
/shipyard:memory-search <query>
```

Returns semantically relevant past exchanges. Haiku summarizes results to extract key insights.

### During Lessons-Learned

When running `/shipyard:ship`, memory automatically searches for:
- Debugging struggles in this milestone's timeframe
- Rejected approaches and why
- Key decisions and their rationale

This enriches lesson suggestions with conversation context.

### Transparency

When memory is consulted, explicitly mention it:
> "I searched memory for similar issues and found..."

## Commands

| Command | Purpose |
|---------|---------|
| `/shipyard:memory-search <query>` | Search past conversations |
| `/shipyard:memory-forget` | Delete current session from memory |
| `/shipyard:memory-status` | Show storage stats |
| `/shipyard:memory-enable` / `disable` | Toggle memory |
| `/shipyard:memory-import` | Re-run history import |

## Configuration

**Global** (`~/.config/shipyard/config.json`):
```json
{
  "memory": true,
  "memory_storage_cap_mb": 1024
}
```

**Per-project** (`.shipyard/config.json`):
```json
{
  "memory": false
}
```

## Privacy

- All data stored locally on your machine
- Secrets auto-scrubbed (AWS keys, GitHub tokens, API keys, private keys)
- `/shipyard:memory-forget` deletes current session
- Per-project opt-out available
