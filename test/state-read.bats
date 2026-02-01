#!/usr/bin/env bats
load test_helper

# --- Core behavior ---

@test "state-read: no .shipyard directory outputs 'No Shipyard Project Detected' JSON" {
    cd "$BATS_TEST_TMPDIR"
    # No .shipyard dir exists
    run bash "$STATE_READ"
    assert_success

    # Must contain the no-project message
    assert_output --partial "No Shipyard Project Detected"

    # Must be valid JSON
    assert_valid_json
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

@test "state-read: minimal tier includes STATE.md but excludes PROJECT.md and ROADMAP.md" {
    setup_shipyard_with_state
    # Set config to minimal tier
    echo '{"context_tier": "minimal"}' > .shipyard/config.json

    # Create files that should NOT appear in minimal tier
    echo "# Should Not Appear" > .shipyard/PROJECT.md
    echo "# Also Hidden" > .shipyard/ROADMAP.md

    run bash "$STATE_READ"
    assert_success
    assert_output --partial "Current Phase"
    assert_output --partial "building"
    refute_output --partial "Should Not Appear"
    refute_output --partial "Also Hidden"
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

    mkdir -p .shipyard/phases
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
    assert_valid_json
}

# --- Corruption detection tests ---

@test "state-read: corrupt STATE.md (missing Status) exits code 2 with JSON error" {
    setup_shipyard_corrupt_state
    run bash "$STATE_READ"
    assert_failure
    assert_equal "$status" 2
    # Output should be valid JSON with error field
    echo "$output" | jq -e '.error' >/dev/null
}

@test "state-read: empty STATE.md exits code 2" {
    setup_shipyard_empty_state
    run bash "$STATE_READ"
    assert_failure
    assert_equal "$status" 2
}

@test "state-read: missing phases directory does not crash (Issue #4)" {
    setup_shipyard_with_state
    # Do NOT create .shipyard/phases/ -- this is the bug trigger
    # Status is "building" which auto-resolves to execution tier, which calls find on phases/
    run bash "$STATE_READ"
    assert_success
    echo "$output" | jq -e '.hookSpecificOutput' >/dev/null
}

# --- Lessons loading tests ---

@test "state-read: execution tier displays Recent Lessons when LESSONS.md exists" {
    setup_shipyard_with_state
    mkdir -p .shipyard/phases/1
    cat > .shipyard/LESSONS.md <<'EOF'
# Shipyard Lessons Learned

## [2026-01-15] Phase 1: Security Hardening

### What Went Well
- shellcheck caught issues early

### Pitfalls to Avoid
- grep -oP is not POSIX-compatible

---

## [2026-01-20] Phase 2: Testing Foundation

### What Went Well
- bats-core integrates well with npm

### Surprises / Discoveries
- set -e interacts poorly with pipelines

---

## [2026-01-25] Phase 3: Reliability

### What Went Well
- atomic writes prevent corruption

---
EOF

    run bash "$STATE_READ"
    assert_success
    assert_valid_json

    # Should contain the section header
    assert_output --partial "Recent Lessons"
    # Should contain at least one lesson entry
    assert_output --partial "Phase 1"
}

@test "state-read: no Recent Lessons section when LESSONS.md does not exist" {
    setup_shipyard_with_state
    mkdir -p .shipyard/phases/1
    # No LESSONS.md file created

    run bash "$STATE_READ"
    assert_success
    assert_valid_json

    refute_output --partial "Recent Lessons"
}

@test "state-read: planning tier does not display lessons even when LESSONS.md exists" {
    setup_shipyard_dir
    cat > .shipyard/STATE.md <<'EOF'
# Shipyard State

**Last Updated:** 2026-01-01T00:00:00Z
**Current Phase:** 1
**Status:** planning
EOF

    mkdir -p .shipyard/phases
    cat > .shipyard/LESSONS.md <<'EOF'
# Shipyard Lessons Learned

## [2026-01-15] Phase 1: Security Hardening

### What Went Well
- shellcheck caught issues early

---
EOF

    run bash "$STATE_READ"
    assert_success
    assert_valid_json

    refute_output --partial "Recent Lessons"
}
