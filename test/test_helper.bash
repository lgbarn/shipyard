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

# Assert that $output is valid JSON (replaces fragile jq + $? pattern)
assert_valid_json() {
    run jq . <<< "$output"
    assert_success
}

# Create .shipyard with a corrupt (truncated) STATE.md
setup_shipyard_corrupt_state() {
    setup_shipyard_dir
    echo "# Shipyard State" > .shipyard/STATE.md
    # Missing required fields: Status, Current Phase
}

# Create .shipyard with an empty STATE.md
setup_shipyard_empty_state() {
    setup_shipyard_dir
    : > .shipyard/STATE.md
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
