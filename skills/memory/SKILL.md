---
name: memory
description: Use when user asks 'how should I...' or 'what's the best approach...' after exploring code, OR when you've tried to solve something and are stuck, OR for unfamiliar workflows, OR when user references past work. Searches conversation history.
---

<!-- TOKEN BUDGET: 200 lines / ~600 tokens -->

# Memory

**Core principle:** Search before reinventing. Searching costs nothing; reinventing or repeating mistakes costs everything.

## Mandatory: Use the Search Agent

**YOU MUST dispatch the search-memory agent for any historical search.**

Announce: "Dispatching search agent to find [topic]."

Then use the Task tool with `subagent_type: "search-memory"`:

```
Task tool:
  description: "Search past conversations for [topic]"
  prompt: "Search for [specific query]. Focus on [decisions, patterns, gotchas, code examples]."
  subagent_type: "search-memory"
```

The agent will:
1. Search with the `memory_search` MCP tool
2. Synthesize findings (200-1000 words)
3. Return actionable insights + sources

**Saves 50-100x context vs. loading raw exchanges.**

## When to Use

You often get value from consulting memory once you understand what you're being asked. Search in these situations:

**After understanding the task:**
- User asks "how should I..." or "what's the best approach..."
- You've explored current codebase and need to make architectural decisions
- User asks for implementation approach after describing what they want

**When you're stuck:**
- You've investigated a problem and can't find the solution
- Facing a complex problem without obvious solution in current code
- Need to follow an unfamiliar workflow or process

**When historical signals are present:**
- User says "last time", "before", "we discussed", "you implemented"
- User asks "why did we...", "what was the reason..."
- User says "do you remember...", "what do we know about..."

**During lessons-learned:**
- Proposing lessons during `/shipyard:ship`

**Don't search first:**
- For current codebase structure (use Grep/Read to explore first)
- For info in current conversation
- Before understanding what you're being asked to do
- When the problem is clearly novel
- When the user explicitly wants a fresh approach

## Direct Tool Access (Discouraged)

You CAN use the `memory_search` MCP tool directly, but DON'T — it wastes your context window. Always dispatch the search-memory agent instead.

## Transparency

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
