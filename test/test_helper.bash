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

# Create .shipyard with STATE.json fixture
setup_shipyard_with_json_state() {
    setup_shipyard_dir
    cat > .shipyard/STATE.json <<'JSONEOF'
{"schema":3,"phase":1,"position":"Testing","status":"building","updated_at":"2026-01-01T00:00:00Z","blocker":null}
JSONEOF
    cat > .shipyard/HISTORY.md <<'HISTEOF'
- [2026-01-01T00:00:00Z] Phase 1: Testing (building)
HISTEOF
}

# Assert that STATE.json exists and has required fields
assert_valid_state_json() {
    [ -f .shipyard/STATE.json ] || { echo "STATE.json does not exist" >&2; return 1; }
    jq -e '.schema and .phase and .status' .shipyard/STATE.json > /dev/null 2>&1 || {
        echo "STATE.json missing required fields or invalid JSON" >&2; return 1;
    }
}

# Extract a field from STATE.json and assert its value
assert_json_field() {
    local field="$1" expected="$2"
    local actual
    actual=$(jq -r ".$field" .shipyard/STATE.json)
    if [ "$actual" != "$expected" ]; then
        echo "Expected .$field='$expected', got '$actual'" >&2
        return 1
    fi
}

# Create .shipyard with a corrupt (malformed) STATE.json
setup_shipyard_corrupt_json_state() {
    setup_shipyard_dir
    echo "not valid json{" > .shipyard/STATE.json
}

# Create .shipyard with STATE.json missing required fields
setup_shipyard_empty_json_state() {
    setup_shipyard_dir
    echo '{}' > .shipyard/STATE.json
}
