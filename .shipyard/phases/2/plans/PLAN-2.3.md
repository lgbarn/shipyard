---
phase: testing-foundation
plan: "2.3"
wave: 2
dependencies: ["1.1"]
must_haves:
  - Minimum 6 test cases for state-read.sh
  - At least 1 negative test (no .shipyard directory)
  - Outputs valid JSON in all cases (verified via jq)
  - Context tier auto-detection tested (building -> execution)
  - Minimal tier loads only STATE.md
  - Planning tier includes PROJECT.md and ROADMAP.md
files_touched:
  - test/state-read.bats
tdd: true
---

# PLAN-2.3: state-read.sh unit tests

## Context

`state-read.sh` (178 lines) is the SessionStart hook. It reads `.shipyard/` state,
auto-detects context tier, loads files accordingly, and outputs JSON via jq. It
references `SKILL.md` via `BASH_SOURCE` relative path, so tests must invoke it by
absolute path so the PLUGIN_ROOT resolution works correctly.

Key behaviors to test:
- No `.shipyard/` directory -> "No Shipyard Project Detected" JSON
- Always outputs valid JSON (parseable by jq)
- Tier auto-detection: `building` status -> execution tier
- Minimal tier: only STATE.md loaded
- Planning tier: PROJECT.md + ROADMAP.md included

---

<task id="1" files="test/state-read.bats" tdd="true">
  <action>
  Create `test/state-read.bats` with 3 foundational tests:

  ```bash
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
  ```
  </action>
  <verify>cd "$PROJECT_ROOT" && ./node_modules/.bin/bats test/state-read.bats</verify>
  <done>3 foundational state-read tests pass: no-project JSON, valid structure, minimal tier.</done>
</task>

<task id="2" files="test/state-read.bats" tdd="true">
  <action>
  Append 3 tier-specific tests to `test/state-read.bats`:

  ```bash
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
      run bash "$STATE_READ"
      assert_success

      # Should still produce valid JSON (no crash from missing config)
      echo "$output" | jq . >/dev/null 2>&1
      assert_equal "$?" "0"
  }
  ```
  </action>
  <verify>cd "$PROJECT_ROOT" && ./node_modules/.bin/bats test/state-read.bats</verify>
  <done>All 6 state-read tests pass: no-project, valid JSON, minimal tier, auto-detect execution, planning tier includes PROJECT+ROADMAP, missing config defaults.</done>
</task>
