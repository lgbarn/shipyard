# REVIEW-1.1: Test Infrastructure (bats-core, runner, helpers)

**Reviewed:** 2026-02-01
**Plan:** PLAN-1.1
**Summary:** SUMMARY-1.1
**Reviewer verdict:** PASS -- APPROVE

---

## Stage 1: Spec Compliance

**Verdict:** PASS

### Task 1: Install bats-core as npm devDependencies

- **Status:** PASS
- `package.json` contains `bats@^1.13.0`, `bats-support@^0.3.0`, `bats-assert@^2.2.4` in `devDependencies`.
- `scripts.test` is set to `"bash test/run.sh"` -- matches the plan exactly.

### Task 2: Create test/run.sh

- **Status:** PASS
- File exists at `test/run.sh` with mode `-rwxr-xr-x` (executable).
- Shebang is `#!/usr/bin/env bash` -- matches plan.
- Uses `set -euo pipefail` -- matches plan.
- Auto-installs bats when `./node_modules/.bin/bats` is not executable -- matches plan.
- Runs `"$BATS" --formatter tap test/*.bats "$@"` -- matches plan.
- Content is character-for-character identical to the plan specification.

### Task 3: Create test/test_helper.bash

- **Status:** PASS
- File exists at `test/test_helper.bash`.
- Resolves `PROJECT_ROOT` from `BATS_TEST_FILENAME` -- matches plan.
- Exports absolute paths: `STATE_READ`, `STATE_WRITE`, `CHECKPOINT` -- matches plan.
- Loads `bats-support/load` and `bats-assert/load` -- matches plan.
- Provides all three helper functions: `setup_shipyard_dir`, `setup_shipyard_with_state`, `setup_git_repo` -- matches plan.
- Content is character-for-character identical to the plan specification.

### Deviations

- **Extra file:** `package-lock.json` was created. This is an expected side effect of `npm install` and is not a deviation.
- No missing features. No incorrect implementations.

---

## Stage 2: Code Quality

### Critical

None.

### Important

None.

### Suggestions

1. **`test/run.sh` line 20 -- glob may fail when no `.bats` files exist.**
   The runner uses `test/*.bats` which, under `set -e` with the default bash `nullglob` off, will cause bats to receive a literal `test/*.bats` argument and fail if no test files exist yet. The plan states the runner should "exit 0 on clean checkout," but this only works if at least one `.bats` file is present.
   - Remediation: Add a guard before invoking bats, e.g., `shopt -s nullglob; files=(test/*.bats); if [ ${#files[@]} -eq 0 ]; then echo "No .bats files found."; exit 0; fi` or create a placeholder `.bats` file in a later plan. This is low severity since subsequent plans will add `.bats` files before the runner is invoked in CI.

2. **`test/test_helper.bash` -- `STATE_READ`, `STATE_WRITE`, `CHECKPOINT` are not exported.**
   The summary says "Exports absolute paths" but these are plain shell variables, not exported. This is fine for bats usage (each test runs in the same shell), so the behavior is correct. The summary wording is slightly misleading but functionally irrelevant.
   - Remediation: No code change needed; just a documentation nit.

3. **`test/test_helper.bash` line 42 -- `git config` uses local scope by default.**
   This is correct behavior for test isolation. Noted as positive -- the helper avoids polluting global git config.

---

## Summary

All three tasks were implemented exactly as specified in the plan. The code is clean, idiomatic bash, and follows the plan character-for-character. The test infrastructure is ready for subsequent plans to add `.bats` test files.

**Recommendation:** APPROVE
