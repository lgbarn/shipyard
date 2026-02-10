# Anthropic Skill Authoring Best Practices

Reference companion to the TDD-focused SKILL.md. Summarized from Anthropic's official documentation at `platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices`.

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

Two fields only: `name` and `description`.

- `name`: Max 64 chars, lowercase/numbers/hyphens only, no XML tags, no reserved words ("anthropic", "claude")
- `description`: Max 1024 chars, non-empty, no XML tags, third person, includes triggering conditions (when to use)

### Naming

Gerund form preferred: `processing-pdfs`, `analyzing-spreadsheets`, `testing-code`.

Avoid: vague (`helper`, `utils`), generic (`documents`, `data`), reserved words.

### Description Writing

- Third person (injected into system prompt)
- Focus on triggering conditions (when to use). Describe the problem domain, not the skill's workflow (see CSO section in SKILL.md for why)
- Be specific with key terms for discovery

**Good:** `Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.`

**Bad:** `Helps with documents`

### Body

- Keep under 500 lines
- Use progressive disclosure: SKILL.md as overview, separate files for details
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

## Quality Checklist

### Core Quality
- [ ] Description: specific, includes key terms, what + when
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

Official documentation: [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
