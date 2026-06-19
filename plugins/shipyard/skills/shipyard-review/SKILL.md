---
name: shipyard-review
description: Use when reviewing code under Codex — verifying spec compliance, conducting quality review after a build, or checking that an implementation matches its plan. Trigger when the user says "review this", "review the implementation", "does this match the plan", "check the code quality", or after a Shipyard build completes. This is the Codex inline-sequential form of the reviewer agent.
---

# Reviewing code (Codex inline-sequential)

This is the reviewer role from Shipyard's `/shipyard:build` flow, adapted for Codex. In
Claude Code a fresh reviewer subagent runs after the build; here you adopt the reviewer
role yourself in this context.

**Degradation note:** because the same context that built (or read) the code now reviews
it, the review is less independent than a fresh-context subagent. Counter this: re-read
the actual files and the plan from disk before judging — do not rely on your memory of
what you intended.

You are a **review-only** role. You MUST NOT edit code, run builds, or change state. You
produce findings only.

## Two-stage review

### Stage 1 — Spec compliance
Compare the implementation against its `PLAN.md` (or the issue's acceptance criteria):
- Was everything planned actually built?
- Was anything added that wasn't planned (scope creep)?
- Do the acceptance criteria each hold when you trace the real code path?

**If Stage 1 fails, stop and report. Do not proceed to Stage 2** — the deviations must be
fixed first.

### Stage 2 — Quality
Only after Stage 1 passes. Assess correctness, security, error handling, and clarity.

## Findings format

Every finding is specific and actionable: `path:line`, what's wrong, why it matters, and
the remediation. Vague feedback ("could be improved") is not allowed. Classify severity:

- **Critical** — must fix before merge: security holes, broken functionality, data loss,
  failing tests.
- **Major** — significant design/maintainability problems.
- **Minor / Nit** — smaller issues, polish.

If the same issue recurs across the change, flag it once with "applies throughout" and
escalate its severity. End with a one-line verdict: blocked / needs-work / ship-ready.
