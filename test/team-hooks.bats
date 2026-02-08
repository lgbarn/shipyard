#!/usr/bin/env bats
load test_helper

TEAMMATE_IDLE="${PROJECT_ROOT}/hooks/teammate-idle.sh"
TASK_COMPLETED="${PROJECT_ROOT}/hooks/task-completed.sh"

teardown() {
    unset SHIPYARD_IS_TEAMMATE SHIPYARD_TEAMS_ENABLED SHIPYARD_TEAM_NAME CLAUDE_CODE_TEAM_NAME CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 2>/dev/null || true
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

# --- teammate-idle.sh tests ---

@test "teammate-idle: exits 0 in solo mode" {
    (
        unset CLAUDE_CODE_TEAM_NAME 2>/dev/null || true
        unset SHIPYARD_IS_TEAMMATE 2>/dev/null || true
        run bash "$TEAMMATE_IDLE"
        [ "$status" -eq 0 ]
    )
}

@test "teammate-idle: exits 0 when tests pass (teammate mode)" {
    setup_mock_npm 0
    export CLAUDE_CODE_TEAM_NAME="test-team"
    run bash "$TEAMMATE_IDLE"
    [ "$status" -eq 0 ]
}

@test "teammate-idle: exits 2 when tests fail (teammate mode)" {
    setup_mock_npm 1
    export CLAUDE_CODE_TEAM_NAME="test-team"
    run bash "$TEAMMATE_IDLE"
    [ "$status" -eq 2 ]
    [[ "$output" == *"BLOCKED"* ]]
}

@test "teammate-idle: ShellCheck clean" {
    command -v shellcheck &>/dev/null || skip "shellcheck not installed"
    run shellcheck --severity=warning "$TEAMMATE_IDLE"
    assert_success
}

# --- task-completed.sh tests ---

@test "task-completed: exits 0 in solo mode" {
    (
        unset CLAUDE_CODE_TEAM_NAME 2>/dev/null || true
        unset SHIPYARD_IS_TEAMMATE 2>/dev/null || true
        run bash "$TASK_COMPLETED"
        [ "$status" -eq 0 ]
    )
}

@test "task-completed: exits 0 when .shipyard directory has results" {
    setup_shipyard_dir
    mkdir -p .shipyard/phases/1/results
    echo "# Summary" > .shipyard/phases/1/results/SUMMARY-1.1.md
    export CLAUDE_CODE_TEAM_NAME="test-team"
    run bash "$TASK_COMPLETED"
    [ "$status" -eq 0 ]
}

@test "task-completed: exits 2 when no evidence exists" {
    setup_shipyard_dir
    export CLAUDE_CODE_TEAM_NAME="test-team"
    run bash "$TASK_COMPLETED"
    [ "$status" -eq 2 ]
    [[ "$output" == *"BLOCKED"* ]]
}

@test "task-completed: ShellCheck clean" {
    command -v shellcheck &>/dev/null || skip "shellcheck not installed"
    run shellcheck --severity=warning "$TASK_COMPLETED"
    assert_success
}
