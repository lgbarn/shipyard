---
name: documentation
description: Use when generating documentation, updating README files, writing API docs, creating architecture documentation, or when documentation is incomplete or outdated
---

<!-- TOKEN BUDGET: 175 lines / ~525 tokens -->

# Documentation Generation

<activation>

## When to Use

- After implementing new features with public interfaces
- When making breaking changes
- When adding complex algorithms or business logic
- Before shipping a phase or milestone
- When documentation is flagged as incomplete
- When conversation mentions: document, README, API docs, changelog

## Natural Language Triggers
- "document this", "write docs", "update README", "API docs", "needs documentation"

</activation>

Generate accurate, useful documentation that serves its audience. API docs for developers, guides for users, architecture docs for maintainers.

**The documenter agent references this skill for systematic documentation generation.**

<instructions>

## Documentation Types

### 1. Code Documentation (Inline)

Document non-obvious code for developers reading the implementation.

**What to document:**
- Complex algorithms and business logic
- Non-obvious design decisions
- Workarounds and edge cases
- Performance considerations

**What NOT to document:** Anything a competent developer can understand by reading the code itself.

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

**Must include:** System overview with component diagram, each component's responsibility, data flow, key design decisions with rationale, external dependencies, deployment architecture.

**Checklist:**
- [ ] System overview exists
- [ ] Component responsibilities documented
- [ ] Data flow explained
- [ ] Design decisions recorded with rationale

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

</instructions>

<rules>

## Quality Standards

- Write for the intended audience; define jargon on first use
- Document actual behavior, not intended behavior
- Verify code samples compile/run
- 100% of public APIs documented; breaking changes have migration paths
- Update docs in the same commit as code changes
- Remove deprecated documentation

### Anti-Patterns
- Documenting the obvious (`x = 5  # set x to 5`)
- Duplicating information across files
- Including example code that doesn't work
- Letting docs drift from code
- Writing novels when a sentence suffices

</rules>

<examples>

## Documentation Output Examples

### Good: Inline code comment -- explains the "why"

```python
# Cache invalidation here because user permissions
# affect multiple downstream services. Without this,
# stale permissions persist for up to 5 minutes (TTL).
invalidate_permission_cache(user.id)
```

### Bad: Inline code comment -- restates the "what"

```python
x = x + 1  # increment x by 1
```

### Good: API function docstring -- complete, has example

```python
def create_user(name: str, email: str, role: str = "viewer") -> User:
    """Create a new user account.

    Args:
        name: Display name (1-100 characters).
        email: Must be unique across all accounts.
        role: One of "viewer", "editor", "admin". Defaults to "viewer".

    Returns:
        The newly created User object with generated ID.

    Raises:
        DuplicateEmailError: If email is already registered.

    Example:
        user = create_user("Alice", "alice@example.com", role="editor")
    """
```

### Bad: API function docstring -- no types, no detail

```python
def create_user(name, email, role="viewer"):
    """Creates a user."""
```

</examples>

## Integration

**Referenced by:** `shipyard:documenter` agent
**Pairs with:** `shipyard:shipyard-verification` (documentation completeness is part of "done"), `shipyard:code-simplification` (clear code needs less documentation)
