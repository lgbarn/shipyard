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

# --- Context tier tests ---

@test "state-read: auto-detect building status resolves to execution tier" {
    setup_shipyard_with_state
    # STATE.md already has Status: building
    # Create phase directory with a plan file for execution tier to find
    mkdir -p .shipyard/phases/1/plans
    echo "# Test Plan" > .shipyard/phases/1/plans/PLAN-1.1.md

    run bash "$STATE_READ"
    assert_success
    # Execution tier loads phase plans
    assert_output --partial "Test Plan"
}

@test "state-read: planning tier includes PROJECT.md and ROADMAP.md" {
    setup_shipyard_dir
    # Create state with planning status
    cat > .shipyard/STATE.md <<'EOF'
# Shipyard State

**Last Updated:** 2026-01-01T00:00:00Z
**Current Phase:** 1
**Status:** planning
EOF

    echo "# My Project" > .shipyard/PROJECT.md
    echo "# My Roadmap" > .shipyard/ROADMAP.md

    run bash "$STATE_READ"
    assert_success
    assert_output --partial "My Project"
    assert_output --partial "My Roadmap"
}

@test "state-read: missing config.json defaults to auto tier" {
    setup_shipyard_with_state
    # No config.json -- should default to auto, then resolve based on status
    # Status is "building" -> auto resolves to execution
    # Create phases dir so find doesn't fail under set -e
    mkdir -p .shipyard/phases
    run bash "$STATE_READ"
    assert_success

    # Should still produce valid JSON (no crash from missing config)
    echo "$output" | jq . >/dev/null 2>&1
    assert_equal "$?" "0"
}
