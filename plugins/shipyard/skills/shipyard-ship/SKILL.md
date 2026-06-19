---
name: shipyard-ship
description: Use when delivering or releasing a completed Shipyard phase under Codex — final verification, pre-ship security audit, documentation, and release. Trigger when the user says "ship it", "ship this phase", "release this", "we're done — finalize", or "run the shipyard ship workflow". This is the Codex inline-sequential form of the /shipyard:ship orchestration.
---

# Shipping a phase (Codex inline-sequential)

This is Shipyard's `/shipyard:ship` delivery flow, adapted for Codex. The flow is already
sequential (verify → audit → document → deliver), so it maps cleanly to a single context —
you adopt each role in turn rather than dispatching subagents.

**Degradation note:** the audit and documentation steps run as inline personas, not
fresh-context subagents. Be deliberately thorough on the audit step — shipping is the
final gate, so do not let earlier context make you assume the code is fine.

Run `scripts/state-read.sh` first if state isn't loaded.

## Steps (run each in order; stop on a hard failure)

1. **Pre-ship verification.** Use the `shipyard-verification` skill to confirm success
   criteria are met and the phase is actually complete.
2. **Run the test suite.** All tests must pass. A failure here blocks the ship.
3. **Pre-ship security audit.** Adopt the auditor mandate (OWASP Top 10, secrets, dependency
   vulnerabilities). Shipping is the final security gate — this runs even if the build skipped
   auditing. If a passing audit already exists and nothing changed since, verify it has no
   unresolved critical findings instead of re-auditing. **Any unresolved critical finding
   blocks the ship.**
4. **Documentation.** Adopt the documenter mandate — generate/refresh API, architecture, and
   user-facing docs in `docs/`. If up-to-date docs already exist from the build, verify
   completeness instead of regenerating.
5. **Capture lessons.** Use the `lessons-learned` skill to record what was learned this phase.
6. **Deliver.** Finalize per the project's release convention (version bump, CHANGELOG, tag,
   PR/merge). Never auto-merge without the user's go-ahead unless they've authorized it.

## Done means

Verification passed, tests green, no unresolved critical audit findings, docs complete,
lessons captured, and the release artifact prepared. Report the status of each gate
explicitly — do not claim "shipped" if any gate was skipped.
