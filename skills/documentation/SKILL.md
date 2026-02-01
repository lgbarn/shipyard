---
name: documentation
description: Use when generating documentation, updating README files, writing API docs, creating architecture documentation, or when documentation is incomplete or outdated
---

<!-- TOKEN BUDGET: 160 lines / ~480 tokens -->

# Documentation Generation

Generate accurate, useful documentation that serves its audience. API docs for developers, guides for users, architecture docs for maintainers.

**The documenter agent references this skill for systematic documentation generation.**

## When to Use

- After implementing new features with public interfaces
- When making breaking changes
- When adding complex algorithms or business logic
- Before shipping a phase or milestone
- When documentation is flagged as incomplete

## Documentation Types

### 1. Code Documentation (Inline)

Document non-obvious code for developers reading the implementation.

**What to document:**
- Complex algorithms and business logic
- Non-obvious design decisions
- Workarounds and edge cases
- Performance considerations

**What NOT to document:**
```python
# BAD: Obvious
x = x + 1  # increment x

# GOOD: Explains why
# Cache invalidation here because user permissions
# affect multiple downstream services
invalidate_permission_cache(user.id)
```

**Format:** Docstrings with parameters, returns, exceptions, and examples for functions. Purpose and responsibilities for classes. Overview for modules.

### 2. API Documentation

Help developers use public interfaces correctly.

**Per endpoint/function:**
- Description (one sentence)
- Parameters with types and constraints
- Return values
- Error conditions
- At least one realistic example
- Authentication/authorization requirements (for APIs)

**Checklist:**
- [ ] All public functions/endpoints documented
- [ ] Parameter types and constraints specified
- [ ] Return values described
- [ ] Error conditions documented
- [ ] At least one example per function

### 3. Architecture Documentation

Help developers understand system design and make consistent changes.

**Components:**
- System overview with component diagram
- Each component's responsibility
- Data flow (with mermaid diagrams if complex)
- Key design decisions with rationale
- External dependencies
- Deployment architecture (for production systems)

**Checklist:**
- [ ] System overview exists
- [ ] Component responsibilities documented
- [ ] Data flow explained
- [ ] Design decisions recorded with rationale
- [ ] Dependencies listed

### 4. User Documentation

Help end-users accomplish tasks.

**Types:**
- **Getting Started:** Installation, first-run config, hello world, next steps
- **How-To Guides:** Goal-oriented, step-by-step, prerequisites, expected outcome
- **Tutorials:** Learning-oriented, guided, explains why not just how
- **Reference:** CLI commands, config options, env vars, troubleshooting

**Checklist:**
- [ ] Installation/setup instructions complete
- [ ] Getting started guide exists and works
- [ ] Major features have how-to guides
- [ ] Configuration options documented
- [ ] Troubleshooting section exists

## Quality Standards

### Clarity
- Write for the intended audience
- Use examples — one good example beats three paragraphs
- Define jargon on first use: "JWT (JSON Web Token)"

### Accuracy
- Document actual behavior, not intended behavior
- Verify code samples compile/run
- Keep examples simple and focused

### Completeness
- 100% of public APIs documented
- All user-facing features explained
- All architecture components described
- Breaking changes have migration paths

### Maintainability
- Inline docs (docstrings/comments) for implementation details
- Centralized docs (docs/ directory) for architecture and user guides
- Update docs in the same commit as code changes
- Remove deprecated documentation

## Anti-Patterns

- Documenting the obvious (`x = 5  # set x to 5`)
- Duplicating information across files
- Including example code that doesn't work
- Letting docs drift from code
- Writing novels when a sentence suffices
- Commenting out code instead of deleting it

## Integration

**Referenced by:** `shipyard:documenter` agent
**Pairs with:** `shipyard:shipyard-verification` (documentation completeness is part of "done"), `shipyard:code-simplification` (clear code needs less documentation)
