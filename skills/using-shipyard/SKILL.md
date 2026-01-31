---
name: using-shipyard
description: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
---

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## How to Access Skills

**In Claude Code:** Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to you—follow it directly. Never use the Read tool on skill files.

**In other environments:** Check your platform's documentation for how skills are loaded.

# Using Skills

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means that you should invoke the skill to check. If an invoked skill turns out to be wrong for the situation, you don't need to use it.

```dot
digraph skill_flow {
    "User message received" [shape=doublecircle];
    "Might any skill apply?" [shape=diamond];
    "Invoke Skill tool" [shape=box];
    "Announce: 'Using [skill] to [purpose]'" [shape=box];
    "Has checklist?" [shape=diamond];
    "Create TodoWrite todo per item" [shape=box];
    "Follow skill exactly" [shape=box];
    "Respond (including clarifications)" [shape=doublecircle];

    "User message received" -> "Might any skill apply?";
    "Might any skill apply?" -> "Invoke Skill tool" [label="yes, even 1%"];
    "Might any skill apply?" -> "Respond (including clarifications)" [label="definitely not"];
    "Invoke Skill tool" -> "Announce: 'Using [skill] to [purpose]'";
    "Announce: 'Using [skill] to [purpose]'" -> "Has checklist?";
    "Has checklist?" -> "Create TodoWrite todo per item" [label="yes"];
    "Has checklist?" -> "Follow skill exactly" [label="no"];
    "Create TodoWrite todo per item" -> "Follow skill exactly";
}
```

## Available Skills

Shipyard provides these 14 skills:

| Skill | Purpose |
|-------|---------|
| `shipyard:using-shipyard` | How to find and use skills (this skill) |
| `shipyard:shipyard-tdd` | TDD discipline for all implementation |
| `shipyard:shipyard-debugging` | Root cause investigation before fixes |
| `shipyard:shipyard-verification` | Evidence before completion claims |
| `shipyard:shipyard-brainstorming` | Requirements gathering and design exploration |
| `shipyard:security-audit` | OWASP, secrets, dependencies, IaC security |
| `shipyard:code-simplification` | Duplication, dead code, AI bloat detection |
| `shipyard:infrastructure-validation` | Terraform, Ansible, Docker validation workflows |
| `shipyard:parallel-dispatch` | Concurrent agent dispatch for independent tasks |
| `shipyard:shipyard-writing-plans` | Creating structured implementation plans |
| `shipyard:shipyard-executing-plans` | Executing plans with builder/reviewer agents |
| `shipyard:git-workflow` | Branch creation, commits, worktrees, and completion |
| `shipyard:documentation` | After implementation, before shipping, when docs are incomplete |
| `shipyard:shipyard-writing-skills` | Creating and testing new skills |

## Shipyard Commands

Shipyard also provides these commands:

| Command | Purpose |
|---------|---------|
| `/shipyard:init` | Initialize a project - gather requirements via brainstorming |
| `/shipyard:plan` | Create a structured implementation plan |
| `/shipyard:build` | Execute a plan with builder and reviewer agents |
| `/shipyard:status` | Check progress on current plan execution |
| `/shipyard:resume` | Resume an interrupted build |
| `/shipyard:quick` | Quick single-task execution without full planning |
| `/shipyard:ship` | Finalize work - merge, PR, or preserve |

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |

## Skill Priority

When multiple skills could apply, use this order:

1. **Process skills first** (brainstorming, debugging) - these determine HOW to approach the task
2. **Implementation skills second** (executing-plans, parallel-dispatch) - these guide execution

"Let's build X" → brainstorming first, then implementation skills.
"Fix this bug" → debugging first, then domain-specific skills.

## Skill Types

**Rigid** (TDD, debugging): Follow exactly. Don't adapt away discipline.

**Flexible** (patterns): Adapt principles to context.

The skill itself tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.
