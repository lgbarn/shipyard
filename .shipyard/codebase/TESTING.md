# Testing Infrastructure

**Last Updated:** 2026-02-03
**Analyzed Version:** 2.3.0

## Overview

Shipyard implements a **dual testing approach**:

### 1. Self-Testing (Shipyard's Own Code)
- **Framework:** bats-core (Bash Automated Testing System)
- **Coverage:** 668 lines of test code across 5 test files
- **Scope:** Bash scripts with executable logic (`state-read.sh`, `state-write.sh`, `checkpoint.sh`)
- **Execution:** `npm test` or `bash test/run.sh`
- **Philosophy:** Test executable code, not declarative content

### 2. Meta-Testing (Enforced in Managed Projects)
- **TDD skill (`shipyard-tdd`)** enforces test-first development
- **Verification skill (`shipyard-verification`)** prevents completion claims without evidence
- **Testing skill (`shipyard-testing`)** guides effective test patterns
- **Workflow commands** validate state and outputs at each pipeline stage

**Key insight:** Shipyard uses the right tool for each job - bats tests for executable scripts, enforced protocols for managed projects.

This document covers both approaches: how Shipyard tests itself AND how it enforces testing in projects it manages.

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

## Part 1: Shipyard's Own Test Suite

### Test Framework: bats-core

**What is Bats?**
Bats (Bash Automated Testing System) is a TAP-compliant testing framework for Bash scripts. It provides a simple, readable syntax for testing command-line tools and shell scripts.

**Dependencies:**
```json
"devDependencies": {
  "bats": "^1.13.0",
  "bats-assert": "^2.2.4",
  "bats-support": "^0.3.0"
}
```

**Installation:**
```bash
npm install --save-dev bats bats-support bats-assert
```

### Test File Organization

```
test/
├── run.sh                  # Test runner (569 bytes)
├── test_helper.bash        # Shared utilities (68 lines)
├── checkpoint.bats         # Checkpoint tests (90 lines)
├── state-read.bats         # State reading tests (211 lines)
├── state-write.bats        # State writing tests (137 lines)
├── integration.bats        # Integration tests (138 lines)
└── e2e-smoke.bats         # E2E smoke tests (92 lines)
```

**Total Test Coverage:** 668 lines of test code

### Test Execution

**Via npm (recommended):**
```bash
npm test
```

**Direct execution:**
```bash
bash test/run.sh
./node_modules/.bin/bats test/*.bats
```

**Test runner behavior:**
- Auto-installs bats if not found
- Runs all `.bats` files in `test/` directory
- TAP (Test Anything Protocol) formatted output
- Exit code 0 if all pass, non-zero on any failure

### Test Structure and Patterns

**Standard test file structure:**
```bash
#!/usr/bin/env bats
load test_helper

@test "component: behavior description" {
    # Arrange
    setup_shipyard_with_state

    # Act
    run bash "$STATE_READ"

    # Assert
    assert_success
    assert_output --partial "Current Phase"
}
```

**Test naming convention:**
```
@test "script-name: specific behavior description"
```

**Examples from actual tests:**
```bash
@test "state-read: no .shipyard directory outputs 'No Shipyard Project Detected' JSON"
@test "checkpoint: creates tag with valid label"
@test "integration: write then read round-trip preserves state data"
@test "e2e: structured write creates valid state then read returns JSON"
```

### Test Helper Utilities

**File:** `test/test_helper.bash`

**Exported constants:**
```bash
PROJECT_ROOT="$(cd "$(dirname "${BATS_TEST_FILENAME}")/.." && pwd)"
STATE_READ="${PROJECT_ROOT}/scripts/state-read.sh"
STATE_WRITE="${PROJECT_ROOT}/scripts/state-write.sh"
CHECKPOINT="${PROJECT_ROOT}/scripts/checkpoint.sh"
```

**Setup functions:**
```bash
setup_shipyard_dir()              # Creates isolated .shipyard skeleton
setup_shipyard_with_state()       # Creates .shipyard with valid STATE.md
setup_shipyard_corrupt_state()    # Creates corrupt STATE.md for error testing
setup_shipyard_empty_state()      # Creates empty STATE.md for edge cases
setup_git_repo()                  # Initializes test git repo with user config
```

**Custom assertions:**
```bash
assert_valid_json()               # Validates output is parseable JSON via jq
```

### Test Categories

#### 1. Unit Tests (Component-Specific)

**checkpoint.bats** (90 lines)
- Tag creation with valid labels
- Label sanitization (special characters)
- Prune functionality (remove old tags)
- Dirty worktree warnings
- Non-git-repo handling
- Edge cases (empty labels, invalid days)

**state-read.bats** (211 lines)
- No project detection
- JSON structure validation
- Context tier auto-detection
- Minimal/planning/execution tier loading
- STATE.md corruption detection
- Missing phases directory handling (Issue #4)
- Lessons loading

**state-write.bats** (137 lines)
- Structured writes (phase, position, status)
- Raw content writes
- History accumulation
- Atomic writes (validation)
- Recovery mode (rebuild from artifacts)
- Exit code validation
- Input validation (phase numbers, status values)

#### 2. Integration Tests

**integration.bats** (138 lines)
- Write → read round-trip preservation
- Checkpoint create → prune lifecycle
- Multiple writes accumulating history
- Cross-component interactions

**Example integration test:**
```bash
@test "integration: write then read round-trip preserves state data" {
    setup_shipyard_dir
    mkdir -p .shipyard/phases

    # Write known state
    bash "$STATE_WRITE" --phase 3 --position "Integration testing" --status in_progress

    # Read state back via state-read.sh
    run bash "$STATE_READ"
    assert_success
    assert_output --partial "Phase"
    assert_output --partial "3"
    assert_output --partial "in_progress"
}
```

#### 3. End-to-End Tests

**e2e-smoke.bats** (92 lines)
- Full lifecycle scenarios
- Structured write → STATE.md → read → JSON
- Checkpoint create → verify tag → prune → verify removal
- State recovery from artifacts

**Example E2E test:**
```bash
@test "e2e: recovery rebuilds state from artifacts" {
    cd "$BATS_TEST_TMPDIR"

    # Create phase artifacts
    mkdir -p .shipyard/phases/2/plans
    echo "# Plan 2.1" > .shipyard/phases/2/plans/PLAN-1.1.md

    # Remove STATE.md
    rm -f .shipyard/STATE.md

    # Recover state
    run bash "$STATE_WRITE" --recover
    assert_success

    # Verify recovered STATE.md
    run cat .shipyard/STATE.md
    assert_output --partial "Phase"
    assert_output --partial "2"
}
```

### Test Isolation

**All tests run in isolated environments:**
- `BATS_TEST_TMPDIR`: Unique temp directory per test run
- Fresh git repos initialized in setup (not reused between tests)
- No shared state between tests
- Automatic cleanup on test completion

**Example:**
```bash
@test "checkpoint: creates tag with valid label" {
    setup_git_repo              # Fresh git repo in BATS_TEST_TMPDIR
    run bash "$CHECKPOINT" "pre-build-phase-2"
    assert_success
    # Cleanup handled automatically by bats
}
```

### Assertions Used

**From bats-assert:**
```bash
assert_success                      # Exit code 0
assert_failure                      # Exit code non-zero
assert_equal "$expected" "$actual"  # String equality
assert_output "exact"               # Exact output match
assert_output --partial "substring" # Contains substring
refute_output --partial "not this"  # Does not contain substring
```

**Custom assertions:**
```bash
assert_valid_json                   # Validates JSON via jq
```

### Test Coverage by Component

| Component | Test File | Lines | Focus |
|-----------|-----------|-------|-------|
| `checkpoint.sh` | checkpoint.bats | 90 | Tag creation, pruning, validation |
| `state-read.sh` | state-read.bats | 211 | JSON output, tier detection, corruption handling |
| `state-write.sh` | state-write.bats | 137 | Structured writes, atomic operations, recovery |
| Cross-component | integration.bats | 138 | Write→read cycles, multi-step workflows |
| Full scenarios | e2e-smoke.bats | 92 | Complete user journeys |

### What Gets Tested

**Script functionality:**
- Argument parsing and validation
- File creation and modification (atomic writes)
- Git operations (tags, status checks)
- JSON generation and structure
- Error handling and exit codes
- Edge cases (empty inputs, missing files, corrupted state)
- Context tier auto-detection
- State recovery from artifacts

**Error scenarios:**
- Missing .shipyard directory
- Corrupt STATE.md files
- Invalid arguments
- Non-git repositories
- Missing dependencies (jq)
- Concurrent write safety (atomic operations)

### What Is NOT Tested

**Out of scope for bats tests:**
- Markdown documentation content (declarative, no logic)
- Agent instructions (natural language, not code)
- Command workflows (orchestration, not algorithms)
- Skill content (guidelines, not executable logic)
- Claude Code integration (external system)
- Hook execution within Claude Code (platform-specific)

**Why these are excluded:**
- Markdown files are documentation, not executable code
- Agent/skill definitions are LLM instructions, not testable functions
- Integration with Claude Code requires platform testing, not unit tests
- The value is in the protocols enforced, not the markdown syntax

### Running Tests

**Run all tests:**
```bash
npm test
```

**Run specific test file:**
```bash
./node_modules/.bin/bats test/checkpoint.bats
```

**Run with verbose output:**
```bash
./node_modules/.bin/bats --formatter pretty test/*.bats
```

**Expected output (all passing):**
```
Running Shipyard test suite...
 ✓ checkpoint: creates tag with valid label
 ✓ checkpoint: sanitizes label with special characters
 ✓ state-read: no .shipyard directory outputs JSON
 ✓ state-write: structured write creates STATE.md
 ...
34 tests, 0 failures
```

### Test Maintenance

**Adding new tests:**
1. Create or modify `.bats` file in `test/`
2. Use `@test "component: description" { ... }` syntax
3. Load test_helper: `load test_helper`
4. Use setup functions for isolation
5. Assert expected behavior, not implementation

**Test quality standards:**
- One behavior per test
- Descriptive test names (not abbreviated)
- Arrange-Act-Assert structure
- Isolated (no shared state)
- Fast (no sleep/wait unless absolutely necessary)

## Part 2: Meta-Testing (Enforced in Managed Projects)

The following sections describe how Shipyard enforces testing discipline in the projects it manages.

## Testing Infrastructure Components

### 1. TDD Skill (`shipyard:shipyard-tdd`)

**Purpose:** Enforce test-first development for all implementation work

**File:** `/Users/lgbarn/Personal/shipyard/skills/shipyard-tdd/SKILL.md` (379 lines)

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

**The Iron Law:**
```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST

Write code before the test? Delete it. Start over.
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

**Integration:** References `shipyard:shipyard-testing` for test structure patterns.

### 2. Verification Skill (`shipyard:shipyard-verification`)

**Purpose:** Prevent completion claims without evidence

**File:** `/Users/lgbarn/Personal/shipyard/skills/shipyard-verification/SKILL.md` (147 lines)

**Activation Triggers:**
- About to claim "done", "complete", "fixed", "passing"
- Before commit, PR creation, or merge
- Before any success assertion

**The Iron Law:**
```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

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
| Regression test works | Red-green cycle verified | Test passes once |
```

**Historical context:** Created after incidents where claims were made without verification, leading to shipped bugs and broken trust.

### 3. Testing Skill (`shipyard:shipyard-testing`)

**Purpose:** Guide effective test structure and patterns

**File:** `/Users/lgbarn/Personal/shipyard/skills/shipyard-testing/SKILL.md` (400 lines estimated)

**Activation Triggers:**
- Writing or modifying test files
- Setting up test infrastructure or utilities
- Debugging flaky, brittle, or slow tests
- Deciding between unit, integration, and E2E tests
- Choosing when and how to use mocks, stubs, or fakes

**The Iron Law:**
```
TEST BEHAVIORS, NOT IMPLEMENTATIONS
```

**Core Principle:** If refactoring breaks your tests but not your users, your tests are wrong.

**Test Structure (AAA):**
```
Arrange — Set up preconditions and inputs
Act     — Execute the behavior under test
Assert  — Verify the expected outcome
```

**What to test:**
- Behaviors: What the system does from a user's perspective
- Edge cases: Empty inputs, boundaries, overflow, zero, null
- Error paths: Invalid input, missing dependencies, timeouts
- State transitions: Before and after an operation

**What to skip:**
- Trivial getters/setters with no logic
- Generated code (protobuf, ORM migrations)
- Framework internals
- Private methods (test through public API)

**Relationship to TDD skill:** `shipyard-tdd` covers WHEN to write tests (test-first), while `shipyard-testing` covers HOW to write effective, maintainable tests.

### 4. Builder Agent Testing Protocol

**File:** `/Users/lgbarn/Personal/shipyard/agents/builder.md`

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

### 5. Reviewer Agent Testing Review

**File:** `/Users/lgbarn/Personal/shipyard/agents/reviewer.md`

**Stage 1: Spec Compliance**
- Verify TDD protocol was followed
- Check that tests exist and pass
- Validate verification commands were run

**Stage 2: Code Quality**
- **Test quality and coverage** — are tests meaningful? Do they cover important paths and edge cases?
- Check for proper error handling in tests
- Verify tests aren't testing mock behavior instead of real behavior

**Finding categories:** Critical (must fix), Important (should fix), Suggestion (nice to have)

### 6. Verifier Agent Execution Validation

**File:** `/Users/lgbarn/Personal/shipyard/agents/verifier.md`

**Phase Verification Checks:**
- All phase goals met
- **Tests pass** (run the test suite if one exists)
- Integration between plans is sound
- Infrastructure validation passes (for IaC changes)

Produces `VERIFICATION.md` with overall status, coverage analysis, and gaps identified.

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

## Test Coverage Expectations in Managed Projects

Shipyard enforces comprehensive testing in projects it manages:

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

## Testing Approach Rationale

### Why the Dual Approach?

**Shipyard's own tests (bats-core):**
- Tests executable Bash scripts (`state-read.sh`, `state-write.sh`, `checkpoint.sh`)
- Validates critical infrastructure (state management, atomic writes, recovery)
- Ensures script behavior is deterministic and correct
- Prevents regressions in core functionality
- **668 lines of tests** for scripts with logic and edge cases

**What is NOT tested (and why):**
- **Markdown documentation:** Declarative content, no executable logic
- **Agent instructions:** Natural language prompts for LLMs, not testable code
- **Command workflows:** Orchestration steps, validated by agent execution
- **Skill definitions:** Guidelines enforced by agents, not executable functions
- **Claude Code integration:** Platform-specific, requires integration testing

**Why this makes sense:**
1. **Bash scripts have logic** → need unit tests for correctness
2. **Markdown has no logic** → testing would verify file contents, not behavior
3. **Agent prompts guide LLMs** → effectiveness measured by outcomes, not syntax
4. **Skills enforce protocols** → meta-testing approach validates enforcement

### The Meta-Testing Approach

While Markdown/agent files don't need tests themselves, they **define and enforce testing in managed projects**. This is meta-testing: testing through enforcement rather than direct validation.

## Summary

Shipyard implements a **hybrid testing strategy**:

### What Shipyard Tests (Self-Testing)
- **Bash scripts** with bats-core (668 lines of tests)
- State management logic (read, write, recovery)
- Checkpoint functionality (create, prune, validate)
- Error handling and edge cases
- Atomic operations and data integrity
- JSON generation and structure

### What Shipyard Enforces (Meta-Testing)
- **TDD protocol** in all managed projects
- **Verification before completion** claims
- **Evidence-based quality gates** at task, plan, and phase levels
- **Multi-stage review** including test quality assessment
- **Red-green cycles** for all features and bug fixes

### Testing Guarantees Provided

**For Shipyard itself:**
1. Core scripts function correctly (validated by bats tests)
2. State management is atomic and recoverable (integration tests)
3. Error handling works as documented (unit tests)
4. Edge cases handled gracefully (comprehensive test coverage)

**For managed projects:**
1. No production code without tests (enforced by TDD skill)
2. No completion claims without evidence (enforced by verification skill)
3. Test quality reviewed at multiple levels (builder, reviewer, verifier)
4. Security-relevant code tested (enforced by auditor)
5. Regression prevention through systematic test-first approach

### Key Insight

Shipyard uses **the right tool for the job**:
- **Bats tests** for executable Bash scripts with logic
- **Meta-testing enforcement** for ensuring quality in managed projects
- **Documentation** for agent instructions and workflow orchestration

This dual approach ensures both **Shipyard's reliability** (via bats tests) and **managed project quality** (via enforced protocols).
