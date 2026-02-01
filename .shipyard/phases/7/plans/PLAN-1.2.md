---
phase: final-validation-release
plan: 2
wave: 1
dependencies: [1]
must_haves:
  - All validation gates pass (tests, shellcheck, token count, npm pack)
  - git tag v2.0.0 created with annotated message
  - npm pack succeeds with correct file count (45-46 files) after CHANGELOG addition
  - No regressions from CHANGELOG or smoke test additions
files_touched:
  - package.json
tdd: false
---

# Plan 1.2: Validation Gates and Release Tag

## Context

This plan runs the final validation gates defined in the ROADMAP and creates the v2.0.0 release tag. It depends on Plan 1.1 (CHANGELOG.md and smoke test must exist before final validation). Research confirmed all gates already pass -- this plan re-validates after the Plan 1.1 additions and performs the tag.

Note: `package.json` is listed in files_touched because the `files` array may need updating if CHANGELOG.md should be included in the npm package. The research noted CHANGELOG is informational and either including or excluding it is acceptable. This plan will include it in the package for completeness.

## Tasks

<task id="1" files="package.json" tdd="false">
  <action>
    Run all six ROADMAP validation gates in sequence and record results:

    1. **Gate 1 -- Tests**: Run `bash test/run.sh` and verify exit code 0 with all tests passing (expected: 42 after smoke test addition)
    2. **Gate 2 -- Shellcheck**: Run `shellcheck --severity=style scripts/*.sh` and verify exit code 0 with zero output
    3. **Gate 3 -- Smoke test**: Confirmed by Gate 1 (e2e-smoke.bats is included in the test suite)
    4. **Gate 4 -- Token count**: Run `bash scripts/state-read.sh | jq -r '.hookSpecificOutput.additionalContext' | wc -w` in a sample project directory (create temp .shipyard with minimal STATE.md) and verify output is under 2500 words
    5. **Gate 5 -- npm pack**: Run `npm pack --dry-run 2>&1` and verify it succeeds with correct file listing
    6. **Gate 6 -- Package files**: Verify the npm pack output includes agents/, commands/, skills/, hooks/, scripts/, .claude-plugin/, README.md, LICENSE

    If CHANGELOG.md should be in the npm package, add `"CHANGELOG.md"` to the `files` array in `package.json` (after `"LICENSE"`). Then re-run `npm pack --dry-run` to confirm it is included.

    Record all gate results for the build summary.
  </action>
  <verify>cd /Users/lgbarn/Personal/shipyard && bash test/run.sh 2>&1 | tail -1 && shellcheck --severity=style scripts/*.sh && npm pack --dry-run 2>&1 | grep "total files" && echo "ALL GATES PASS"</verify>
  <done>All 6 ROADMAP gates pass. Gate results documented. package.json updated to include CHANGELOG.md in package if applicable.</done>
</task>

<task id="2" files="" tdd="false">
  <action>
    Create the annotated v2.0.0 git tag:

    1. Verify no existing `v2.0.0` tag: `git tag -l "v2.0.0"` should return empty
    2. Create the tag: `git tag -a v2.0.0 -m "Shipyard v2.0.0 -- Hardened, Tested, Token-Efficient"`
    3. Verify the tag exists: `git tag -l "v2.0.0"` should return `v2.0.0`
    4. Verify the tag message: `git tag -n1 v2.0.0` should show the message

    IMPORTANT: Do NOT push the tag. The user will decide when to push.
    IMPORTANT: The tag should be created on a commit that includes CHANGELOG.md and e2e-smoke.bats. If those files have not been committed yet, they must be committed first (the implementer should commit them before tagging).
  </action>
  <verify>cd /Users/lgbarn/Personal/shipyard && git tag -l "v2.0.0" | grep -q "v2.0.0" && git tag -n1 v2.0.0 | grep -q "Hardened" && echo "TAG VERIFIED" || echo "TAG MISSING"</verify>
  <done>Annotated git tag v2.0.0 exists with message "Shipyard v2.0.0 -- Hardened, Tested, Token-Efficient". Tag is local only (not pushed). Gate 5 satisfied.</done>
</task>

<task id="3" files="" tdd="false">
  <action>
    Final release verification and summary:

    1. Run `git log --oneline v2.0.0 | head -5` to confirm tag points to expected commit
    2. Run `npm pack --dry-run 2>&1` one final time and capture full file listing
    3. Produce a summary of all gate results in this format:

    ```
    Gate 1 (tests):      PASS -- 42/42 tests pass
    Gate 2 (shellcheck): PASS -- zero issues at --severity=style
    Gate 3 (smoke test): PASS -- 3 e2e tests in suite
    Gate 4 (tokens):     PASS -- under 2500 words
    Gate 5 (git tag):    PASS -- v2.0.0 annotated tag created
    Gate 6 (npm pack):   PASS -- N files, NkB package
    ```

    4. Verify CHANGELOG.md is accurate by spot-checking 3 items against actual repo state:
       - Confirm 39+ tests exist (grep test count from test run output)
       - Confirm Schema 2.0 is in state-write.sh (`grep "Schema.*2.0" scripts/state-write.sh`)
       - Confirm shellcheck passes (already verified in Gate 2)
  </action>
  <verify>cd /Users/lgbarn/Personal/shipyard && git tag -l "v2.0.0" | grep -q "v2.0.0" && bash test/run.sh 2>&1 | tail -1 | grep -q "ok" && npm pack --dry-run 2>&1 | grep -q "total files" && echo "RELEASE READY" || echo "NOT READY"</verify>
  <done>All gates verified. Release summary produced. v2.0.0 is ready for push and npm publish at the maintainer's discretion.</done>
</task>
