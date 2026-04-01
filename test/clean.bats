#!/usr/bin/env bats
load test_helper

# Helper: populate .shipyard with typical post-ship artifacts
setup_full_shipyard() {
    setup_shipyard_dir

    # Preserved files
    echo '{"schema":3,"phase":3,"status":"shipped"}' > .shipyard/STATE.json
    echo "backup" > .shipyard/STATE.json.bak
    echo "abc123" > .shipyard/STATE.json.sha256
    echo "# History" > .shipyard/HISTORY.md
    echo '{"version":"1.3"}' > .shipyard/config.json
    printf '*\n' > .shipyard/.gitignore
    echo "# Lessons" > .shipyard/LESSONS.md
    echo "# Issues" > .shipyard/ISSUES.md
    mkdir -p .shipyard/codebase
    echo "# Stack" > .shipyard/codebase/STACK.md

    # Stale files (should be deleted)
    echo "# Project" > .shipyard/PROJECT.md
    echo "# Roadmap" > .shipyard/ROADMAP.md
    echo "# Report" > .shipyard/MILESTONE-REPORT.md
    echo "# Audit" > .shipyard/AUDIT-SHIP.md
    echo "# Docs" > .shipyard/DOCUMENTATION-SHIP.md
    echo "# Pipeline" > .shipyard/PIPELINE-VERIFICATION.md
    echo "# Handoff" > .shipyard/HANDOFF.md.consumed
    echo "# Notes" > .shipyard/NOTES.md

    # Phase directories
    mkdir -p .shipyard/phases/1/plans .shipyard/phases/1/results
    echo "plan" > .shipyard/phases/1/plans/PLAN-1.1.md
    echo "summary" > .shipyard/phases/1/results/SUMMARY-1.1.md
    mkdir -p .shipyard/phases/1-archived-20260321/plans
    echo "old plan" > .shipyard/phases/1-archived-20260321/plans/PLAN-1.1.md
}

# --- Dry run ---

# bats test_tags=unit
@test "clean: --dry-run lists files without deleting" {
    setup_full_shipyard
    run bash "$CLEAN" --dry-run
    assert_success
    assert_output --partial "dry run"
    assert_output --partial "PROJECT.md"
    assert_output --partial "phases"
    # Files should still exist
    [ -f .shipyard/PROJECT.md ]
    [ -d .shipyard/phases ]
}

# --- Confirmation ---

# bats test_tags=unit
@test "clean: cancels when user does not type CLEAN" {
    setup_full_shipyard
    run bash "$CLEAN" <<< "no"
    assert_failure
    assert_output --partial "Cancelled"
    # Files should still exist
    [ -f .shipyard/PROJECT.md ]
}

# bats test_tags=unit
@test "clean: proceeds when user types CLEAN" {
    setup_full_shipyard
    run bash "$CLEAN" <<< "CLEAN"
    assert_success
    assert_output --partial "Cleaned"
    # Stale files gone
    [ ! -f .shipyard/PROJECT.md ]
    [ ! -f .shipyard/ROADMAP.md ]
    [ ! -d .shipyard/phases ]
}

# bats test_tags=unit
@test "clean: --confirm skips confirmation prompt" {
    setup_full_shipyard
    run bash "$CLEAN" --confirm
    assert_success
    assert_output --partial "Cleaned"
    [ ! -f .shipyard/PROJECT.md ]
}

# --- Preserved files ---

# bats test_tags=unit
@test "clean: preserves STATE.json, HISTORY.md, config.json, .gitignore" {
    setup_full_shipyard
    run bash "$CLEAN" --confirm
    assert_success
    [ -f .shipyard/STATE.json ]
    [ -f .shipyard/STATE.json.bak ]
    [ -f .shipyard/STATE.json.sha256 ]
    [ -f .shipyard/HISTORY.md ]
    [ -f .shipyard/config.json ]
    [ -f .shipyard/.gitignore ]
}

# bats test_tags=unit
@test "clean: preserves LESSONS.md and ISSUES.md" {
    setup_full_shipyard
    run bash "$CLEAN" --confirm
    assert_success
    [ -f .shipyard/LESSONS.md ]
    [ -f .shipyard/ISSUES.md ]
}

# bats test_tags=unit
@test "clean: preserves codebase/ directory" {
    setup_full_shipyard
    run bash "$CLEAN" --confirm
    assert_success
    [ -d .shipyard/codebase ]
    [ -f .shipyard/codebase/STACK.md ]
}

# --- Stale files ---

# bats test_tags=unit
@test "clean: removes phase directories including archived" {
    setup_full_shipyard
    run bash "$CLEAN" --confirm
    assert_success
    [ ! -d .shipyard/phases ]
}

# bats test_tags=unit
@test "clean: removes milestone artifacts" {
    setup_full_shipyard
    run bash "$CLEAN" --confirm
    assert_success
    [ ! -f .shipyard/MILESTONE-REPORT.md ]
    [ ! -f .shipyard/AUDIT-SHIP.md ]
    [ ! -f .shipyard/DOCUMENTATION-SHIP.md ]
    [ ! -f .shipyard/PIPELINE-VERIFICATION.md ]
    [ ! -f .shipyard/HANDOFF.md.consumed ]
    [ ! -f .shipyard/NOTES.md ]
}

# --- docs/plans/ cleanup ---

# bats test_tags=unit
@test "clean: removes stale plans from docs/plans/" {
    setup_full_shipyard
    mkdir -p docs/plans
    echo "# Plan" > docs/plans/2026-03-24-feature.md
    run bash "$CLEAN" --confirm
    assert_success
    [ ! -f docs/plans/2026-03-24-feature.md ]
}

# bats test_tags=unit
@test "clean: no error when docs/plans/ does not exist" {
    setup_full_shipyard
    run bash "$CLEAN" --confirm
    assert_success
}

# --- Edge cases ---

# bats test_tags=unit
@test "clean: nothing to clean when only preserved files exist" {
    setup_shipyard_dir
    echo '{"schema":3}' > .shipyard/STATE.json
    echo "# History" > .shipyard/HISTORY.md
    echo '{}' > .shipyard/config.json
    printf '*\n' > .shipyard/.gitignore
    run bash "$CLEAN" --confirm
    assert_success
    assert_output --partial "Nothing to clean"
}

# bats test_tags=unit
@test "clean: exits 3 when .shipyard/ does not exist" {
    cd "$BATS_TEST_TMPDIR"
    run bash "$CLEAN"
    assert_failure
    assert_output --partial "does not exist"
}

# bats test_tags=unit
@test "clean: rejects unknown arguments" {
    setup_shipyard_dir
    run bash "$CLEAN" --force
    assert_failure
    assert_output --partial "Unknown argument"
}

# bats test_tags=unit
@test "clean: --dry-run on already-clean directory shows nothing to clean" {
    setup_shipyard_dir
    echo '{"schema":3}' > .shipyard/STATE.json
    echo "# History" > .shipyard/HISTORY.md
    echo '{}' > .shipyard/config.json
    printf '*\n' > .shipyard/.gitignore
    run bash "$CLEAN" --dry-run
    assert_success
    assert_output --partial "Nothing to clean"
}

# bats test_tags=unit
@test "clean: exits 3 when .shipyard is a symlink" {
    cd "$BATS_TEST_TMPDIR"
    mkdir real_dir
    ln -s real_dir .shipyard
    run bash "$CLEAN"
    assert_failure
    assert_output --partial "symlink"
}
