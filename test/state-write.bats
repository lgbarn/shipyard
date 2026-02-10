#!/usr/bin/env bats
load test_helper

teardown() {
    unset SHIPYARD_TEAMS_ENABLED SHIPYARD_LOCK_MAX_RETRIES SHIPYARD_LOCK_RETRY_DELAY 2>/dev/null || true
    # Kill any lingering background state-write processes
    jobs -p 2>/dev/null | xargs kill 2>/dev/null || true
}

# --- Negative tests: validation ---

# bats test_tags=unit
@test "state-write: --phase rejects non-integer" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --phase "abc" --position "test" --status ready
    assert_failure
    assert_output --partial "positive integer"
}

# bats test_tags=unit
@test "state-write: --status rejects invalid value" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --phase 1 --position "test" --status "bogus"
    assert_failure
    assert_output --partial "must be one of"
}

# bats test_tags=unit
@test "state-write: fails without .shipyard directory" {
    cd "$BATS_TEST_TMPDIR"
    # Do NOT create .shipyard
    run bash "$STATE_WRITE" --phase 1 --position "test" --status ready
    assert_failure
    assert_output --partial ".shipyard"
}

# --- Positive tests: structured writes ---

# bats test_tags=unit
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

# bats test_tags=unit
@test "state-write: raw write replaces STATE.json content" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --raw '{"schema":3,"phase":1,"position":"Custom","status":"ready","updated_at":"2026-01-01T00:00:00Z","blocker":null}'
    assert_success
    assert_output --partial "raw write"

    assert_valid_state_json
    assert_json_field "position" "Custom"
}

# bats test_tags=unit
@test "state-write: history preserved across writes" {
    setup_shipyard_dir
    bash "$STATE_WRITE" --phase 1 --position "First" --status planning
    bash "$STATE_WRITE" --phase 2 --position "Second" --status building

    [ -f .shipyard/HISTORY.md ]
    run cat .shipyard/HISTORY.md
    assert_output --partial "Phase 1"
    assert_output --partial "Phase 2"
}

# bats test_tags=unit
@test "state-write: no arguments exits with error" {
    setup_shipyard_dir
    run bash "$STATE_WRITE"
    assert_failure
    assert_output --partial "No updates provided"
}

# --- Phase 3: atomic writes, schema version, exit codes ---

# bats test_tags=unit
@test "state-write: structured write includes schema 3" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --phase 1 --position "test" --status ready
    assert_success
    assert_json_field "schema" "3"
}

# bats test_tags=unit
@test "state-write: atomic write leaves no temp files" {
    setup_shipyard_dir
    bash "$STATE_WRITE" --phase 1 --position "test" --status ready
    run find .shipyard -name "*.tmp.*"
    assert_output ""
}

# bats test_tags=unit
@test "state-write: missing .shipyard exits code 3" {
    cd "$BATS_TEST_TMPDIR"
    run bash "$STATE_WRITE" --phase 1 --position "test" --status ready
    assert_failure
    assert_equal "$status" 3
}

# --- Phase 3: recovery tests ---

# bats test_tags=unit
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

# bats test_tags=unit
@test "state-write: --recover with no phases defaults to phase 1" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --recover
    assert_success

    assert_valid_state_json
    assert_json_field "phase" "1"
    assert_json_field "status" "ready"
}

# bats test_tags=unit
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

# bats test_tags=unit
@test "state-write: --raw rejects invalid JSON" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --raw "not valid json"
    assert_failure
    assert_output --partial "not valid JSON"
}

# --- Teams-aware locking tests ---

# bats test_tags=unit
@test "state-write: skips locking when SHIPYARD_TEAMS_ENABLED is unset" {
    setup_shipyard_dir
    unset SHIPYARD_TEAMS_ENABLED 2>/dev/null || true
    bash "$STATE_WRITE" --phase 1 --position "solo write" --status ready

    # Compute what the lock path would be and verify it does NOT exist
    [ ! -d "$(compute_lock_dir)" ]
}

# bats test_tags=integration
@test "state-write: acquires mkdir lock when SHIPYARD_TEAMS_ENABLED=true" {
    setup_shipyard_dir

    # Compute the expected lock path
    local lock_dir
    lock_dir="$(compute_lock_dir)"

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
}

# bats test_tags=unit
@test "state-write: cleans up lock on exit" {
    setup_shipyard_dir
    export SHIPYARD_TEAMS_ENABLED=true

    bash "$STATE_WRITE" --phase 1 --position "cleanup test" --status ready

    # Compute the lock path and verify it was cleaned up
    [ ! -d "$(compute_lock_dir)" ]
}

# bats test_tags=unit
@test "state-write: fails when lock cannot be acquired" {
    setup_shipyard_dir

    # Compute the expected lock path
    local lock_dir
    lock_dir="$(compute_lock_dir)"

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
}

# --- Backup-on-write tests ---

# bats test_tags=unit
@test "state-write: creates .bak file on structured write" {
    setup_shipyard_dir
    # First write creates STATE.json (no .bak yet since no prior file)
    bash "$STATE_WRITE" --phase 1 --position "First" --status ready
    [ -f .shipyard/STATE.json ]

    # Second write should create .bak from previous STATE.json
    bash "$STATE_WRITE" --phase 2 --position "Second" --status building
    [ -f .shipyard/STATE.json.bak ]

    # .bak should contain the previous state (phase 1)
    local bak_phase
    bak_phase=$(jq -r '.phase' .shipyard/STATE.json.bak)
    [ "$bak_phase" = "1" ]
}

# bats test_tags=unit
@test "state-write: creates .bak file on raw write" {
    setup_shipyard_dir
    bash "$STATE_WRITE" --phase 1 --position "First" --status ready
    bash "$STATE_WRITE" --raw '{"schema":3,"phase":5,"position":"Raw","status":"ready","updated_at":"2026-01-01T00:00:00Z","blocker":null}'
    [ -f .shipyard/STATE.json.bak ]

    local bak_phase
    bak_phase=$(jq -r '.phase' .shipyard/STATE.json.bak)
    [ "$bak_phase" = "1" ]
}

# --- Checksum tests ---

# bats test_tags=unit
@test "state-write: creates .sha256 checksum file on write" {
    setup_shipyard_dir
    bash "$STATE_WRITE" --phase 1 --position "test" --status ready
    [ -f .shipyard/STATE.json.sha256 ]

    # Checksum should match actual file
    local expected actual
    expected=$(cat .shipyard/STATE.json.sha256)
    actual=$(shasum -a 256 .shipyard/STATE.json | cut -d' ' -f1)
    [ "$expected" = "$actual" ]
}

# --- Working notes tests ---

# bats test_tags=unit
@test "state-write: --note appends timestamped entry to NOTES.md" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --note "Found a bug in auth module"
    assert_success
    assert_output --partial "Note added to NOTES.md"

    [ -f .shipyard/NOTES.md ]
    run cat .shipyard/NOTES.md
    assert_output --partial "Found a bug in auth module"
    # Should have timestamp format
    assert_output --partial "- ["
}

# bats test_tags=unit
@test "state-write: --note works with structured write" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --phase 1 --position "Building" --status in_progress --note "Starting build"
    assert_success
    assert_output --partial "STATE.json updated"
    assert_output --partial "Note added"

    assert_valid_state_json
    [ -f .shipyard/NOTES.md ]
    run cat .shipyard/NOTES.md
    assert_output --partial "Starting build"
}

# bats test_tags=unit
@test "state-write: --note accumulates multiple entries" {
    setup_shipyard_dir
    bash "$STATE_WRITE" --note "First note"
    bash "$STATE_WRITE" --note "Second note"

    run cat .shipyard/NOTES.md
    assert_output --partial "First note"
    assert_output --partial "Second note"
}

# bats test_tags=unit
@test "state-write: phase completion auto-clears NOTES.md" {
    setup_shipyard_dir
    bash "$STATE_WRITE" --note "Working note"
    [ -f .shipyard/NOTES.md ]

    bash "$STATE_WRITE" --phase 1 --position "Done" --status complete
    [ ! -f .shipyard/NOTES.md ]
}

# bats test_tags=unit
@test "state-write: complete_with_gaps also clears NOTES.md" {
    setup_shipyard_dir
    bash "$STATE_WRITE" --note "Working note"
    [ -f .shipyard/NOTES.md ]

    bash "$STATE_WRITE" --phase 1 --position "Done with gaps" --status complete_with_gaps
    [ ! -f .shipyard/NOTES.md ]
}
