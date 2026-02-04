# Memory: Detailed Reference

This file provides additional detail for the Memory skill. Load only when needed.

## Architecture

### Storage Location
- **Database:** `~/.config/shipyard/memory.db` (SQLite + sqlite-vec)
- **Capacity:** 1 GB cap, oldest conversations pruned when limit reached
- **Embeddings:** Local via Transformers.js (all-MiniLM-L6-v2, 384 dimensions)

### Exchange Structure

Each indexed exchange contains:
```
user_message       - Full text of user message
assistant_message  - Full text of assistant response
tool_names         - Array of tool names used (e.g., ["Read", "Edit", "Bash"])
project_path       - Absolute path for filtering
timestamp          - For ordering and pruning
git_branch         - Branch at time of exchange
session_id         - Groups exchanges within a session
embedding          - 384-dim vector for semantic search
```

### What Gets Excluded

**Tool data:** Tool inputs and outputs are NOT indexed. This means file contents, command results, and API responses stay out of memory. Only the tool names are recorded to provide context about what actions were taken.

**Scrubbed secrets:** Before indexing, exchanges are scanned for:
- AWS keys: `AKIA[0-9A-Z]{16}`
- GitHub tokens: `ghp_[a-zA-Z0-9]{36}`
- Generic API keys: `[aA][pP][iI][-_]?[kK][eE][yY].*[=:]\s*['"]?[a-zA-Z0-9]{20,}`
- Private keys: `-----BEGIN.*PRIVATE KEY-----`
- Password patterns: `password\s*[=:]\s*['"]?.+['"]?`

Matched patterns are replaced with `[REDACTED]` before storage.

**Excluded projects:** Projects with `"memory": false` in `.shipyard/config.json` are completely excluded from indexing.

## MCP Server

Memory operates as an MCP server for future-proofing. The server exposes:

### memory_search

Semantic search across all indexed exchanges.

**Input:**
```json
{
  "query": "how did we handle rate limiting",
  "limit": 10,
  "after": "2026-01-01",
  "before": "2026-02-01",
  "project": "/path/to/filter"
}
```

**Output:** Array of matching exchanges with similarity scores, summarized by Haiku.

### memory_forget

Delete exchanges from a specific session.

**Input:**
```json
{
  "session_id": "abc123"
}
```

## Indexing

Indexing runs in the background every 5 minutes. It:
1. Finds new/modified JSONL files in `~/.claude/projects/`
2. Parses user/assistant exchanges
3. Scrubs secrets
4. Generates embeddings locally
5. Inserts into database

The indexer is designed to be non-blocking during active work.

## One-Time Import

When memory is first enabled, a one-time import processes existing conversation history from `~/.claude/projects/`. This can take several minutes for large histories.

The import runs in the background and does not block work. Use `/shipyard:memory-status` to check progress.

## Lessons-Learned Integration

During `/shipyard:ship`, the lessons-learned phase:

1. Calculates the milestone's date range from STATE.md history
2. Searches memory for exchanges in that timeframe for the current project
3. Haiku analyzes results to identify:
   - Debugging struggles and their resolutions
   - Approaches that were tried and rejected (and why)
   - Key decisions with their rationale
4. This context enriches the lesson suggestions
5. User reviews and approves CLAUDE.md updates

The goal is to capture implicit knowledge that would otherwise be lost between sessions.

## Storage Management

### Capacity

The 1 GB default cap can be adjusted in global config:
```json
{
  "memory_storage_cap_mb": 2048
}
```

When the cap is reached, the pruner removes oldest exchanges first. Pruning happens during the regular indexing cycle.

### Checking Status

`/shipyard:memory-status` shows:
- Total database size
- Number of indexed exchanges
- Oldest and newest exchange dates
- Projects with most exchanges
- Time since last index

### Manual Cleanup

Beyond `/shipyard:memory-forget` for current session, you can exclude a project retroactively:
1. Set `"memory": false` in `.shipyard/config.json`
2. Run `/shipyard:memory-import` to re-index (excluded project's exchanges are removed)

## Troubleshooting

### Memory not finding relevant results

- Check if the project has `"memory": false`
- Try more specific search terms
- Check date ranges with `/shipyard:memory-status`
- Wait for background indexing to complete

### Database grows too large

- Reduce `memory_storage_cap_mb` in config
- Use project-level exclusions for high-volume projects
- Check that secrets aren't being stored (they shouldn't be)

### Import seems stuck

- Check `~/.config/shipyard/memory.log` for errors
- Large histories can take time; use `/shipyard:memory-status` to monitor progress
- Ensure sufficient disk space

## Privacy Considerations

Memory is designed with privacy in mind:

1. **Local only:** All data stays on your machine
2. **Opt-in:** Prompted during `/shipyard:init`
3. **Scrubbing:** Secrets auto-redacted before storage
4. **Forgetting:** Delete any session with `/shipyard:memory-forget`
5. **Project exclusion:** Opt-out per-project
6. **No external calls:** Embeddings generated locally

The database is stored in your user config directory and is not included in any git repository.
