#!/usr/bin/env bats
load test_helper

@test "integration: write then read round-trip preserves state data" {
    setup_shipyard_dir
    mkdir -p .shipyard/phases

    # Write known state
    bash "$STATE_WRITE" --phase 3 --position "Integration testing" --status in_progress

    # Verify write succeeded
    [ -f .shipyard/STATE.md ]

    # Read state back via state-read.sh
    run bash "$STATE_READ"
    assert_success

    # Verify the JSON output contains what we wrote
    assert_output --partial "Phase"
    assert_output --partial "3"
    assert_output --partial "in_progress"

    # Verify it is valid JSON
    echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null
}
