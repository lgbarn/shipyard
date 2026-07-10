# Approach: Verification Before Commit

## Skill Applied
shipyard-verification: Evidence before assertions, always.

## Do I Immediately Commit?

No. "Everything looks good" is an assertion, not evidence. The skill is unambiguous:

> NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE

The user's statement that things "look good" triggers the skill directly — this is exactly the red flag pattern: a positive statement about work state without verification evidence attached to it.

## Why "Looks Good" Is Not Enough

The refactor changes sed to jq. These are fundamentally different tools:
- sed operates on text streams with regex substitution
- jq operates on JSON structure with path expressions

A config system refactor of this kind can break in ways that look fine on casual inspection:
- Silent data loss (jq returns null for missing paths; sed would leave text unchanged)
- Quote/escaping differences in output
- Edge cases in config values (empty strings, special characters, nested structures)
- Error handling differences (jq exits non-zero on invalid JSON; sed does not)
- Output format differences (jq may add/remove whitespace or quotes)

These failures are invisible to "looks good" — they only surface under tests.

## Verification Steps (In Order)

### Step 1: Run the full test suite

```bash
npm test
```

This is the primary gate. The project uses BATS with 108 tests. I must read the full output:
- Count of passing tests
- Count of failing tests
- Any error messages

I cannot claim tests pass without running this command fresh in this message and reading the output. A prior passing run is not sufficient evidence.

### Step 2: Run the linter (ShellCheck)

The project's CI runs ShellCheck on scripts and hooks. Since the config system lives in scripts, ShellCheck must be clean:

```bash
shellcheck scripts/state-read.sh scripts/state-write.sh scripts/checkpoint.sh hooks/*.sh
```

jq invocations have ShellCheck considerations (quoting, argument handling). A linter pass proves the new jq usage is syntactically sound.

### Step 3: Run version sync check

```bash
bash scripts/check-versions.sh
```

The pre-commit hook runs this. Running it manually confirms the environment is ready to commit.

### Step 4: Inspect the diff

```bash
git diff --stat
git diff
```

I read the full diff to:
- Confirm sed invocations are actually gone (not just partially replaced)
- Confirm jq filter expressions are correct for the actual JSON structure
- Look for any sed that was converted but left orphaned variables or dead code
- Check error handling — does the new code handle jq returning null or exit non-zero?

This is not a substitute for tests, but it surfaces obvious issues before running tests and gives context for interpreting test failures.

### Step 5: Spot-check jq correctness against actual config files

```bash
# Example: verify the new jq reads produce the same output as expected
jq '.key' .shipyard/STATE.json
```

If the config system reads STATE.json or other JSON files, I verify the jq paths are correct against actual files. A wrong path returns null silently — tests may not cover every path.

## Decision Tree

```
Run npm test
  |
  +-- ANY failures --> Do NOT commit. Report actual failures with evidence.
  |
  +-- 0 failures --> Run shellcheck
        |
        +-- ANY errors --> Do NOT commit. Fix linter errors first.
        |
        +-- 0 errors --> Run check-versions.sh
              |
              +-- Fails --> Do NOT commit. Investigate.
              |
              +-- Passes --> Read git diff
                    |
                    +-- Obvious issues found --> Do NOT commit. Fix first.
                    |
                    +-- Diff looks correct --> NOW commit with evidence
```

## What I Report Before Committing

Only after all steps pass do I commit, and I state the evidence explicitly:

> npm test: 108 passing, 0 failing
> ShellCheck: 0 errors
> check-versions.sh: passed
> Diff reviewed: all sed removed, jq paths verified against actual JSON structure

Then I commit.

## What I Do NOT Do

- Accept "everything looks good" as verification
- Skip tests because "it's just a refactor"
- Run only a subset of tests (test:fast) and call it done — unit tests alone miss integration behavior
- Trust that the code looks right on inspection without running it
- Commit and plan to fix failures later

## Core Principle

The skill states: "Claiming work is complete without verification is dishonesty, not efficiency."

A refactor from sed to jq touches every config read and write in the system. The blast radius is large. The only honest answer to "can you commit this?" is: "Not yet — let me run verification first and report what I find."
