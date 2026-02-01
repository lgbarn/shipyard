# Testing Infrastructure

**Project:** Shipyard
**Analysis Date:** 2026-02-01
**Test Framework:** Self-testing via TDD skill enforcement and verification protocols

## Overview

Shipyard is a Claude Code plugin that **enforces testing practices rather than containing traditional unit tests**. The project implements a meta-testing approach where:

1. **Skills define testing protocols** that agents must follow
2. **Verification skills enforce evidence-based completion claims**
3. **Workflow commands validate state and outputs at each step**
4. **No traditional test suite exists** because the codebase consists of Markdown documentation and Bash scripts with deterministic behaviors

## Testing Philosophy

### Core Principle

> "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST"

This principle is embedded in the `shipyard:shipyard-tdd` skill and enforced across all implementation workflows. Shipyard doesn't test itself with traditional unit tests; instead, it **mandates testing in all projects it manages**.

### The Iron Law of TDD

From `skills/shipyard-tdd/SKILL.md`:

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST

Write code before the test? Delete it. Start over.
```

**Red-Green-Refactor Cycle:**
1. **RED:** Write a failing test
2. **Verify RED:** Confirm it fails for the right reason
3. **GREEN:** Write minimal code to pass
4. **Verify GREEN:** Confirm it passes
5. **REFACTOR:** Clean up while staying green

## Testing Infrastructure Components

### 1. TDD Skill (`shipyard:shipyard-tdd`)

**Purpose:** Enforce test-first development for all implementation work

**Activation Triggers:**
- File patterns: `*.test.*`, `*.spec.*`, `__tests__/`, `*_test.go`
- Task markers: `tdd="true"` in plan tasks
- Any feature or bugfix implementation

**Protocol:**
```
Before ANY production code:
1. Write the test
2. Run it - watch it FAIL
3. Write minimal code
4. Run it - watch it PASS
5. Refactor if needed
6. Repeat
```

**Verification Checklist:**
```markdown
- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Output pristine (no errors, warnings)
- [ ] Tests use real code (mocks only if unavoidable)
- [ ] Edge cases and errors covered
```

### 2. Verification Skill (`shipyard:shipyard-verification`)

**Purpose:** Prevent completion claims without evidence

**Activation Triggers:**
- About to claim "done", "complete", "fixed", "passing"
- Before commit, PR creation, or merge
- Before any success assertion

**The Gate Function:**
```
BEFORE claiming any status:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
5. ONLY THEN: Make the claim
```

**Anti-Pattern Detection:**
```markdown
| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Build succeeds | Build command: exit 0 | Linter passing |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
```

### 3. Builder Agent Testing Protocol

**From `agents/builder.md`:**

**Task Execution Sequence:**
1. If `tdd="true"`: Write failing test FIRST, run to confirm failure
2. Implement task action as specified
3. Run verify command exactly as written
4. Confirm done criteria met
5. Create atomic commit

**Absolute Rules:**
- NEVER skip tests if task has `tdd="true"`
- NEVER mark task done without running verification
- NEVER combine multiple tasks into single commit
- NEVER commit without evidence of success

### 4. Reviewer Agent Testing Review

**From `agents/reviewer.md`:**

**Stage 1: Spec Compliance**
- Verify TDD protocol was followed
- Check that tests exist and pass
- Validate verification commands were run

**Stage 2: Code Quality**
- **Test quality and coverage** — are tests meaningful? Do they cover important paths and edge cases?
- Check for proper error handling in tests
- Verify tests aren't testing mock behavior instead of real behavior

### 5. Verifier Agent Execution Validation

**From `agents/verifier.md`:**

**Phase Verification Checks:**
- All phase goals met
- **Tests pass** (run the test suite if one exists)
- Integration between plans is sound
- Infrastructure validation passes (for IaC changes)

## Testing Patterns Enforced

### Test Structure Patterns

**Good Test Characteristics:**
```markdown
| Quality | Good | Bad |
|---------|------|-----|
| Minimal | One thing per test | test('validates email and domain and whitespace') |
| Clear | Name describes behavior | test('test1') |
| Shows intent | Demonstrates desired API | Obscures what code should do |
```

**Example from TDD skill:**
```typescript
// GOOD
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});

// BAD - testing mock instead of behavior
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(2);
});
```

### Bug Fix Testing Pattern

**Protocol from TDD skill:**
1. Bug found → write test reproducing it (must fail)
2. Fix the bug
3. Test must pass
4. Never fix bugs without a test

**Example:**
```markdown
Bug: Empty email accepted

RED:
test('rejects empty email', async () => {
  const result = await submitForm({ email: '' });
  expect(result.error).toBe('Email required');
});

Verify RED: npm test → FAIL (expected)

GREEN:
function submitForm(data) {
  if (!data.email?.trim()) {
    return { error: 'Email required' };
  }
}

Verify GREEN: npm test → PASS
```

### Regression Test Pattern

**From verification skill:**
```markdown
Regression tests (TDD Red-Green):

✅ Write → Run (fail) → Implement → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
```

## Test Coverage Expectations

While Shipyard itself has no test coverage (being a documentation-based plugin), it enforces comprehensive testing in managed projects:

### Per-Task Coverage

**Builder agent ensures:**
- Every task with `tdd="true"` has tests written first
- Tests cover the specific behavior being implemented
- Verification commands confirm functionality

### Per-Phase Coverage

**Reviewer checks:**
- Test quality and coverage in Stage 2 review
- Meaningful tests covering important paths and edge cases
- Not just high coverage numbers, but effective tests

**Verifier confirms:**
- Test suite passes for the entire phase
- Integration tests validate component interactions

### Security Testing

**Auditor agent checks:**
- Security-relevant code has appropriate tests
- Edge cases related to security are covered
- Authentication and authorization have test coverage

## Testing Anti-Patterns (Documented for Prevention)

### From TDD Skill

**Rationalizations to Avoid:**
```markdown
| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Already manually tested" | Ad-hoc ≠ systematic. Can't re-run. |
| "Tests after achieve same goals" | Tests-after = "what does this do?" Tests-first = "what should this do?" |
| "Keep as reference" | You'll adapt it. That's testing after. Delete means delete. |
```

**Red Flags:**
- Code before test
- Test passes immediately
- Can't explain why test failed
- Tests added "later"
- "Just this once" rationalization

### From Verification Skill

**Claims Without Evidence:**
```markdown
Red Flags - STOP:
- Using "should", "probably", "seems to"
- Expressing satisfaction before verification
- About to commit/PR without verification
- Trusting agent success reports
- Relying on partial verification
```

**Example failures:**
```markdown
❌ "Should work now" / "Looks correct"
✅ [Run test command] [See: 34/34 pass] "All tests pass"

❌ "I've written a regression test"
✅ Write → Run (pass) → Revert → Run (FAIL) → Restore → Run (pass)
```

## Verification Commands by Project Type

Shipyard expects projects to define verification commands in plans. Common patterns:

### JavaScript/TypeScript
```bash
npm test
npm run test:unit
npm run test:integration
jest path/to/test.test.ts
```

### Python
```bash
pytest
pytest path/to/test.py
python -m unittest discover
```

### Rust
```bash
cargo test
cargo test --all
cargo test specific_test
```

### Go
```bash
go test ./...
go test -v ./pkg/...
go test -race ./...
```

## Quality Gates in Build Pipeline

### Per-Task Gates

**Builder agent:**
1. TDD: Test fails → implement → test passes
2. Verification: Run specified verify command
3. Done criteria: All criteria met
4. Commit: Only after verification passes

### Per-Plan Gates

**Reviewer agent:**
1. Stage 1: Spec compliance (did we build what was planned?)
2. Stage 2: Code quality (including test quality)
3. Verdict: PASS/FAIL with specific findings

### Per-Phase Gates

**Verifier agent:**
1. All phase goals met
2. **Tests pass** (run test suite)
3. Integration sound
4. IaC validation (if applicable)

**Auditor agent (security):**
1. OWASP Top 10 checks
2. Dependency vulnerabilities
3. IaC security misconfigurations

**Simplifier agent (code quality):**
1. Cross-task duplication
2. Unnecessary complexity
3. Dead code
4. AI bloat patterns

## Integration with Git Workflow

### Atomic Commits with Test Evidence

**From git-workflow skill:**
```markdown
Commit frequently and atomically:
- Each TDD cycle (test + implementation) gets own commit
- Conventional commit format: feat(scope): description
- Never commit without tests passing
```

### Branch Completion Testing

**Before merge/PR:**
```bash
# Verify tests pass
npm test / cargo test / pytest / go test ./...

If tests fail:
  Show failures
  STOP - cannot proceed

If tests pass:
  Continue to merge/PR options
```

## Test Execution Patterns

### Baseline Verification

**When creating worktree:**
```markdown
Run tests to ensure worktree starts clean:

If tests fail: Report failures, ask whether to proceed
If tests pass: Report ready
```

### Continuous Verification

**During development:**
- After each implementation step
- Before each commit
- Before marking task complete

### Final Verification

**Before phase completion:**
- Full test suite run
- All plans verified
- Integration tests pass
- IaC validation (if applicable)

## Test Documentation Requirements

### In Plans

**Each task specifies:**
```markdown
### Task 1: {title}
**Files:** {files to modify}
**Action:** {create|modify|test}
**Acceptance Criteria:**
- [ ] Tests written and passing
- [ ] Edge cases covered
- [ ] Error handling tested
```

### In Summaries

**Builder reports:**
```markdown
## Verification Results
- Unit tests: 15/15 passing
- Integration tests: 3/3 passing
- Coverage: 87% (threshold: 80%)
- Linter: 0 errors
```

### In Reviews

**Reviewer assesses:**
```markdown
## Stage 2: Code Quality

### Test Quality
- Tests cover happy path ✓
- Tests cover edge cases ✓
- Tests cover error conditions ✓
- Tests are clear and maintainable ✓
```

## No Traditional Test Suite Rationale

**Why Shipyard itself has no test suite:**

1. **Declarative configuration:** Most code is Markdown documentation
2. **Bash scripts are simple:** State management scripts are single-purpose with minimal logic
3. **Self-enforcing design:** The skills themselves define and enforce testing protocols
4. **Meta-testing approach:** Shipyard tests its effectiveness by the quality of projects it manages
5. **Verification protocols:** Each script has clear inputs/outputs validated by hooks

**What would be tested if we added tests:**
- Script error handling and edge cases
- JSON schema validation
- Markdown parsing and structure
- Hook execution and state injection
- Agent dispatch and result handling

These are **simple, deterministic behaviors** where tests would add limited value compared to the documentation-driven design.

## Summary

Shipyard's testing approach is **prescriptive rather than introspective**:

### What Shipyard Tests
- **Nothing directly** - it's a documentation plugin

### What Shipyard Enforces
- **TDD protocol** in all managed projects
- **Verification before completion** claims
- **Evidence-based quality gates** at task, plan, and phase levels
- **Multi-stage review** including test quality assessment
- **Red-green cycles** for all features and bug fixes

### Testing Guarantees Provided
1. No production code without tests (enforced by TDD skill)
2. No completion claims without evidence (enforced by verification skill)
3. Test quality reviewed at multiple levels (builder, reviewer, verifier)
4. Security-relevant code tested (enforced by auditor)
5. Regression prevention through systematic test-first approach

### Key Insight

Shipyard doesn't need tests because **it IS a testing framework**. Its purpose is to ensure rigorous testing practices in projects it manages, making it a **meta-testing tool** rather than a tested component.

The absence of a traditional test suite is **intentional and appropriate** for a plugin composed of declarative workflows, simple scripts, and enforcement protocols.
