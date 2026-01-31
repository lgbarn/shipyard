---
description: "View and manage deferred issues tracked across sessions"
disable-model-invocation: true
argument-hint: "[--add <description>] [--resolve <id>] [--list]"
---

# /shipyard:issues - Issue Tracking

You are executing the Shipyard issue tracking workflow. Follow these steps precisely.

## Step 1: Check State Exists

Check if `.shipyard/` directory exists.

- **If it does not exist:**
  Display:
  > "No Shipyard project detected. Run `/shipyard:init` to get started."
  Stop here.

## Step 2: Ensure ISSUES.md Exists

Check if `.shipyard/ISSUES.md` exists.

- **If it does not exist**, create it with this template:

```markdown
# Shipyard Issues

Deferred enhancements and non-blocking findings tracked across sessions.

## Open Issues

| ID | Severity | Source | Description | Date |
|----|----------|--------|-------------|------|

## Resolved Issues

| ID | Description | Resolved | Resolution |
|----|-------------|----------|------------|
```

## Step 3: Parse Arguments

- `--add <description>`: Add a new issue. Ask for severity (high/medium/low) if not obvious from context. Auto-increment ID from highest existing ID + 1. Set source to "manual" and date to current timestamp.
- `--resolve <id>`: Move the issue from Open to Resolved. Ask for a brief resolution note.
- `--list` (default when no arguments): Display current issues.

## Step 4: Execute Action

### For --add:

Append a new row to the Open Issues table:

```
| {next_id} | {severity} | manual | {description} | {YYYY-MM-DD} |
```

Confirm:
> "Issue #{id} added: {description}"

### For --resolve:

1. Find the issue by ID in the Open Issues table
2. Remove it from Open Issues
3. Add it to Resolved Issues with resolution timestamp and note
4. Confirm:
   > "Issue #{id} resolved: {resolution_note}"

### For --list (default):

Display issues grouped by severity:

```
Shipyard Issues
═══════════════

High Priority ({count})
  #{id}: {description} [source: {source}, {date}]

Medium Priority ({count})
  #{id}: {description} [source: {source}, {date}]

Low Priority ({count})
  #{id}: {description} [source: {source}, {date}]

Total: {open_count} open, {resolved_count} resolved
```

If no open issues exist:
> "No open issues. Clean slate!"

## Step 5: Suggest Next Action

If there are high-priority issues:
> "Consider addressing high-priority issues before your next `/shipyard:build` or `/shipyard:ship`."

If viewing issues during planning:
> "Open issues relevant to the current phase can be incorporated into `/shipyard:plan`."
