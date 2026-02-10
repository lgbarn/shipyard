# Shared test helper for Shipyard bats tests
# Source this at the top of every .bats file:
#   load test_helper

PROJECT_ROOT="$(cd "$(dirname "${BATS_TEST_FILENAME}")/.." && pwd)"

# Script paths (absolute, so tests can cd freely)
# These variables are used by sourcing test files, not directly in this helper.
# shellcheck disable=SC2034
STATE_READ="${PROJECT_ROOT}/scripts/state-read.sh"
# shellcheck disable=SC2034
STATE_WRITE="${PROJECT_ROOT}/scripts/state-write.sh"
# shellcheck disable=SC2034
CHECKPOINT="${PROJECT_ROOT}/scripts/checkpoint.sh"
# shellcheck disable=SC2034
TEAM_DETECT="${PROJECT_ROOT}/scripts/team-detect.sh"

# Load bats helper libraries
load "${PROJECT_ROOT}/node_modules/bats-support/load"
load "${PROJECT_ROOT}/node_modules/bats-assert/load"

# Common setup: create an isolated working directory with .shipyard skeleton
setup_shipyard_dir() {
    cd "$BATS_TEST_TMPDIR" || return 1
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
# shellcheck disable=SC2154  # $output is a BATS built-in
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

# Compute the lock directory path for the current .shipyard dir
compute_lock_dir() {
    local dir_hash
    dir_hash=$(cd .shipyard && pwd | (sha256sum 2>/dev/null || md5sum 2>/dev/null || cksum) | cut -d' ' -f1 | cut -c1-12)
    echo "${TMPDIR:-/tmp}/shipyard-state-${dir_hash}.lock"
}

# Initialize a real git repo in BATS_TEST_TMPDIR (for checkpoint tests)
setup_git_repo() {
    cd "$BATS_TEST_TMPDIR" || return 1
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
    jq -e 'has("schema") and has("phase") and has("status")' .shipyard/STATE.json > /dev/null 2>&1 || {
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

# Default teardown: clean up env vars that tests may set.
# Individual test files can override this if they need custom teardown.
teardown() {
    unset SHIPYARD_IS_TEAMMATE SHIPYARD_TEAMS_ENABLED SHIPYARD_TEAM_NAME \
        SHIPYARD_DISABLE_HOOKS SHIPYARD_SKIP_HOOKS SHIPYARD_LOCK_MAX_RETRIES \
        SHIPYARD_LOCK_RETRY_DELAY \
        CLAUDE_CODE_TEAM_NAME CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS \
        2>/dev/null || true
}
