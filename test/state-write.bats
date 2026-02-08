#!/usr/bin/env bats
load test_helper

# --- Negative tests: validation ---

@test "state-write: --phase rejects non-integer" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --phase "abc" --position "test" --status ready
    assert_failure
    assert_output --partial "positive integer"
}

@test "state-write: --status rejects invalid value" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --phase 1 --position "test" --status "bogus"
    assert_failure
    assert_output --partial "must be one of"
}

@test "state-write: fails without .shipyard directory" {
    cd "$BATS_TEST_TMPDIR"
    # Do NOT create .shipyard
    run bash "$STATE_WRITE" --phase 1 --position "test" --status ready
    assert_failure
    assert_output --partial ".shipyard"
}

# --- Positive tests: structured writes ---

@test "state-write: structured write creates valid STATE.json" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --phase 2 --position "Building plan 1" --status in_progress
    assert_success
    assert_output --partial "STATE.json updated"

    assert_valid_state_json
    assert_json_field "schema" "3"
    assert_json_field "phase" "2"
    assert_json_field "status" "in_progress"
    assert_json_field "position" "Building plan 1"
}

@test "state-write: raw write replaces STATE.json content" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --raw '{"schema":3,"phase":1,"position":"Custom","status":"ready","updated_at":"2026-01-01T00:00:00Z","blocker":null}'
    assert_success
    assert_output --partial "raw write"

    assert_valid_state_json
    assert_json_field "position" "Custom"
}

@test "state-write: history preserved across writes" {
    setup_shipyard_dir
    bash "$STATE_WRITE" --phase 1 --position "First" --status planning
    bash "$STATE_WRITE" --phase 2 --position "Second" --status building

    [ -f .shipyard/HISTORY.md ]
    run cat .shipyard/HISTORY.md
    assert_output --partial "Phase 1"
    assert_output --partial "Phase 2"
}

@test "state-write: no arguments exits with error" {
    setup_shipyard_dir
    run bash "$STATE_WRITE"
    assert_failure
    assert_output --partial "No updates provided"
}

# --- Phase 3: atomic writes, schema version, exit codes ---

@test "state-write: structured write includes schema 3" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --phase 1 --position "test" --status ready
    assert_success
    assert_json_field "schema" "3"
}

@test "state-write: atomic write leaves no temp files" {
    setup_shipyard_dir
    bash "$STATE_WRITE" --phase 1 --position "test" --status ready
    run find .shipyard -name "*.tmp.*"
    assert_output ""
}

@test "state-write: missing .shipyard exits code 3" {
    cd "$BATS_TEST_TMPDIR"
    run bash "$STATE_WRITE" --phase 1 --position "test" --status ready
    assert_failure
    assert_equal "$status" 3
}

# --- Phase 3: recovery tests ---

@test "state-write: --recover rebuilds from phase artifacts" {
    setup_shipyard_dir
    mkdir -p .shipyard/phases/2/plans
    echo "# Plan" > .shipyard/phases/2/plans/PLAN-2.1.md

    run bash "$STATE_WRITE" --recover
    assert_success

    assert_valid_state_json
    assert_json_field "schema" "3"
    assert_json_field "phase" "2"
    assert_json_field "status" "planned"
    assert_output --partial "recovered"

    [ -f .shipyard/HISTORY.md ]
    run cat .shipyard/HISTORY.md
    assert_output --partial "recovered"
}

@test "state-write: --recover with no phases defaults to phase 1" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --recover
    assert_success

    assert_valid_state_json
    assert_json_field "phase" "1"
    assert_json_field "status" "ready"
}

@test "state-write: --recover detects completed phase from summary" {
    setup_shipyard_dir
    mkdir -p .shipyard/phases/3/results
    echo "# Summary" > .shipyard/phases/3/results/SUMMARY-3.1.md

    run bash "$STATE_WRITE" --recover
    assert_success

    assert_valid_state_json
    assert_json_field "phase" "3"
    assert_json_field "status" "complete"
}

@test "state-write: --raw rejects invalid JSON" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --raw "not valid json"
    assert_failure
    assert_output --partial "not valid JSON"
}

# --- Teams-aware locking tests ---

@test "state-write: skips locking when SHIPYARD_TEAMS_ENABLED is unset" {
    setup_shipyard_dir
    unset SHIPYARD_TEAMS_ENABLED 2>/dev/null || true
    bash "$STATE_WRITE" --phase 1 --position "solo write" --status ready

    # Compute what the lock path would be and verify it does NOT exist
    local dir_hash
    dir_hash=$(cd .shipyard && pwd | (sha256sum 2>/dev/null || md5sum 2>/dev/null || cksum) | cut -d' ' -f1 | cut -c1-12)
    [ ! -d "${TMPDIR:-/tmp}/shipyard-state-${dir_hash}.lock" ]
}

@test "state-write: acquires mkdir lock when SHIPYARD_TEAMS_ENABLED=true" {
    setup_shipyard_dir

    # Compute the expected lock path
    local dir_hash lock_dir
    dir_hash=$(cd .shipyard && pwd | (sha256sum 2>/dev/null || md5sum 2>/dev/null || cksum) | cut -d' ' -f1 | cut -c1-12)
    lock_dir="${TMPDIR:-/tmp}/shipyard-state-${dir_hash}.lock"

    # Pre-create the lock to simulate contention
    mkdir -p "$lock_dir"

    # Start state-write in background — it should retry while lock exists
    export SHIPYARD_TEAMS_ENABLED=true
    bash "$STATE_WRITE" --phase 1 --position "team write" --status ready &
    local writer_pid=$!

    # Give it a moment to start retrying
    sleep 0.3

    # Release the lock
    rmdir "$lock_dir"

    # Writer should complete successfully
    wait "$writer_pid"
    local exit_code=$?
    [ "$exit_code" -eq 0 ]

    # State should be written correctly
    assert_valid_state_json
    assert_json_field "status" "ready"

    unset SHIPYARD_TEAMS_ENABLED
}

@test "state-write: cleans up lock on exit" {
    setup_shipyard_dir
    export SHIPYARD_TEAMS_ENABLED=true

    bash "$STATE_WRITE" --phase 1 --position "cleanup test" --status ready

    # Compute the lock path and verify it was cleaned up
    local dir_hash lock_dir
    dir_hash=$(cd .shipyard && pwd | (sha256sum 2>/dev/null || md5sum 2>/dev/null || cksum) | cut -d' ' -f1 | cut -c1-12)
    lock_dir="${TMPDIR:-/tmp}/shipyard-state-${dir_hash}.lock"
    [ ! -d "$lock_dir" ]

    unset SHIPYARD_TEAMS_ENABLED
}

@test "state-write: fails when lock cannot be acquired" {
    setup_shipyard_dir

    # Compute the expected lock path
    local dir_hash lock_dir
    dir_hash=$(cd .shipyard && pwd | (sha256sum 2>/dev/null || md5sum 2>/dev/null || cksum) | cut -d' ' -f1 | cut -c1-12)
    lock_dir="${TMPDIR:-/tmp}/shipyard-state-${dir_hash}.lock"

    # Hold the lock for the entire test duration
    mkdir -p "$lock_dir"

    # Run state-write with a very small retry count to speed up the test
    # Override MAX_RETRIES via env var — the script should fail with exit 4 (lock timeout)
    export SHIPYARD_TEAMS_ENABLED=true
    export SHIPYARD_LOCK_MAX_RETRIES=2
    export SHIPYARD_LOCK_RETRY_DELAY=0.05
    run bash "$STATE_WRITE" --phase 1 --position "blocked" --status ready
    assert_failure
    assert_equal "$status" 4
    assert_output --partial "Could not acquire state lock"

    # Clean up the lock
    rmdir "$lock_dir" 2>/dev/null || true

    unset SHIPYARD_TEAMS_ENABLED SHIPYARD_LOCK_MAX_RETRIES SHIPYARD_LOCK_RETRY_DELAY
}
