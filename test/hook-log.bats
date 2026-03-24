#!/usr/bin/env bats
load test_helper

HOOK_LOG_SH="${PROJECT_ROOT}/scripts/hook-log.sh"
TASK_COMPLETED="${PROJECT_ROOT}/hooks/task-completed.sh"
TEAMMATE_IDLE="${PROJECT_ROOT}/hooks/teammate-idle.sh"

setup() {
    export ORIG_HOME="$HOME"
    export HOME="${BATS_TEST_TMPDIR}/fakehome"
    mkdir -p "$HOME"
}

teardown() {
    export HOME="$ORIG_HOME"
    unset ORIG_HOME
    unset SHIPYARD_IS_TEAMMATE SHIPYARD_TEAMS_ENABLED SHIPYARD_TEAM_NAME \
        CLAUDE_CODE_TEAM_NAME CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS \
        SHIPYARD_DISABLE_HOOKS SHIPYARD_SKIP_HOOKS 2>/dev/null || true
}

# --- Helper: create a mock npm that returns a given exit code ---
setup_mock_npm() {
    local exit_code="${1:-0}"
    MOCK_BIN="${BATS_TEST_TMPDIR}/mock-bin"
    mkdir -p "$MOCK_BIN"
    cat > "${MOCK_BIN}/npm" <<MOCKEOF
#!/usr/bin/env bash
exit ${exit_code}
MOCKEOF
    chmod +x "${MOCK_BIN}/npm"
    export PATH="${MOCK_BIN}:${PATH}"
}

# --- unit tests for hook-log.sh ---

# bats test_tags=unit
@test "hook-log: log_hook_failure creates log file and writes entry" {
    # shellcheck source=../scripts/hook-log.sh
    source "$HOOK_LOG_SH"
    log_hook_failure "test-hook" "2" "Test message"

    [ -f "${HOME}/.config/shipyard/hooks.log" ]

    # shellcheck disable=SC2154
    run grep "hook=test-hook exit=2 Test message" "${HOME}/.config/shipyard/hooks.log"
    assert_success

    # Assert ISO 8601 timestamp pattern present
    run grep -E "[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z" \
        "${HOME}/.config/shipyard/hooks.log"
    assert_success
}

# bats test_tags=unit
@test "hook-log: log_hook_failure creates config directory" {
    # Confirm directory does NOT exist yet
    [ ! -d "${HOME}/.config/shipyard" ]

    # shellcheck source=../scripts/hook-log.sh
    source "$HOOK_LOG_SH"
    log_hook_failure "test-hook" "1" "directory test"

    [ -d "${HOME}/.config/shipyard" ]
}

# bats test_tags=unit
@test "hook-log: log rotation triggers above 100KB" {
    mkdir -p "${HOME}/.config/shipyard"
    local logfile="${HOME}/.config/shipyard/hooks.log"

    # Write enough lines to exceed 102400 bytes (~105KB)
    for i in $(seq 1 1050); do
        printf '[2026-01-01T00:00:00Z] hook=old-hook exit=2 padding to make this line about one hundred characters long x\n' "$i"
    done > "$logfile"

    local size_before
    size_before=$(wc -c < "$logfile")
    # Confirm it exceeds 100KB
    (( size_before > 102400 ))

    # shellcheck source=../scripts/hook-log.sh
    source "$HOOK_LOG_SH"
    log_hook_failure "rotate-hook" "2" "trigger rotation"

    # After rotation: at most 501 lines (500 from tail + 1 new entry)
    local line_count
    line_count=$(wc -l < "$logfile")
    (( line_count <= 501 ))
}

# bats test_tags=unit
@test "hook-log: HOOK_LOG variable is set after sourcing" {
    # shellcheck source=../scripts/hook-log.sh
    source "$HOOK_LOG_SH"

    # shellcheck disable=SC2154
    [ -n "$HOOK_LOG" ]
    [[ "$HOOK_LOG" == *"hooks.log" ]]
}

# bats test_tags=unit
@test "hook-log: ShellCheck clean" {
    command -v shellcheck &>/dev/null || skip "shellcheck not installed"
    run shellcheck --severity=warning "$HOOK_LOG_SH"
    assert_success
}

# --- integration tests: hooks write to hooks.log ---

# bats test_tags=integration
@test "task-completed: exit 2 path writes to hooks.log" {
    export CLAUDE_CODE_TEAM_NAME="test-team"

    # Set up a minimal .shipyard dir with STATE.json (phase 1) but NO evidence files
    cd "$BATS_TEST_TMPDIR" || return 1
    mkdir -p .shipyard
    echo '{"schema":3,"phase":1,"status":"building"}' > .shipyard/STATE.json

    # Run the hook — should exit 2 (no evidence)
    run bash "$TASK_COMPLETED"
    # shellcheck disable=SC2154
    [ "$status" -eq 2 ]

    [ -f "${HOME}/.config/shipyard/hooks.log" ]

    run grep "hook=task-completed" "${HOME}/.config/shipyard/hooks.log"
    assert_success
}

# bats test_tags=integration
@test "teammate-idle: exit 2 path writes to hooks.log" {
    export CLAUDE_CODE_TEAM_NAME="test-team"
    setup_mock_npm 1

    # Run the hook — should exit 2 (tests fail)
    run bash "$TEAMMATE_IDLE"
    # shellcheck disable=SC2154
    [ "$status" -eq 2 ]

    [ -f "${HOME}/.config/shipyard/hooks.log" ]

    run grep "hook=teammate-idle" "${HOME}/.config/shipyard/hooks.log"
    assert_success
}

# bats test_tags=unit
@test "task-completed: stderr includes log path on block" {
    export CLAUDE_CODE_TEAM_NAME="test-team"

    # Set up .shipyard with no evidence
    cd "$BATS_TEST_TMPDIR" || return 1
    mkdir -p .shipyard
    echo '{"schema":3,"phase":1,"status":"building"}' > .shipyard/STATE.json

    run bash "$TASK_COMPLETED"
    # shellcheck disable=SC2154
    [[ "$output" == *"hooks.log"* ]]
}
