---
name: shipyard-writing-skills
description: Use when creating, editing, or improving skills, or when a skill isn't triggering correctly. Also use when editing any SKILL.md file, writing skill descriptions, or debugging why a skill doesn't activate. Triggers on "create a skill", "write a skill", "new skill", "improve this skill", "skill isn't triggering", or when reviewing skill quality and effectiveness.
---

<!-- TOKEN BUDGET: 380 lines / ~1140 tokens -->

# Writing Skills

<activation>

## When This Skill Activates

- Creating a new skill (SKILL.md file)
- Editing or improving an existing skill
- Verifying a skill works before deployment
- Reviewing skill quality or effectiveness

## Natural Language Triggers
- "create a skill", "write a skill", "new skill", "improve this skill"

</activation>

## Overview

**Writing skills IS Test-Driven Development applied to process documentation.**

**Personal skills live in agent-specific directories (`~/.claude/skills` for Claude Code, `~/.codex/skills` for Codex)**

You write test cases (pressure scenarios with subagents), watch them fail (baseline behavior), write the skill (documentation), watch tests pass (agents comply), and refactor (close loopholes).

**Core principle:** If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing.

**REQUIRED BACKGROUND:** You MUST understand shipyard:shipyard-tdd before using this skill. That skill defines the fundamental RED-GREEN-REFACTOR cycle. This skill adapts TDD to documentation.

## What is a Skill?

A **skill** is a reference guide for proven techniques, patterns, or tools. Skills help future Claude instances find and apply effective approaches.

**Skills are:** Reusable techniques, patterns, tools, reference guides

**Skills are NOT:** Narratives about how you solved a problem once

<instructions>

## TDD Mapping for Skills

| TDD Concept | Skill Creation |
|-------------|----------------|
| **Test case** | Pressure scenario with subagent |
| **Production code** | Skill document (SKILL.md) |
| **Test fails (RED)** | Agent violates rule without skill (baseline) |
| **Test passes (GREEN)** | Agent complies with skill present |
| **Refactor** | Close loopholes while maintaining compliance |
| **Write test first** | Run baseline scenario BEFORE writing skill |
| **Watch it fail** | Document exact rationalizations agent uses |
| **Minimal code** | Write skill addressing those specific violations |
| **Watch it pass** | Verify agent now complies |
| **Refactor cycle** | Find new rationalizations -> plug -> re-verify |

The entire skill creation process follows RED-GREEN-REFACTOR.

## When to Create a Skill

**Create when:**
- Technique wasn't intuitively obvious to you
- You'd reference this again across projects
- Pattern applies broadly (not project-specific)
- Others would benefit

**Don't create for:**
- One-off solutions
- Standard practices well-documented elsewhere
- Project-specific conventions (put in CLAUDE.md)
- Mechanical constraints (if it's enforceable with regex/validation, automate it -- save documentation for judgment calls)

## Skill Types

### Technique
Concrete method with steps to follow (condition-based-waiting, root-cause-tracing)

### Pattern
Way of thinking about problems (flatten-with-flags, test-invariants)

### Reference
API docs, syntax guides, tool documentation (office docs)

## Directory Structure

```
skills/
  skill-name/
    SKILL.md              # Main reference (required)
    supporting-file.*     # Only if needed
```

**Flat namespace** - all skills in one searchable namespace

**Separate files for:**
1. **Heavy reference** (100+ lines) - API docs, comprehensive syntax
2. **Reusable tools** - Scripts, utilities, templates

**Keep inline:**
- Principles and concepts
- Code patterns (< 50 lines)
- Everything else

## SKILL.md Structure

**Frontmatter (YAML):**
- Only two fields supported: `name` and `description`
- Max 1024 characters total
- `name`: Use letters, numbers, and hyphens only (no parentheses, special chars)
- `description`: Third-person, describes ONLY when to use (NOT what it does)
  - Start with "Use when..." to focus on triggering conditions
  - Include specific symptoms, situations, and contexts
  - **NEVER summarize the skill's process or workflow** (see CSO section for why)
  - Keep under 500 characters if possible

```markdown
---
name: Skill-Name-With-Hyphens
description: Use when [specific triggering conditions and symptoms]
---

# Skill Name

## Overview
What is this? Core principle in 1-2 sentences.

## When to Use
Bullet list with SYMPTOMS and use cases
When NOT to use

## Core Pattern (for techniques/patterns)
Before/after code comparison

## Quick Reference
Table or bullets for scanning common operations

## Implementation
Inline code for simple patterns
```

## Claude Search Optimization (CSO) — Quick Reference

| Element | Rule | Example |
|---------|------|---------|
| Description | Triggering conditions only, no workflow | `"Use when tests hang waiting for async ops"` |
| Keywords | Error messages, symptoms, tool names | `"ENOTEMPTY", "flaky", "bats-core"` |
| Name | Verb-first, hyphenated | `condition-based-waiting` not `async-helpers` |
| Token budget | `<150 words` getting-started, `<500 words` others | Compress, cross-reference |
| Cross-refs | Skill name + requirement marker, no `@` links | `**REQUIRED SUB-SKILL:** Use shipyard:foo` |

**Why no `@` links:** `@` syntax force-loads files immediately, consuming context tokens you may not need yet.

**Critical CSO rule — Description = When to Use, NOT What the Skill Does:**
When a description summarizes the skill's workflow, Claude follows the description instead of reading the full skill. A description saying "code review between tasks" caused Claude to do ONE review even though the skill showed TWO stages. Keep descriptions as triggering conditions only.

## Flowchart Usage

Use flowcharts ONLY for:
- Non-obvious decision points
- Process loops where you might stop too early
- "When to use A vs B" decisions

Never use flowcharts for reference material, code examples, linear instructions, or labels without semantic meaning.

## Code Examples

**One excellent example beats many mediocre ones**

Choose most relevant language (testing → TypeScript/JS, system debug → Shell/Python, data → Python).

Good example: complete, runnable, well-commented WHY, from real scenario, ready to adapt.

Don't: implement in 5+ languages, create fill-in-the-blank templates, write contrived examples.

## File Organization

| Pattern | Structure | When |
|---------|-----------|------|
| Self-contained | `SKILL.md` only | All content fits |
| With reusable tool | `SKILL.md` + `example.ts` | Tool is reusable code |
| With heavy reference | `SKILL.md` + `ref.md` + `scripts/` | Reference too large for inline |

</instructions>

<examples>

## CSO Description Examples

<example type="good" title="Triggering conditions only, no workflow summary">
```yaml
description: Use when executing implementation plans with independent tasks in the current session
```
Just triggering conditions -- Claude reads the full skill to learn the workflow.
</example>

<example type="bad" title="Workflow summary in description">
```yaml
description: Use when executing plans - dispatches subagent per task with code review between tasks
```
Summarizes workflow -- Claude follows description instead of reading skill body, misses two-stage review.
</example>

## Skill Content Examples

<example type="good" title="Well-structured skill with XML tags and clear activation">
```markdown
---
name: condition-based-waiting
description: Use when tests need to wait for async operations, processes, or state changes instead of using arbitrary sleep/timeouts
---

<activation>
## When This Skill Activates
- Tests using sleep(), setTimeout(), or fixed delays
- Flaky tests that pass/fail based on timing
- Waiting for processes, servers, or async state
</activation>

<instructions>
## Core Pattern
Poll for condition instead of sleeping...
</instructions>

<rules>
## Never
- Use fixed sleep() in tests
- Assume operation completes in N seconds
</rules>
```
Clear activation, XML structure, rules separated.
</example>

<example type="bad" title="Missing structure, narrative style">
```markdown
# Waiting in Tests

Last week I was working on a project where tests were flaky. I found that
using sleep(5) was unreliable. After some experimentation, I discovered
that polling for conditions works better...
```
Narrative style, no activation triggers, no XML structure, not reusable.
</example>

</examples>

<rules>

## The Iron Law (Same as TDD)

```
NO SKILL WITHOUT A FAILING TEST FIRST
```

This applies to NEW skills AND EDITS to existing skills.

Write skill before testing? Delete it. Start over.
Edit skill without testing? Same violation.

**No exceptions:**
- Not for "simple additions"
- Not for "just adding a section"
- Not for "documentation updates"
- Don't keep untested changes as "reference"
- Don't "adapt" while running tests
- Delete means delete

**Spirit vs. Letter:** Technically having a test scenario counts as "testing" only if you watched it fail first. Running a test after writing the skill is not RED-GREEN — it's just GREEN. Always establish a failing baseline first.

**REQUIRED BACKGROUND:** The shipyard:shipyard-tdd skill explains why this matters.

## Testing All Skill Types

| Skill Type | Test Approach | Pass Condition |
|-----------|--------------|----------------|
| Discipline-Enforcing | Pressure scenarios (time + sunk cost + exhaustion combined) | Agent follows rule under maximum pressure |
| Technique | Application scenarios + edge-case variations | Agent applies technique correctly to new scenarios |
| Pattern | Recognition + application + counter-examples | Agent identifies when/how AND when NOT to apply |
| Reference | Retrieval tasks + coverage gaps | Agent finds and correctly applies reference info |

## Common Rationalizations for Skipping Testing

| Excuse | Reality |
|--------|---------|
| "Skill is obviously clear" | Clear to you ≠ clear to other agents. Test it. |
| "Testing is overkill" | Untested skills have issues. Always. 15 min saves hours. |
| "Academic review is enough" | Reading ≠ using. Test application scenarios. |
| "No time to test" | Deploying untested wastes more time fixing later. |

## Bulletproofing Skills Against Rationalization

Discipline skills must resist rationalization:

1. **Close every loophole explicitly** -- forbid specific workarounds with "No exceptions" lists
2. **Address "Spirit vs Letter"** -- add early: violating the letter violates the spirit
3. **Build rationalization tables** from baseline testing -- every excuse gets a counter
4. **Create red flags lists** for agent self-check (e.g., "Code before test", "This is different because...")
5. **Update CSO descriptions** with violation symptoms as triggers

## Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Narrative example | "Last week I found that..." | Rewrite as reusable pattern |
| Multi-language dilution | Same example in 5 languages | Keep only most relevant language |
| Code in flowcharts | Can't copy-paste, hard to read | Use markdown code blocks |
| Generic labels | `helper1`, `step3` have no meaning | Use descriptive names |

</rules>

## RED-GREEN-REFACTOR for Skills

### RED: Write Failing Test (Baseline)

Run pressure scenario with subagent WITHOUT the skill. Document exact behavior:
- What choices did they make?
- What rationalizations did they use (verbatim)?
- Which pressures triggered violations?

This is "watch the test fail" - you must see what agents naturally do before writing the skill.

### GREEN: Write Minimal Skill

Write skill that addresses those specific rationalizations. Don't add extra content for hypothetical cases.

Run same scenarios WITH skill. Agent should now comply.

### REFACTOR: Close Loopholes

Agent found new rationalization? Add explicit counter. Re-test until bulletproof.

## Skill Creation Checklist (TDD Adapted)

**Use TaskCreate to create tasks for EACH item below.**

**RED:** Create pressure scenarios (3+ for discipline skills) -- run WITHOUT skill -- document baseline rationalizations

**GREEN:**
- [ ] Name: letters/numbers/hyphens only; YAML frontmatter (name + description, max 1024 chars)
- [ ] Description: "Use when..." + triggers/symptoms, third person, no workflow summary
- [ ] Keywords for search, clear overview, address baseline failures from RED
- [ ] Code inline or linked; one excellent example (not multi-language)
- [ ] Run WITH skill -- verify compliance

**REFACTOR:** Find new rationalizations -- add counters -- build rationalization table + red flags -- re-test until bulletproof

**Quality:** Flowcharts only for non-obvious decisions; quick reference table; common mistakes; no narrative; supporting files only for tools/heavy reference

**Deploy:** Commit and push; consider contributing via PR if broadly useful

## Discovery Workflow

How future Claude finds your skill:

1. **Encounters problem** ("tests are flaky")
2. **Finds SKILL** (description matches)
3. **Scans overview** (is this relevant?)
4. **Reads patterns** (quick reference table)
5. **Loads example** (only when implementing)

**Optimize for this flow** - put searchable terms early and often.

## STOP: Before Moving to Next Skill

**After writing ANY skill, you MUST STOP and complete the deployment process.**

**Do NOT:**
- Create multiple skills in batch without testing each
- Move to next skill before current one is verified
- Skip testing because "batching is more efficient"

**The deployment checklist above is MANDATORY for EACH skill.**

Deploying untested skills = deploying untested code.

## Integration

**Called by:** shipyard:shipyard-brainstorming — when new skill patterns are identified during brainstorming
**Pairs with:** shipyard:shipyard-tdd — RED-GREEN-REFACTOR cycle applies to skill creation
**Leads to:** shipyard:shipyard-verification — verify skill triggers and works before deploying
