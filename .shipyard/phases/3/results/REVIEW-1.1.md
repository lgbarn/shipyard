# Review: Plan 1.1 -- checkpoint.sh Exit Codes and Dirty Worktree Warning

**Reviewer:** Claude Opus 4.5
**Date:** 2026-02-01
**Plan:** /Users/lgbarn/Personal/shipyard/.shipyard/phases/3/plans/PLAN-1.1.md
**Summary:** /Users/lgbarn/Personal/shipyard/.shipyard/phases/3/results/SUMMARY-1.1.md

---

## Stage 1: Spec Compliance
**Verdict:** PASS

### Task 1: Add exit code contract and dirty worktree warning to checkpoint.sh
- Status: PASS
- Notes:
  - Exit code documentation block is present at lines 14-17 of `scripts/checkpoint.sh`, placed after the usage/examples comments and before `set -euo pipefail`, exactly as specified.
  - The three documented codes (0, 1, 3) match the plan verbatim. Exit code 2 is correctly omitted since checkpoint.sh does not read STATE.md.
  - Dirty worktree warning is implemented at lines 60-64, immediately after the `echo "Checkpoint created: ${TAG}"` line. Uses `git diff-index --quiet HEAD -- 2>/dev/null` as specified.
  - Warning output goes to stderr (`>&2`) as specified.
  - Warning text matches: "Warning: Git worktree has uncommitted changes" and the follow-up suggestion line.
  - Exit 0 is preserved for the non-repo case (line 55), maintaining backward compatibility as the plan directed.
  - All four acceptance criteria met: header contains exit code docs, dirty repo triggers warning, clean repo does not, existing tests still pass.

### Task 2: Add exit code and dirty worktree tests to checkpoint.bats
- Status: PASS
- Notes:
  - Three new test cases added at lines 69-90 of `test/checkpoint.bats`, matching the plan's specifications.
  - Test "warns when worktree is dirty" (line 69): modifies tracked file `README.md` (which `setup_git_repo` creates and commits), runs checkpoint, asserts success and "uncommitted changes" in output. Matches plan exactly.
  - Test "no warning when worktree is clean" (line 78): runs on a clean repo from `setup_git_repo`, uses `refute_output --partial "uncommitted"`. Matches plan exactly.
  - Test "label that sanitizes to empty string exits 1" (line 85): passes `'<>;&'` as label, asserts failure and "alphanumeric" in output. Matches plan exactly.
  - Summary reports 8/8 checkpoint tests pass (5 existing + 3 new).
  - shellcheck passes with 0 warnings.
  - The one test failure in `test/run.sh` (26/27) is in state-write, unrelated to this plan.

---

## Stage 2: Code Quality

### Critical
None.

### Important
None.

### Suggestions

1. **`git diff-index` does not detect untracked files** -- `/Users/lgbarn/Personal/shipyard/scripts/checkpoint.sh:61`
   - `git diff-index --quiet HEAD --` only detects modifications to tracked files. If a user has new untracked files in the worktree, no warning is emitted. This is consistent with the plan's specification (which explicitly uses `diff-index`), but users might expect untracked files to also be flagged. A future enhancement could add `git ls-files --others --exclude-standard` to also detect untracked files.
   - Remediation: Track as a future enhancement if desired. No change needed for spec compliance.

2. **Exit code 3 is documented but never emitted** -- `/Users/lgbarn/Personal/shipyard/scripts/checkpoint.sh:17`
   - The exit code contract documents code 3 ("Missing dependency") but no code path currently emits it. The git tag failure handler at line 53-56 exits 0 for all failure cases. This is intentional per the plan (backward compatibility), but a reader of the exit code docs might expect code 3 to actually be used somewhere.
   - Remediation: Add a brief inline comment such as `# Note: exit 3 reserved for future use` next to the documentation, or implement the distinction between "not a repo" and other git errors in a future plan.

3. **Dirty worktree test relies on bats merging stderr into output** -- `/Users/lgbarn/Personal/shipyard/test/checkpoint.bats:75`
   - The warning is written to stderr, and the test uses `assert_output --partial "uncommitted changes"`. This works because bats `run` merges stdout and stderr by default, but this is an implicit behavior. If bats behavior changes or a `run --separate-stderr` flag is ever used, this test would break.
   - Remediation: No action needed now; this is standard bats practice. Just noting the implicit coupling.

---

## Summary

**Recommendation: APPROVE**

The implementation precisely follows the plan specification. All six acceptance criteria across both tasks are satisfied. The code is clean, minimal, and well-structured. The three new tests are correctly written and cover the specified scenarios. shellcheck passes cleanly. The only findings are minor suggestions about future enhancements (untracked file detection, exit code 3 not yet emitted), none of which represent deviations from the plan.
