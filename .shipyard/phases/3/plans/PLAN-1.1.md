# Plan 1.1: checkpoint.sh -- Exit Codes and Dirty Worktree Warning

---
phase: 3
plan: 1.1
wave: 1
dependencies: []
must_haves:
  - Exit code contract documented in script header (0, 1, 2, 3)
  - Dirty worktree warning after successful tag creation
  - All exit codes tested
files_touched:
  - scripts/checkpoint.sh
  - test/checkpoint.bats
tdd: true
---

## Context

checkpoint.sh is the simplest of the three scripts and has the fewest changes needed for Phase 3. This plan adds the standardized exit code documentation to the script header, implements a dirty worktree warning after tag creation, and adds tests verifying both behaviors. This plan has no file overlap with the other Wave 1 plans.

## Dependencies

None -- this is a Wave 1 plan that can execute in parallel with Plans 1.2 and 1.3.

## Tasks

### Task 1: Add exit code contract and dirty worktree warning to checkpoint.sh
**Files:** scripts/checkpoint.sh
**Action:** modify
**Description:**
1. Add the standardized exit code comment block to the script header (after the existing usage comments, before `set -euo pipefail`):
   ```
   # Exit Codes:
   #   0 - Success (tag created, pruned, or graceful non-git-repo warning)
   #   1 - User error (invalid arguments, empty label after sanitization)
   #   3 - Missing dependency (git command failed for reason other than "not a repo")
   ```
   Note: checkpoint.sh does not use exit code 2 (state corruption) since it does not read STATE.md.

2. After the successful tag creation line (`echo "Checkpoint created: ${TAG}"`), add a dirty worktree check:
   ```bash
   # Warn if worktree has uncommitted changes
   if ! git diff-index --quiet HEAD -- 2>/dev/null; then
       echo "Warning: Git worktree has uncommitted changes" >&2
       echo "  Consider committing before checkpointing for clean rollback points" >&2
   fi
   ```

3. Change the git tag failure handler to distinguish between "not a repo" and other git errors. Currently it always exits 0. Keep exit 0 for non-repo case but consider that this is the existing behavior and changing it could break backward compatibility -- so leave exit 0 for now but add the exit code 3 documentation for future use.

**Acceptance Criteria:**
- Script header contains exit code documentation block
- After creating a tag in a repo with uncommitted changes, stderr contains "uncommitted changes" warning
- After creating a tag in a clean repo, no warning is emitted
- All existing checkpoint tests still pass

### Task 2: Add exit code and dirty worktree tests to checkpoint.bats
**Files:** test/checkpoint.bats
**Action:** modify
**Description:**
Add the following test cases to the end of `test/checkpoint.bats`:

1. **"checkpoint: warns when worktree is dirty"** -- Set up a git repo, create a file but do not commit it (stage or leave untracked is not enough; modify a tracked file without committing), then run checkpoint. Assert success (exit 0) AND assert stderr/output contains "uncommitted changes".
   ```bash
   @test "checkpoint: warns when worktree is dirty" {
       setup_git_repo
       # Modify a tracked file without committing
       echo "dirty" >> README.md
       run bash "$CHECKPOINT" "dirty-test"
       assert_success
       assert_output --partial "uncommitted changes"
   }
   ```

2. **"checkpoint: no warning when worktree is clean"** -- Set up a git repo (already clean from setup_git_repo), create checkpoint. Assert output does NOT contain "uncommitted".
   ```bash
   @test "checkpoint: no warning when worktree is clean" {
       setup_git_repo
       run bash "$CHECKPOINT" "clean-test"
       assert_success
       refute_output --partial "uncommitted"
   }
   ```

3. **"checkpoint: label that sanitizes to empty string exits 1"** -- Pass a label containing only special characters (e.g., `'<>;&'`). After sanitization and leading-hyphen strip, label should be empty. Verify exit code 1 and error message.
   ```bash
   @test "checkpoint: label that sanitizes to empty string exits 1" {
       setup_git_repo
       run bash "$CHECKPOINT" '<>;&'
       assert_failure
       assert_output --partial "alphanumeric"
   }
   ```

**Acceptance Criteria:**
- All three new tests pass
- All five existing checkpoint tests still pass
- `test/run.sh` exits 0

## Verification

```bash
cd /Users/lgbarn/Personal/shipyard
# Run checkpoint tests only
npx bats test/checkpoint.bats
# Run full suite to verify no regressions
bash test/run.sh
# Verify shellcheck passes
shellcheck --severity=warning scripts/checkpoint.sh
```
