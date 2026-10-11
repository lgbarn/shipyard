# Anthropic Skill Authoring Best Practices

Reference companion to the TDD-focused SKILL.md. Summarized from Anthropic's official documentation at `platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices`.

## Contents
- Core principles (conciseness, degrees of freedom, testing with all target models)
- SKILL.md structure (frontmatter, naming, descriptions, body)
- Claude Code runtime behavior
- Progressive disclosure patterns
- XML tags for prompt clarity
- Common patterns (workflows, feedback loops, templates, examples)
- Anti-patterns
- Quality checklist
- Source

## Core Principles

### Conciseness

Claude is already very smart. Only add context Claude doesn't already have.

Challenge each piece of information:
- "Does Claude really need this explanation?"
- "Can I assume Claude knows this?"
- "Does this paragraph justify its token cost?"

### Degrees of Freedom

Match specificity to task fragility:

| Freedom | When | Example |
|---------|------|---------|
| **High** (text instructions) | Multiple valid approaches, context-dependent | Code review process |
| **Medium** (pseudocode/params) | Preferred pattern exists, some variation OK | Report generation template |
| **Low** (exact scripts) | Fragile operations, consistency critical | Database migrations |

### Test With All Target Models

- **Haiku**: Does the skill provide enough guidance?
- **Sonnet**: Is the skill clear and efficient?
- **Opus**: Does the skill avoid over-explaining?

## SKILL.md Structure

### Frontmatter (YAML)

Open Agent Skills spec fields (portable to claude.ai and the Skills API): `name`, `description`, `license`, `compatibility` (max 500 chars), `metadata`, `allowed-tools`. Other fields cause a hard error when you package the skill for claude.ai or the Skills API.

- `name`: Max 64 chars, lowercase/numbers/hyphens only, no XML tags, no reserved words ("anthropic", "claude"). Claude Code defaults it to the directory name.
- `description`: Max 1024 chars, non-empty, no XML tags, third person, states what the skill does and when to use it

Claude Code accepts more optional fields:

| Field | Purpose |
|-------|---------|
| `when_to_use` | Appended to `description`; the two together are capped at 1,536 chars in the skill listing |
| `argument-hint`, `arguments` | Argument hint shown in the slash menu; named arguments |
| `disable-model-invocation` | `true` = only the user can invoke the skill (default `false`) |
| `user-invocable` | `false` = hide from the slash menu (default `true`) |
| `allowed-tools`, `disallowed-tools` | Tool permissions while the skill is active |
| `model`, `effort` | Model and reasoning effort for the skill |
| `context: fork`, `agent` | Run the skill in a forked subagent context |
| `hooks`, `paths`, `shell` | Skill-scoped hooks, path patterns, shell selection |

Malformed YAML does not fail loudly: the body loads with empty metadata, so the skill does not trigger.

### Naming

Consider gerund form: `processing-pdfs`, `analyzing-spreadsheets`, `testing-code`. Noun phrases and action-oriented names are also acceptable.

Avoid: vague (`helper`, `utils`), generic (`documents`, `data`), reserved words.

### Description Writing

- Third person (injected into system prompt)
- State what the skill does and when to use it. Put the key use case first.
- Shipyard rule (not from the Anthropic docs): do not list the workflow steps (see CSO section in SKILL.md for why)
- Be specific with key terms for discovery

**Good:** `Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.`

**Bad:** `Helps with documents`

### Body

- Keep under 500 lines
- Use progressive disclosure: SKILL.md as overview, separate files for details
- Put critical rules first (see "Claude Code Runtime Behavior")

## Claude Code Runtime Behavior

Source: [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)

- **Listing budget:** skill names and descriptions share about 1% of the context window. When the listing overflows, Claude Code drops the descriptions of the least-invoked skills first. Names always stay. Run `/doctor` to estimate the cost.
- **Plugin skills** are invoked as `/plugin-name:skill-name` (for example `/shipyard:shipyard-tdd`).
- **Precedence:** enterprise, then personal, then project skills.
- **Loaded once:** skill content is not re-read on later turns. After compaction, only the start of an invoked skill is kept. Put must-follow rules at the top, or enforce them with frontmatter `hooks`.
- **Validation:** `claude plugin validate` checks that SKILL.md files parse.
- Keep references one level deep from SKILL.md
- Add table of contents to reference files over 100 lines

## Progressive Disclosure Patterns

### Pattern 1: High-level guide with references

```markdown
# PDF Processing

## Quick start
[inline code example]

## Advanced features
**Form filling**: See [FORMS.md](FORMS.md)
**API reference**: See [REFERENCE.md](REFERENCE.md)
```

### Pattern 2: Domain-specific organization

```
bigquery-skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── finance.md
    ├── sales.md
    └── product.md
```

### Pattern 3: Conditional details

```markdown
## Creating documents
Use docx-js. See [DOCX-JS.md](DOCX-JS.md).

## Editing documents
For simple edits, modify XML directly.
**For tracked changes**: See [REDLINING.md](REDLINING.md)
```

## XML Tags for Prompt Clarity

Anthropic's prompt engineering guide recommends XML tags to structure prompts:

> "Use tags like `<instructions>`, `<example>`, and `<formatting>` to clearly separate different parts of your prompt. This prevents Claude from mixing up instructions with examples or context."

Benefits: clarity, accuracy, flexibility, parseability.

Best practices:
- Be consistent with tag names throughout
- Nest tags for hierarchical content
- No canonical "best" tag names -- use names that match the content

Shipyard convention: `<activation>`, `<instructions>`, `<examples>`, `<rules>` for skills; `<prerequisites>`, `<execution>`, `<output>` for commands; `<role>`, `<instructions>`, `<rules>` for agents.

## Common Patterns

### Workflows

Break complex operations into clear sequential steps. For complex workflows, provide a checklist Claude can track.

### Feedback Loops

Run validator, fix errors, repeat. Catches errors early with machine-verifiable intermediate outputs.

### Templates

Provide output templates. Match strictness to requirements (exact template for APIs, flexible for analysis).

### Examples

Provide input/output pairs. Examples help Claude understand desired style better than descriptions alone.

## Anti-Patterns

- Time-sensitive information (use "old patterns" section instead)
- Inconsistent terminology (pick one term, use it everywhere)
- Deeply nested references (keep one level deep)
- Too many options (provide a default with escape hatch)
- Over-explaining things Claude already knows
- Windows-style paths (always use forward slashes)
- Unexplained constants in scripts ("voodoo constants"): justify every value
- Scripts that defer errors to Claude: handle the error in the script ("solve, don't defer")
- MCP tools without a server prefix: use `ServerName:tool_name`

## Quality Checklist

### Core Quality
- [ ] Description: specific, includes key terms, what + when, key use case first
- [ ] Critical rules near the top of SKILL.md
- [ ] SKILL.md body under 500 lines
- [ ] Additional details in separate files if needed
- [ ] No time-sensitive information
- [ ] Consistent terminology throughout
- [ ] Concrete examples (not abstract)
- [ ] File references one level deep
- [ ] Progressive disclosure used appropriately
- [ ] Workflows have clear steps

### Testing
- [ ] At least three evaluations created
- [ ] Tested with target models (Haiku, Sonnet, Opus)
- [ ] Tested with real usage scenarios

## Source

Official documentation (checked 2026-10-10):

- [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
