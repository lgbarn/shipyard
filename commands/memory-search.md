---
description: "Search past conversations for relevant context"
disable-model-invocation: true
argument-hint: "<query> [--after YYYY-MM-DD] [--before YYYY-MM-DD] [--project path]"
---

# /shipyard:memory-search - Search Past Conversations

You are executing the memory search workflow. Follow these steps precisely.

<prerequisites>

## Step 1: Parse Arguments

Extract from the command:
- `query` (required): The semantic search query
- `--after` (optional): Only return results after this date
- `--before` (optional): Only return results before this date
- `--project` (optional): Filter to a specific project path

If no query is provided, ask the user what they want to search for.

## Step 2: Check Memory Enabled

Check `~/.config/shipyard/config.json` for memory settings.

- **If memory is disabled or file doesn't exist:**
  Display:
  > "Memory is not enabled. Run `/shipyard:init` and enable memory when prompted, or use `/shipyard:memory-enable` to turn it on."
  Stop here.

## Step 3: Check Project Exclusion

If `--project` is not specified, use the current working directory.

Check if the target project has `"memory": false` in `.shipyard/config.json`.

- **If excluded:**
  Display:
  > "This project has memory disabled. Results will not include exchanges from this project."
  Continue with search (will search other projects).

</prerequisites>

<execution>

## Step 4: Execute Search

Call the memory MCP server's `memory_search` tool with:
```json
{
  "query": "{query}",
  "limit": 10,
  "after": "{after_date or null}",
  "before": "{before_date or null}",
  "project": "{project_path or null}"
}
```

## Step 5: Summarize Results

If results are returned:

1. Dispatch a subagent to summarize the results (follow **Model Routing Protocol** — resolve model from `model_routing.memory`, default: haiku):
   - Extract key insights relevant to the query
   - Note any patterns or recurring solutions
   - Highlight the most relevant exchange(s)

2. Present the summary to the user:
   > "I searched memory for: **{query}**
   >
   > **Key findings:**
   > - {summary point 1}
   > - {summary point 2}
   >
   > **Most relevant exchange:** ({date}, {project})
   > {brief excerpt}
   >
   > Found {N} related exchanges from {date_range}."

If no results:
> "No relevant exchanges found in memory for: **{query}**
>
> This could mean:
> - No past conversations match this topic
> - Relevant conversations haven't been indexed yet
> - The project(s) are excluded from memory"

</execution>

<output>

## Step 6: Offer Follow-up

If results were found, offer:
> "Would you like me to:
> - Search with different terms
> - Apply these insights to the current problem
> - Show more details from a specific exchange"

</output>
