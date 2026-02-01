# Review: Plan 1.2 - Package Version Bump and Schema Versioning

**Reviewer:** Claude Opus 4.5
**Date:** 2026-02-01
**Plan:** `.shipyard/phases/6/plans/PLAN-1.2.md`
**Summary:** `.shipyard/phases/6/results/SUMMARY-1.2.md`

---

## Stage 1: Spec Compliance
**Verdict:** PASS

### Task 1: Update package.json (version, engines, systemDependencies)
- **Status:** PASS
- **Notes:**
  - `"version": "2.0.0"` -- confirmed at line 3 of `package.json`.
  - `"engines": { "node": ">=16.0.0" }` -- confirmed at lines 20-22, placed after the `"license"` field as specified.
  - `"systemDependencies": { "bash": ">=4.0", "jq": ">=1.6", "git": ">=2.20" }` -- confirmed at lines 23-27, placed after `"engines"` as specified.
  - `"scripts": { "test": "bash test/run.sh" }` -- confirmed preserved at lines 36-38.
  - All four sub-requirements of the task met exactly.

### Task 2: Add schemaVersion to hooks/hooks.json
- **Status:** PASS
- **Notes:**
  - `"schemaVersion": "2.0"` -- confirmed as first top-level field at line 2 of `hooks/hooks.json`.
  - The existing `"hooks"` object is unchanged: `SessionStart` array with the same matcher and command.
  - JSON is valid (verified with `JSON.parse`).

### Task 3: Run npm test gate verification
- **Status:** PASS
- **Notes:**
  - 39/39 tests pass via `npx bats test/`.
  - No commit created for this gate-only task, which is correct.

### Must-Haves Checklist

| Must-Have | Met? |
|-----------|------|
| package.json version bumped to 2.0.0 | Yes |
| package.json has engines field with node >= 16.0.0 | Yes |
| package.json has systemDependencies field documenting bash/jq/git minimums | Yes |
| hooks/hooks.json has schemaVersion "2.0" as top-level field | Yes |
| npm test command works | Yes (39/39) |

---

## Stage 2: Code Quality

### Critical
None.

### Important
None.

### Suggestions

1. **Field ordering in package.json** (`/Users/lgbarn/Personal/shipyard/package.json`, lines 20-27)
   - The `engines` and `systemDependencies` fields are placed between `"license"` and `"repository"`, which matches the plan's instruction ("after the license field"). However, npm convention typically places `engines` near `scripts` or at the end. This is purely cosmetic and has zero functional impact.
   - Remediation: No action needed. The current placement is spec-compliant and readable.

2. **Commit noted in SUMMARY does not appear in current branch HEAD ancestry**
   - The summary references commit `3f2a291` for the package.json change, but the current HEAD (`5e8b4fb`) shows it further back in history. This is expected if later Plan 1.1 commits were built on top. No issue, just noting for traceability.
   - Remediation: None needed.

---

## Summary

**Recommendation: APPROVE**

Both files (`package.json` and `hooks/hooks.json`) match the spec exactly. JSON is valid. Semantic versioning is correct -- 2.0.0 is appropriate for a major release graduating from phases 1-6. The `schemaVersion: "2.0"` field enables future migration detection as intended. All 39 tests pass. The Node.js v24 escaping issue documented in the summary is an environment quirk that did not affect the deliverables. No critical or important findings.
