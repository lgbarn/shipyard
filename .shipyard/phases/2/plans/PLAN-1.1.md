---
phase: testing-foundation
plan: "1.1"
wave: 1
dependencies: []
must_haves:
  - bats-core installed as npm devDependency along with bats-support and bats-assert
  - test/run.sh runner script that exits 0 on clean checkout
  - test/test_helper.bash with shared setup (BATS_TEST_TMPDIR scaffolding, script paths)
  - package.json has "test" script wired to test/run.sh
files_touched:
  - package.json
  - test/run.sh
  - test/test_helper.bash
tdd: false
---

# PLAN-1.1: Test infrastructure -- bats-core, runner, helpers

## Context

All subsequent test plans depend on bats-core being installed and a shared test
helper being available. This plan creates the foundation: npm devDependencies,
the CI-ready runner script, and a helper file that every `.bats` file will load.

The runner must work on both macOS and Linux, install bats if missing, and exit 0
when no tests fail.

---

<task id="1" files="package.json" tdd="false">
  <action>
  Install bats-core and helpers as npm devDependencies:

  ```bash
  npm install --save-dev bats bats-support bats-assert
  ```

  Add a `"test"` script to `package.json`:

  ```json
  "scripts": {
    "test": "bash test/run.sh"
  }
  ```

  This keeps the test runner invocable via `npm test` for CI systems.
  </action>
  <verify>node -e "require('bats/package.json')" && jq -e '.scripts.test' package.json</verify>
  <done>bats, bats-support, and bats-assert are in devDependencies. `npm test` is wired.</done>
</task>

<task id="2" files="test/run.sh" tdd="false">
  <action>
  Create `test/run.sh` as the CI-ready test runner:

  ```bash
  #!/usr/bin/env bash
  # Shipyard test runner -- works on macOS and Linux
  # Usage: bash test/run.sh [optional bats args]
  set -euo pipefail

  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

  cd "$PROJECT_ROOT"

  # Ensure bats is available
  BATS="./node_modules/.bin/bats"
  if [ ! -x "$BATS" ]; then
      echo "bats not found. Installing via npm..."
      npm install --save-dev bats bats-support bats-assert
  fi

  # Run all .bats files in test/
  echo "Running Shipyard test suite..."
  "$BATS" --formatter tap test/*.bats "$@"
  ```

  Make it executable: `chmod +x test/run.sh`.
  </action>
  <verify>test -x test/run.sh && head -1 test/run.sh | grep -q 'bash'</verify>
  <done>test/run.sh is executable, finds bats, and runs all .bats files in test/.</done>
</task>

<task id="3" files="test/test_helper.bash" tdd="false">
  <action>
  Create `test/test_helper.bash` with shared setup for all test files:

  ```bash
  # Shared test helper for Shipyard bats tests
  # Source this at the top of every .bats file:
  #   load test_helper

  PROJECT_ROOT="$(cd "$(dirname "${BATS_TEST_FILENAME}")/.." && pwd)"

  # Script paths (absolute, so tests can cd freely)
  STATE_READ="${PROJECT_ROOT}/scripts/state-read.sh"
  STATE_WRITE="${PROJECT_ROOT}/scripts/state-write.sh"
  CHECKPOINT="${PROJECT_ROOT}/scripts/checkpoint.sh"

  # Load bats helper libraries
  load "${PROJECT_ROOT}/node_modules/bats-support/load"
  load "${PROJECT_ROOT}/node_modules/bats-assert/load"

  # Common setup: create an isolated working directory with .shipyard skeleton
  setup_shipyard_dir() {
      cd "$BATS_TEST_TMPDIR"
      mkdir -p .shipyard
  }

  # Create a minimal .shipyard with STATE.md
  setup_shipyard_with_state() {
      setup_shipyard_dir
      cat > .shipyard/STATE.md <<'STATEEOF'
  # Shipyard State

  **Last Updated:** 2026-01-01T00:00:00Z
  **Current Phase:** 1
  **Current Position:** Testing
  **Status:** building

  ## History

  - [2026-01-01T00:00:00Z] Phase 1: Testing (building)
  STATEEOF
  }

  # Initialize a real git repo in BATS_TEST_TMPDIR (for checkpoint tests)
  setup_git_repo() {
      cd "$BATS_TEST_TMPDIR"
      git init -q
      git config user.email "test@shipyard.dev"
      git config user.name "Shipyard Test"
      echo "init" > README.md
      git add README.md
      git commit -q -m "initial commit"
  }
  ```

  This provides:
  - Absolute paths to all three scripts
  - bats-assert and bats-support loaded automatically
  - `setup_shipyard_dir` for minimal isolation
  - `setup_shipyard_with_state` for tests needing a pre-existing STATE.md
  - `setup_git_repo` for checkpoint tests needing a real git repository
  </action>
  <verify>test -f test/test_helper.bash && grep -q 'bats-assert' test/test_helper.bash && grep -q 'setup_git_repo' test/test_helper.bash</verify>
  <done>test_helper.bash exists with script path constants, library loads, and all three setup helpers.</done>
</task>
