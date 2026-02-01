#!/usr/bin/env bats
load test_helper

# --- Core behavior ---

@test "state-read: no .shipyard directory outputs 'No Shipyard Project Detected' JSON" {
    cd "$BATS_TEST_TMPDIR"
    # No .shipyard dir exists
    run bash "$STATE_READ"
    assert_success

    # Must be valid JSON
    echo "$output" | jq . >/dev/null 2>&1
    assert_equal "$?" "0"

    # Must contain the no-project message
    assert_output --partial "No Shipyard Project Detected"
}

@test "state-read: always outputs valid JSON with hookSpecificOutput structure" {
    setup_shipyard_with_state
    # STATE.md has Status: building -> auto-detects to execution tier
    # Execution tier runs find on .shipyard/phases/, so create it
    mkdir -p .shipyard/phases
    run bash "$STATE_READ"
    assert_success

    # Parse with jq and verify structure
    local hook_name
    hook_name=$(echo "$output" | jq -r '.hookSpecificOutput.hookEventName')
    assert_equal "$hook_name" "SessionStart"
}

@test "state-read: minimal state (STATE.md only) is included in output" {
    setup_shipyard_with_state
    # Set config to minimal tier
    echo '{"context_tier": "minimal"}' > .shipyard/config.json

    run bash "$STATE_READ"
    assert_success
    assert_output --partial "Current Phase"
    assert_output --partial "building"
}
