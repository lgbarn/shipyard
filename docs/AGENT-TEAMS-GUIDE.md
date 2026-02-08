# Agent Teams & Custom Agents Guide

A reference for using Claude Code's experimental agent teams feature with custom agents — including `--teammate-mode tmux`, defining specialized agents, writing workflow skills, and coordinating parallel work.

**Official Anthropic documentation:**
- [Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [Custom Subagents](https://code.claude.com/docs/en/sub-agents)
- [Skills](https://code.claude.com/docs/en/skills)
- [Hooks](https://code.claude.com/docs/en/hooks)
- [Token Costs](https://code.claude.com/docs/en/costs#agent-team-token-costs)

---

## 1. Enable Agent Teams

Agent teams are experimental and disabled by default. Enable them in `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Or set the environment variable directly:

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

---

## 2. Teammate Display Modes

The `--teammate-mode` flag controls how teammates appear in your terminal.

### `auto` (default)

Uses tmux split panes if you're already in a tmux session, otherwise falls back to in-process.

```bash
claude
```

### `in-process`

All teammates run in your main terminal. No extra tools required.

```bash
claude --teammate-mode in-process
```

**Keyboard shortcuts:**

| Shortcut | Action |
|----------|--------|
| Shift+Up/Down | Cycle through active teammates |
| Shift+Tab | Toggle delegate mode (lead uses coordination-only tools) |
| Ctrl+T | Show/hide shared task list |
| Ctrl+B | Background a running task |
| Enter | View a teammate's full session |
| Escape | Interrupt and return to overview |

### `tmux` / `split-panes`

Each teammate gets its own split pane — all visible simultaneously. Click a pane to interact with that teammate directly.

```bash
claude --teammate-mode tmux
```

**How it works:** Claude Code uses tmux commands (`tmux split-pane`, `tmux list-panes`, etc.) to create and manage teammate panes. It detects tmux via the `$TMUX` environment variable. Since tmux is a terminal multiplexer that runs *inside* your terminal emulator, this works in any terminal that can run tmux.

**Install tmux:**

```bash
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt install tmux
```

**Start a tmux session, then launch Claude:**

```bash
tmux new-session
claude --teammate-mode tmux
```

**Compatible terminal emulators** (any terminal that runs tmux works):

| Terminal | Status | Notes |
|----------|--------|-------|
| **Ghostty** | Works via tmux | Known issue: Shift+Enter key mapping ([#17168](https://github.com/anthropics/claude-code/issues/17168)) |
| **WezTerm** | Works via tmux | Also has native pane CLI (`wezterm cli split-pane`) — native support requested ([#23574](https://github.com/anthropics/claude-code/issues/23574)) |
| **Kitty** | Works via tmux | Has remote control API (`kitten @`) but no native Claude Code integration yet |
| **Alacritty** | Works via tmux | No built-in multiplexing — tmux is the standard approach |
| **iTerm2** | Works via tmux | Also has a native alternative path via `it2` CLI + Python API |
| **macOS Terminal** | Works via tmux | |
| **GNOME Terminal** | Works via tmux | |

**Terminals where tmux is NOT available:**

| Terminal | Workaround |
|----------|-----------|
| VS Code integrated terminal | Use `in-process` mode |
| Windows Terminal (without WSL) | Use `in-process` mode |

**Alternative: iTerm2 native panes (macOS only)**

iTerm2 can manage panes without tmux using its Python API. This is an alternative path, not a requirement:

```bash
npm install -g it2
# Enable Python API: iTerm2 → Settings → General → Magic → Enable Python API
```

**Set tmux mode as default** in `~/.claude/settings.json`:

```json
{
  "teammateMode": "tmux"
}
```

**tmux pane navigation:** `Ctrl+b` then arrow keys to switch panes, or click a pane if your terminal supports mouse passthrough to tmux.

---

## 3. Custom Agent Definitions

Custom agents are markdown files with YAML frontmatter that define specialized roles. Claude reads these to decide when and how to delegate work.

### File Locations

| Scope | Path | Notes |
|-------|------|-------|
| Project-level | `.claude/agents/*.md` | Check into git, shared with team |
| Global (all projects) | `~/.claude/agents/*.md` | Personal, applies everywhere |
| Plugin-provided | `agents/*.md` (in a plugin) | Available where plugin is enabled |
| Session-only | `--agents '{...}'` CLI flag | JSON format, not persisted |

### Complete Frontmatter Schema

```yaml
---
name: agent-name              # Required. Lowercase letters and hyphens only (max 64 chars).
description: |                 # Required. Claude reads this to decide when to delegate.
  Use this agent when [trigger conditions].
  Examples: <example>...</example>
model: sonnet                  # Optional. opus | sonnet | haiku | inherit (default: inherit)
tools: Read, Grep, Glob, Bash # Optional. Allowlist — only these tools available.
disallowedTools: WebSearch     # Optional. Denylist — these tools blocked.
permissionMode: default        # Optional. default | acceptEdits | delegate | dontAsk | bypassPermissions | plan
skills:                        # Optional. Preload these skills at startup.
  - skill-name-1
  - skill-name-2
maxTurns: 10                   # Optional. Max agentic iterations before stopping.
mcpServers:                    # Optional. MCP servers available to this agent.
  - server-name
memory: user                   # Optional. Persistent memory: user | project | local
hooks:                         # Optional. Lifecycle hooks (PreToolUse, PostToolUse, Stop).
  PreToolUse:
    - matcher: Bash
      command: "echo 'about to run bash'"
---
```

### Key Fields Explained

**`name`** — Unique identifier. Lowercase letters and hyphens only, max 64 characters. This is what you pass as `subagent_type` when spawning.

**`description`** — The routing instruction. Claude uses it to decide whether to delegate a task to this agent. Write it like a usage guide with concrete trigger conditions and examples. This is the most important field for agent discovery.

**`model`** — Controls cost/capability tradeoff:
- `opus` — Complex reasoning, architectural decisions, research
- `sonnet` — Fast implementation, code generation, routine tasks
- `haiku` — Quick lookups, simple transformations, low-cost work
- `inherit` — Use whatever model the parent session is using (default)

**`tools`** — Allowlist restricting what the agent can do. A research agent might only get `Read, Grep, Glob, WebSearch, WebFetch`. An implementation agent gets everything. If omitted, the agent gets all tools.

**`disallowedTools`** — Denylist for specific tools. Use this instead of `tools` when you only need to block a few things.

**`permissionMode`** — Controls permission prompts:
- `default` — Ask user for each tool call
- `acceptEdits` — Auto-approve file edits, ask for everything else
- `delegate` — Agent can delegate to other agents
- `dontAsk` — Auto-approve everything (use carefully)
- `bypassPermissions` — Skip all permission checks (dangerous)
- `plan` — Agent must create a plan and get approval before executing

**`memory`** — Persistent knowledge that survives across sessions:
- `user` — Stored at `~/.claude/agent-memory/<name>/` (cross-project)
- `project` — Stored at `.claude/agent-memory/<name>/` (in version control)
- `local` — Stored at `.claude/agent-memory-local/<name>/` (not in git)

**`hooks`** — Lifecycle hooks that run shell commands at specific points:
- `PreToolUse` — Before a tool executes (can block with exit code 2)
- `PostToolUse` — After a tool executes
- `Stop` — When the agent finishes (converted to `SubagentStop` event)

### System Prompt (Body)

The markdown body after the frontmatter is the agent's system prompt. Structure it with:

- **`<role>`** — Who the agent is and what expertise it has
- **`<instructions>`** — Step-by-step protocol the agent follows
- **`<rules>`** — Hard constraints and role boundaries (what it MUST NOT do)
- **`<examples>`** — Good and bad examples of behavior

### CLI-Defined Agents (Session Only)

For quick, one-off agents without creating files:

```bash
claude --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer",
    "prompt": "You are a senior engineer doing code review...",
    "tools": ["Read", "Grep"],
    "model": "sonnet",
    "permissionMode": "default",
    "maxTurns": 10
  }
}'
```

---

## 4. Built-in Subagent Types

Claude Code ships with these built-in agents (always available):

| Name | Model | Tools | Purpose |
|------|-------|-------|---------|
| `Explore` | haiku | Read-only (no Edit/Write) | Fast codebase search |
| `Plan` | inherit | Read-only (no Edit/Write) | Design implementation approaches |
| `general-purpose` | inherit | All tools | Complex multi-step tasks |
| `Bash` | inherit | Bash only | Terminal command execution |
| `statusline-setup` | sonnet | Read, Edit | Status line configuration |
| `claude-code-guide` | haiku | Read-only + Web | Help and documentation questions |

Your custom agents appear alongside these and can be selected via `subagent_type`.

---

## 5. Example: Creating a Custom Agent

Here's a complete security reviewer agent:

```markdown
<!-- File: .claude/agents/security-reviewer.md -->
---
name: security-reviewer
description: |
  Use this agent when reviewing code for security vulnerabilities,
  authentication issues, or data protection concerns.
model: sonnet
tools: Read, Grep, Glob, Bash
permissionMode: default
maxTurns: 15
---

<role>
You are a security engineer specializing in application security.
You have deep expertise in OWASP Top 10, authentication patterns,
and secure coding practices.
</role>

<instructions>
1. Read the target files to understand the code structure
2. Check for OWASP Top 10 vulnerabilities (injection, XSS, CSRF, etc.)
3. Review authentication and authorization logic
4. Inspect input validation and output encoding
5. Look for hardcoded credentials or secrets
6. Audit session management and token handling
7. Produce a structured findings report
</instructions>

<rules>
You are a review-only agent. You MUST NOT:
- Edit or write any source code
- Create git commits
- Modify configuration files

Your deliverable is a security findings report. You investigate and
report — you do not fix.
</rules>
```

### Minimal Agent (Just the Essentials)

```markdown
<!-- File: .claude/agents/test-runner.md -->
---
name: test-runner
description: Use this agent to run test suites and report results.
model: haiku
tools: Read, Bash, Glob
---

Run the project's test suite. Report pass/fail counts and any
failure details. Do not modify code.
```

---

## 6. How Teams Use Custom Agents

When Claude creates a team, each teammate is a full Claude Code session. The `Task` tool connects agents to teams:

```
Task tool parameters:
  - subagent_type: "security-reviewer"   # Which agent definition to use
  - team_name: "my-project"              # Which team to join
  - name: "sec-review"                   # Teammate's display name
  - prompt: "Review auth module..."      # The task to perform
  - mode: "plan"                         # Optional: require plan approval first
  - run_in_background: true              # Optional: run concurrently
```

### What Happens at Spawn

1. Claude reads the agent's `.md` file for system prompt and configuration
2. A new Claude Code session starts with that agent's tools, model, and permissions
3. The teammate joins the team's shared task list
4. The teammate loads project context (CLAUDE.md, skills, MCP servers)
5. The teammate receives the prompt and begins working
6. Communication happens via direct messages and task list updates

**Important:** Teammates do NOT inherit the lead's conversation history. Include task-specific context in the spawn prompt.

### Foreground vs Background Agents

- **Foreground** (default): Blocks until complete. Permission prompts pass through to user.
- **Background** (`run_in_background: true`): Runs concurrently. Pre-approve permissions upfront since prompts can't interrupt. No MCP tools available in background mode.

Press **Ctrl+B** to background a running foreground task.

### Team Coordination

Teams share two resources:

**Task List** (`~/.claude/tasks/{team-name}/`):
- Any teammate can create, claim, or complete tasks
- Tasks can have dependencies (blockedBy/blocks)
- States: pending → in_progress → completed
- File-level locking prevents concurrent corruption

**Mailbox** (automatic):
- Teammates send messages with `SendMessage`
- Messages are delivered automatically — no polling
- Team lead sees all activity
- Peer DM summaries included in idle notifications

### Team Config

Located at `~/.claude/teams/{team-name}/config.json`, contains:

```json
{
  "members": [
    {
      "name": "sec-review",
      "agentId": "abc-123",
      "agentType": "security-reviewer"
    }
  ]
}
```

Always refer to teammates by `name`, not `agentId`.

---

## 7. Team Workflow

### Step-by-Step

```
1. Create a team        → TeamCreate { team_name: "feature-x" }
2. Create tasks         → TaskCreate { subject: "Review auth", ... }
3. Spawn teammates      → Task { subagent_type: "security-reviewer",
                                  team_name: "feature-x",
                                  name: "sec-review",
                                  prompt: "..." }
4. Assign tasks         → TaskUpdate { taskId: "1", owner: "sec-review" }
5. Teammates work       → (automatic — they claim and complete tasks)
6. Monitor progress     → TaskList, or Shift+Up/Down to check teammates
7. Shutdown teammates   → SendMessage { type: "shutdown_request",
                                        recipient: "sec-review" }
8. Delete team          → TeamDelete
```

### Example: Parallel Feature Development

```
You: "Build a REST API with auth and tests. Use a team."

Claude creates:
  Team: "rest-api"

  Teammates:
    - "api-builder"    (subagent_type: builder)     → implements endpoints
    - "auth-builder"   (subagent_type: builder)     → implements auth middleware
    - "test-writer"    (subagent_type: test-runner)  → writes and runs tests

  Task list:
    #1 "Implement CRUD endpoints"        → owner: api-builder
    #2 "Implement JWT auth middleware"    → owner: auth-builder
    #3 "Write integration tests"         → owner: test-writer (blockedBy: #1, #2)
```

### Team Hook Events

Two hook events are specific to teams:

**`TeammateIdle`** — Fires when a teammate is about to go idle:
- Exit 0: Allow idle
- Exit 2: Block with feedback (e.g., "tests must pass before stopping")

**`TaskCompleted`** — Fires when a task is marked complete:
- Exit 0: Allow completion
- Exit 2: Block with feedback (e.g., "no verification evidence found")

---

## 8. Subagents vs Agent Teams

| Aspect | Subagents (Task tool) | Agent Teams |
|--------|----------------------|-------------|
| Context | Isolated — gets only the prompt | Full Claude Code session with project context |
| Communication | Returns result to caller only | Teammates message each other directly |
| Coordination | Parent manages all work | Shared task list with self-coordination |
| Visibility | Results summarized back | Each teammate visible in its own pane (tmux) |
| Cost | Lower — results compressed | Higher — separate API session per teammate |
| Session resume | Yes — can resume with agent ID | No — `/resume` doesn't restore teammates |
| Best for | Focused tasks (research, review) | Parallel work with cross-cutting concerns |
| Custom agents | Yes — `subagent_type` selects `.md` file | Yes — teammates are spawned with a `subagent_type` |
| File conflicts | Unlikely (isolated context) | Possible — assign different files to each teammate |

### When to Use Which

**Use subagents** when:
- The task is self-contained (research a topic, review a file)
- You need the result back in your current session
- Cost matters — subagents are cheaper
- You want to resume the agent later

**Use agent teams** when:
- Multiple people need to work on different files simultaneously
- Tasks have dependencies and require coordination
- You want to watch progress in real-time (tmux mode)
- Teammates need to communicate and share findings

---

## 9. Writing a Custom Workflow Skill

Skills teach Claude domain-specific workflows. You can write a skill that defines your own team coordination patterns.

### Skill File Structure

```
.claude/skills/my-workflow/
├── SKILL.md              # Required — main skill file
├── reference.md          # Optional — heavy reference material
└── templates/            # Optional — reusable templates
    └── task-template.md
```

Or for global skills: `~/.claude/skills/my-workflow/SKILL.md`

### Skill Frontmatter

```yaml
---
name: my-team-workflow
description: Use when [specific triggering conditions — NOT workflow summary].
argument-hint: "[project-name]"       # Optional. Autocomplete hint.
disable-model-invocation: false       # Optional. true = manual-only (/slash command).
user-invocable: true                  # Optional. false = Claude-only (background knowledge).
allowed-tools: Bash, Read             # Optional. Tools that skip permission prompts.
model: sonnet                         # Optional. Model to use when skill is active.
context: fork                         # Optional. "fork" = run in isolated subagent.
agent: general-purpose                # Optional. Which agent for context: fork.
---
```

### Skill Body Structure

```markdown
# My Team Workflow

<activation>
## When This Skill Activates
- Specific triggering condition 1
- Specific triggering condition 2
- When the user says "[keyword]"
</activation>

<instructions>
## Phase 1: Setup
[Steps to initialize the workflow]

## Phase 2: Execution
[Core workflow steps]

### Solo Mode
[What to do when working alone — dispatch subagents, etc.]

### Teammate Mode
When running as a teammate in an agent team:
- Execute work directly instead of dispatching sub-subagents
- Report via TaskUpdate with task metadata
- Respect TeammateIdle and TaskCompleted hooks
- Do NOT update shared project state files — only the lead does that

## Phase 3: Completion
[How to wrap up — merge results, verify, etc.]
</instructions>

<rules>
## Hard Constraints
- Never do X
- Always verify before claiming done
</rules>

<examples>
<example type="good" title="Proper coordination">
[Working example of the workflow]
</example>

<example type="bad" title="Common mistake">
[Anti-pattern to avoid]
</example>
</examples>
```

### Key Skill Design Principles

**Description field is for triggering conditions only.** Don't summarize the workflow in the description — Claude may shortcut the full skill body and just follow the description. Write: "Use when coordinating parallel security review across 3+ modules" not "Dispatches security reviewers and merges findings."

**Dynamic context injection** — embed live data:

```markdown
## Current Project State
!`cat .shipyard/STATE.json 2>/dev/null || echo "No state file"`

## Recent Changes
!`git log --oneline -5`
```

The `` !`command` `` syntax runs a shell command and injects the output before Claude sees the skill content.

**String substitutions** — accept arguments:

```markdown
## Target Module
Reviewing: $ARGUMENTS

## Specific File
Focus on: $1
```

Invoked as `/my-workflow src/auth` — `$ARGUMENTS` becomes `src/auth`, `$1` becomes `src/auth`.

### Example: Custom Team Review Workflow Skill

```markdown
<!-- File: .claude/skills/team-review/SKILL.md -->
---
name: team-review
description: Use when reviewing a feature branch with multiple reviewers working in parallel on different concerns.
argument-hint: "[branch-name]"
---

# Team Review Workflow

<activation>
## When This Skill Activates
- User wants parallel code review from multiple perspectives
- A feature branch needs security + performance + correctness review
- User invokes /team-review
</activation>

<instructions>

## Step 1: Analyze the Branch

Get the diff and understand what changed:

!`git diff main...HEAD --stat 2>/dev/null || echo "Not on a feature branch"`

## Step 2: Create the Review Team

Create a team with specialized reviewers:

1. **security-reviewer** — checks for vulnerabilities, auth issues, input validation
2. **perf-reviewer** — checks for N+1 queries, unnecessary allocations, missing indexes
3. **correctness-reviewer** — checks for logic bugs, edge cases, missing error handling

Each reviewer gets the diff and their specific review checklist.

## Step 3: Merge Findings

After all reviewers complete:
1. Collect findings from each reviewer's task metadata
2. Deduplicate overlapping concerns
3. Prioritize: Critical → High → Medium → Low
4. Present unified review report

## Step 4: Create Action Items

For each finding, create a task:
- Description of the issue
- File and line number
- Suggested fix
- Severity level

</instructions>

<rules>
- Reviewers MUST NOT edit code — review only
- All findings must cite specific file:line references
- Security findings are always Critical or High priority
</rules>
```

### Skill Invocation

Users invoke skills with a slash command:

```
/team-review feature/add-auth
```

Claude can also invoke skills automatically based on the `description` field — unless `disable-model-invocation: true` is set.

---

## 10. Best Practices

### Writing Good Agent Descriptions

The `description` field is how Claude routes work. Be specific:

```yaml
# Good — clear trigger conditions with examples
description: |
  Use this agent when reviewing code for security vulnerabilities,
  before claiming security posture is adequate, or when working with
  authentication, authorization, or cryptographic code.

# Bad — too vague
description: Reviews code for problems.
```

### Role Boundaries

Define what an agent MUST NOT do. This prevents agents from stepping on each other:

```markdown
<rules>
You are a review-only agent. You MUST NOT:
- Edit source code (that's the builder's job)
- Create plans (that's the architect's job)
- Run deployments (that's the ops agent's job)
</rules>
```

### Model Selection

| Role | Recommended Model | Rationale |
|------|------------------|-----------|
| Architect / Planner | opus | Complex reasoning, tradeoff analysis |
| Builder / Implementer | sonnet | Fast code generation, good enough reasoning |
| Reviewer / Auditor | sonnet | Reads and analyzes, moderate reasoning needed |
| Researcher | sonnet | Web search + synthesis |
| Test runner | haiku | Runs commands, reports output — minimal reasoning |

### Avoiding File Conflicts in Teams

Two teammates editing the same file will overwrite each other. Strategies:

1. **Partition by file** — assign different files to each teammate
2. **Sequential dependencies** — use `blockedBy` so one finishes before the other starts
3. **Git worktrees** — each teammate works in a separate worktree (advanced)

### Team Size

- 2-3 teammates is the sweet spot for most tasks
- More teammates = more coordination overhead and API cost
- Each teammate is a separate Claude session billed independently

### Pre-approve Permissions for Teams

Avoid permission prompt interruptions by pre-approving common operations:

```json
{
  "permissions": {
    "allow": [
      "Bash(git *)",
      "Read",
      "Grep",
      "Glob"
    ]
  }
}
```

---

## 11. Known Limitations

- No session resumption with in-process teammates (`/resume` won't restore them)
- Task status can lag — teammates sometimes fail to mark tasks completed
- Shutdown is slow — teammates finish their current request before stopping
- One team per session — can't manage multiple teams simultaneously
- No nested teams — teammates cannot spawn their own teams
- Lead is fixed — can't promote a teammate to lead
- Split panes require tmux (works in any terminal) or iTerm2 native panes — not available in VS Code integrated terminal or Windows Terminal without WSL
- Permissions set at spawn — all teammates start with the lead's permission mode

---

## 12. Quick Reference

```bash
# Start with tmux split panes
claude --teammate-mode tmux

# Start with in-process mode
claude --teammate-mode in-process

# Set default mode permanently (~/.claude/settings.json)
# { "teammateMode": "tmux" }

# Create a custom agent
# Project: .claude/agents/my-agent.md
# Global:  ~/.claude/agents/my-agent.md

# Create a custom skill
# Project: .claude/skills/my-skill/SKILL.md
# Global:  ~/.claude/skills/my-skill/SKILL.md

# Session-only agent via CLI
claude --agents '{"my-agent": {"description": "...", "prompt": "...", "tools": ["Read"]}}'
```

### Agent File Template

```markdown
---
name: my-agent
description: |
  Use this agent when [specific trigger conditions].
model: sonnet
tools: Read, Edit, Bash, Grep, Glob
permissionMode: default
maxTurns: 15
---

<role>
You are a [specialization] expert.
</role>

<instructions>
1. [Step-by-step protocol]
</instructions>

<rules>
You MUST NOT:
- [Hard constraint 1]
- [Hard constraint 2]
</rules>
```

### Skill File Template

```markdown
---
name: my-skill
description: Use when [triggering conditions only — not workflow summary].
---

# My Skill

<activation>
## When This Skill Activates
- [Triggering condition 1]
- [Triggering condition 2]
</activation>

<instructions>
## Step 1: [Phase Name]
[Steps]

## Step 2: [Phase Name]
[Steps]
</instructions>

<rules>
- [Hard constraint]
</rules>
```
