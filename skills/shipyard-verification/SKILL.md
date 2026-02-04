---
name: shipyard-verification
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
---

<!-- TOKEN BUDGET: 180 lines / ~540 tokens -->

# Verification Before Completion

<activation>

## Activation Triggers
- About to claim work is "done", "complete", "fixed", or "passing"
- About to commit, create a PR, or merge
- Before any success assertion -- must have fresh evidence first
- Using words like "should", "probably", "seems to" about work state

</activation>

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

<instructions>

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified | Test passes once |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line checklist | Tests passing |

</instructions>

<rules>

## Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", etc.)
- About to commit/push/PR without verification
- Trusting agent success reports
- Relying on partial verification
- Thinking "just this once"
- Tired and wanting work over
- **ANY wording implying success without having run verification**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence != evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter != compiler |
| "Agent said success" | Verify independently |
| "I'm tired" | Exhaustion != excuse |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter |

## When To Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Moving to next task
- Delegating to agents

**Rule applies to:**
- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion/correctness

</rules>

<examples>

## Verification Examples

### Good: Claim backed by evidence

```
Agent: I'll run the tests to verify.

$ npm test
> 34 passing (1.2s)
> 0 failing

All 34 tests pass. The refactored auth module is working correctly.
```

Why it works: The agent ran the command, read the output, and THEN made the claim. The evidence is inline and verifiable.

### Bad: Assertion without evidence

```
Agent: I've updated the auth module to fix the token validation bug.
The tests should pass now. Let me move on to the next task.
```

Why it fails: "should pass" is not evidence. No command was run. The agent is guessing based on the code change, not verifying the outcome.

### Good: Honest report of partial success

```
Agent: Running the full test suite:

$ pytest tests/
> 28 passed, 2 failed

28 of 30 tests pass. Two failures remain in test_auth_refresh.py:
- test_expired_token_refresh: expects 401 but gets 200
- test_concurrent_refresh: race condition in token store

The original bug (token validation) is fixed, but these two
related failures need investigation before this is complete.
```

### Bad: Trusting an agent's self-report

```
Agent: The builder agent reported success. Phase complete!
```

Why it fails: Agent self-reports are not verification. Check the VCS diff and run the tests yourself.

</examples>

## Why This Matters

From failure analysis: your human partner said "I don't believe you" -- trust broken. Undefined functions shipped. Missing requirements shipped. Time wasted on false completion then redirect then rework.

**No shortcuts for verification.** Run the command. Read the output. THEN claim the result. This is non-negotiable.
