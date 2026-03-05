---
name: documentation
description: Use when shipping features with public interfaces that lack docs, generating documentation, updating README files, writing API docs, creating architecture documentation, or when documentation is incomplete or outdated. Also use when adding breaking changes, implementing complex algorithms, or before shipping any phase — if a public function lacks a docstring, this skill applies.
---

<!-- TOKEN BUDGET: 290 lines / ~870 tokens -->

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

## When NOT to Use

- Internal helper functions not part of any public interface
- Generated code (auto-generated files, protobuf outputs, migrations)
- Throwaway prototypes, scripts, or spike code
- Trivial one-liners where the code IS the documentation

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

**HOW — step by step:**
1. Read the function/class from the consumer's perspective
2. Ask: "Would a senior dev understand WHY this exists?" If no, add a comment
3. For public functions: write docstring with parameters, returns, exceptions, and at least one example
4. For classes: write purpose + responsibilities in one paragraph
5. For modules: write one-line overview at the top

**Format:** Docstrings with parameters, returns, exceptions, and examples for functions. Purpose and responsibilities for classes. Overview for modules.

### 2. API Documentation

Help developers use public interfaces correctly.

**HOW — step by step:**
1. List every public endpoint/function in the module
2. For each: write description (one sentence max), then parameters with types + constraints
3. Document return values and all error conditions
4. Write at least one realistic example per function
5. For HTTP APIs: add authentication/authorization requirements
6. Run every example to verify it works

**Checklist:**
- [ ] All public functions/endpoints documented
- [ ] Parameter types and constraints specified
- [ ] Return values described with error conditions
- [ ] At least one working example per function
- [ ] Auth requirements noted for HTTP APIs

### 3. Architecture Documentation

Help developers understand system design and make consistent changes.

**HOW — step by step:**
1. Draw (or describe) the component diagram first — boxes and arrows
2. For each component: one sentence on what it does, one on what it does NOT do
3. Document data flow: where data enters, how it transforms, where it exits
4. For each key design decision: record the decision, why it was chosen, alternatives rejected
5. List all external dependencies with version constraints
6. Document deployment topology (single box, microservices, cloud regions)

**Architecture doc example:**

```markdown
## Components

| Component | Responsibility | Does NOT handle |
|-----------|---------------|-----------------|
| API Gateway | Route requests, auth validation | Business logic |
| User Service | CRUD user accounts | Billing, permissions |
| Notification Worker | Send emails/SMS async | Template rendering |

## Key Decision: Event-Driven vs. Synchronous

**Decision:** Use async events for cross-service communication
**Rationale:** Decouples services; allows independent scaling
**Rejected:** Direct HTTP calls — too much coupling, cascading failures
```

**Checklist:**
- [ ] System overview exists
- [ ] Component responsibilities documented
- [ ] Data flow explained
- [ ] Design decisions recorded with rationale

### 4. User Documentation

Help end-users accomplish tasks.

**HOW — step by step:**
1. Identify the user's goal (not the feature name)
2. List prerequisites (what must already be installed/configured)
3. Write steps numbered sequentially — one action per step
4. Show expected output after each step
5. Add a "What if it fails?" section for common errors
6. Test the guide yourself from scratch

**User guide example:**

```markdown
## How to Set Up Webhook Notifications

**Prerequisites:** Admin account, HTTPS endpoint that accepts POST requests

1. Go to Settings → Integrations → Webhooks
2. Click **Add Webhook**
3. Enter your endpoint URL (must start with `https://`)
4. Select events to subscribe to (e.g., `user.created`, `order.paid`)
5. Click **Save** — a test ping is sent to your endpoint immediately

**Expected:** Your endpoint receives a `POST` with `{"event": "test.ping"}`

**If it fails:** Check that your endpoint returns HTTP 200. Non-200 responses
are retried 3 times then marked failed.
```

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

## Iron Law

```
NEVER SHIP A PUBLIC API WITHOUT DOCSTRINGS
```

No exceptions:
- Not for "simple" functions
- Not for "internal-but-public" interfaces
- Not for "obvious" parameter names
- Not for "we'll add docs later"

## Quality Standards

- Write for the intended audience; define jargon on first use
- Document actual behavior, not intended behavior
- Verify code samples compile/run
- 100% of public APIs documented; breaking changes have migration paths
- Update docs in the same commit as code changes
- Remove deprecated documentation

**Spirit vs. Letter:** Technically having a docstring that says "Creates a user" satisfies the letter but violates the spirit. Documentation must enable a developer to use the interface without reading the implementation.

## Red Flags

Stop and fix before shipping:
- Public function with no docstring, or docstring that only restates the function name
- Example code that throws an error when run
- `TODO:` inside documentation ("TODO: document this parameter")
- Architecture doc that records WHAT was decided but not WHY
- User guide with steps but no expected output

## AI-Specific Documentation Pitfalls

| Pitfall | Example | Fix |
|---------|---------|-----|
| Over-commenting obvious code | `x += 1  # increment x` | Delete the comment |
| Redundant docstrings | `def get_user():` → `"""Gets a user."""` | Add args, returns, raises, example |
| Missing "why" | Documents WHAT the code does, not WHY | Add rationale for non-obvious choices |
| Hallucinated examples | Example calls function with wrong signature | Run every example before committing |
| Template docs | Copies docstring structure without real content | Verify every field has actual values |

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "It's obvious from the name" | Obvious names still need types, return values, and error conditions |
| "We'll document it later" | "Later" becomes "never" once the team moves on |
| "Only internal use" | Internal APIs become public APIs when the team grows |
| "The tests serve as docs" | Tests cover inputs/outputs; docs explain purpose and constraints |
| "Too busy right now" | Undocumented APIs cost more time in support and onboarding |
| "AI can read the code" | Future AI instances still benefit from documented intent and rationale |

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

**Called by:** shipyard:documenter — when generating phase documentation
**Pairs with:** shipyard:shipyard-verification — documentation completeness is part of "done"
**Pairs with:** shipyard:code-simplification — clear code needs less documentation
**Leads to:** shipyard:lessons-learned — after documentation is complete, capture what was learned
