#!/usr/bin/env bats
load test_helper

# --- Team detection tests ---

# bats test_tags=unit
@test "team-detect: no env vars sets all false" {
    (
        unset CLAUDE_CODE_TEAM_NAME 2>/dev/null || true
        unset CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 2>/dev/null || true
        source "$TEAM_DETECT"
        [ "$SHIPYARD_IS_TEAMMATE" = "false" ]
        [ "$SHIPYARD_TEAMS_ENABLED" = "false" ]
        [ "$SHIPYARD_TEAM_NAME" = "" ]
    )
}

# bats test_tags=unit
@test "team-detect: CLAUDE_CODE_TEAM_NAME set exports SHIPYARD_IS_TEAMMATE=true" {
    (
        unset CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 2>/dev/null || true
        export CLAUDE_CODE_TEAM_NAME="my-team"
        source "$TEAM_DETECT"
        [ "$SHIPYARD_IS_TEAMMATE" = "true" ]
        [ "$SHIPYARD_TEAM_NAME" = "my-team" ]
    )
}

# bats test_tags=unit
@test "team-detect: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 exports SHIPYARD_TEAMS_ENABLED=true" {
    (
        unset CLAUDE_CODE_TEAM_NAME 2>/dev/null || true
        export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS="1"
        source "$TEAM_DETECT"
        [ "$SHIPYARD_TEAMS_ENABLED" = "true" ]
    )
}

# bats test_tags=unit
@test "team-detect: both env vars set activates all three exports" {
    (
        export CLAUDE_CODE_TEAM_NAME="alpha-team"
        export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS="1"
        source "$TEAM_DETECT"
        [ "$SHIPYARD_IS_TEAMMATE" = "true" ]
        [ "$SHIPYARD_TEAMS_ENABLED" = "true" ]
        [ "$SHIPYARD_TEAM_NAME" = "alpha-team" ]
    )
}

# bats test_tags=unit
@test "team-detect: CLAUDE_CODE_TEAM_NAME empty string is not teammate" {
    (
        export CLAUDE_CODE_TEAM_NAME=""
        unset CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 2>/dev/null || true
        source "$TEAM_DETECT"
        [ "$SHIPYARD_IS_TEAMMATE" = "false" ]
        [ "$SHIPYARD_TEAM_NAME" = "" ]
    )
}

# bats test_tags=unit
@test "team-detect: ShellCheck clean" {
    command -v shellcheck &>/dev/null || skip "shellcheck not installed"
    run shellcheck --severity=warning "$TEAM_DETECT"
    assert_success
}
