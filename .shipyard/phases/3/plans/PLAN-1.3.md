# Plan 1.3: state-write.sh -- Atomic Writes, Schema Version, Recovery, Exit Codes

---
phase: 3
plan: 1.3
wave: 1
dependencies: []
must_haves:
  - Exit code contract documented in script header (0, 1, 2, 3)
  - Atomic writes via mktemp + mv pattern
  - Post-write validation of required fields
  - Schema 2.0 field in all newly written STATE.md files
  - --recover flag rebuilds STATE.md from .shipyard/ artifacts
  - All new behaviors tested
files_touched:
  - scripts/state-write.sh
  - test/state-write.bats
tdd: true
---

## Context

state-write.sh is the most changed script in Phase 3. It receives four enhancements: (1) atomic writes using mktemp + mv to prevent corruption from mid-write kills, (2) a `**Schema:** 2.0` field added to all structured writes, (3) a `--recover` flag that rebuilds STATE.md from .shipyard/ artifacts and git checkpoint tags, and (4) standardized exit codes with post-write validation. This is the highest-risk plan in Wave 1 due to the recovery algorithm complexity.

## Dependencies

None -- this is a Wave 1 plan that can execute in parallel with Plans 1.1 and 1.2. Note that the `--recover` flag will be integration-tested in Plan 2.1, but unit tests are included here.

## Tasks

### Task 1: Add atomic writes, schema version, and exit code contract to state-write.sh
**Files:** scripts/state-write.sh
**Action:** modify
**Description:**

1. **Add exit code contract** to script header (after existing usage comments, before `set -euo pipefail`):
   ```
   # Exit Codes:
   #   0 - Success (STATE.md written or recovered)
   #   1 - User error (invalid --phase, invalid --status, missing required args)
   #   2 - State corruption (post-write validation failed, generated STATE.md is empty/malformed)
   #   3 - Missing dependency (.shipyard/ directory missing, mktemp failed)
   ```

2. **Change .shipyard missing exit code** from 1 to 3 (lines 16-19). This is a dependency issue, not a user error:
   ```bash
   if [ ! -d ".shipyard" ]; then
       echo "Error: .shipyard/ directory does not exist. Run /shipyard:init first." >&2
       exit 3
   fi
   ```

3. **Add `atomic_write` function** before the argument parsing section:
   ```bash
   # Atomic write: write to temp file, validate, then mv (POSIX-atomic replacement)
   atomic_write() {
       local content="$1"
       local target="$2"
       local tmpfile
       tmpfile=$(mktemp "${target}.tmp.XXXXXX" 2>/dev/null) || \
       tmpfile=$(mktemp -t "state-write.XXXXXX") || {
           echo "Error: Failed to create temporary file" >&2
           exit 3
       }
       # Cleanup on unexpected exit
       trap 'rm -f "$tmpfile"' EXIT INT TERM

       printf '%s\n' "$content" > "$tmpfile"

       # Post-write validation: must be non-empty
       if [ ! -s "$tmpfile" ]; then
           echo "Error: Generated STATE.md is empty" >&2
           rm -f "$tmpfile"
           exit 2
       fi

       # Atomic move (same filesystem guarantees atomicity)
       mv "$tmpfile" "$target" || {
           echo "Error: Failed to move temp file to ${target}" >&2
           rm -f "$tmpfile"
           exit 2
       }
       # Clear the trap since file is moved
       trap - EXIT INT TERM
   }
   ```

4. **Add `**Schema:** 2.0` to structured writes**. In the structured write section (lines 93-120), add the schema line right after the `# Shipyard State` header:
   ```bash
   {
       printf '%s\n' "# Shipyard State" ""
       printf '%s\n' "**Schema:** 2.0"
       printf '%s\n' "**Last Updated:** ${TIMESTAMP}" ""
       # ... rest of existing fields ...
   ```

5. **Convert direct file writes to use atomic_write**. Replace the structured write that currently writes directly to `$STATE_FILE`:
   - Capture the structured write output into a variable using a subshell or temp variable
   - Pass it to `atomic_write "$content" "$STATE_FILE"`

   For the structured write section, replace `} > "$STATE_FILE"` with capturing to a variable and calling `atomic_write`:
   ```bash
   NEW_CONTENT=$({
       printf '%s\n' "# Shipyard State" ""
       printf '%s\n' "**Schema:** 2.0"
       printf '%s\n' "**Last Updated:** ${TIMESTAMP}" ""
       # ... all the existing printf statements ...
   })
   atomic_write "$NEW_CONTENT" "$STATE_FILE"
   ```

6. **Convert raw write to use atomic_write** (line 78-81):
   ```bash
   if [ -n "$RAW_CONTENT" ]; then
       atomic_write "$RAW_CONTENT" "$STATE_FILE"
       echo "STATE.md updated (raw write) at ${TIMESTAMP}"
       exit 0
   fi
   ```

**Acceptance Criteria:**
- Structured writes produce STATE.md containing `**Schema:** 2.0`
- No `.tmp.XXXXXX` files left in `.shipyard/` after successful write
- Empty content write is rejected with exit code 2
- Missing `.shipyard/` directory exits with code 3 (not 1)
- All existing state-write tests still pass
- `shellcheck --severity=warning scripts/state-write.sh` exits 0

### Task 2: Add --recover flag to state-write.sh
**Files:** scripts/state-write.sh
**Action:** modify
**Description:**

1. **Add `--recover` to argument parsing** (in the `while` loop, add a new case):
   ```bash
   --recover)
       RECOVER=true
       shift
       ;;
   ```
   Initialize `RECOVER=false` with the other variables at the top.

2. **Add recovery logic** after argument validation but before the raw/structured write sections. If `$RECOVER` is true, execute recovery and exit:
   ```bash
   if [ "$RECOVER" = true ]; then
       echo "Recovering STATE.md from .shipyard/ artifacts..." >&2

       # Find latest phase number from phases/ directories
       latest_phase=""
       if [ -d ".shipyard/phases" ]; then
           latest_phase=$(find .shipyard/phases/ -maxdepth 1 -type d 2>/dev/null | \
               sed 's|.*/||' | grep '^[0-9]' | sort -n | tail -1)
       fi
       latest_phase="${latest_phase:-1}"

       # Determine status from phase artifacts
       recovered_status="ready"
       recovered_position="Recovered state"
       phase_dir=".shipyard/phases/${latest_phase}"
       if [ -d "$phase_dir" ]; then
           if [ -d "${phase_dir}/results" ] && \
              find "${phase_dir}/results/" -name "SUMMARY-*.md" 2>/dev/null | grep -q .; then
               recovered_status="complete"
               recovered_position="Phase ${latest_phase} completed (recovered)"
           elif [ -d "${phase_dir}/plans" ] && \
                find "${phase_dir}/plans/" -name "PLAN-*.md" 2>/dev/null | grep -q .; then
               recovered_status="planned"
               recovered_position="Phase ${latest_phase} planned (recovered)"
           else
               recovered_position="Phase ${latest_phase} (recovered, status unknown)"
           fi
       fi

       # Build recovered history from git checkpoint tags (if available)
       recovered_history=""
       if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
           while IFS= read -r tag; do
               [ -z "$tag" ] && continue
               tag_date=$(echo "$tag" | grep -oE '[0-9]{8}T[0-9]{6}Z' | head -1 || echo "")
               tag_label=$(echo "$tag" | sed 's/^shipyard-checkpoint-//' | sed 's/-[0-9]*T[0-9]*Z$//')
               recovered_history="${recovered_history}- [${tag_date:-unknown}] Checkpoint: ${tag_label}
   "
           done < <(git tag -l "shipyard-checkpoint-*" 2>/dev/null | sort)
       fi

       # Generate recovered STATE.md
       TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
       NEW_CONTENT=$(printf '%s\n' "# Shipyard State" "" \
           "**Schema:** 2.0" \
           "**Last Updated:** ${TIMESTAMP}" \
           "**Current Phase:** ${latest_phase}" \
           "**Current Position:** ${recovered_position}" \
           "**Status:** ${recovered_status}" \
           "" "## History" "" \
           "- [${TIMESTAMP}] State recovered from .shipyard/ artifacts" \
           "${recovered_history}")

       atomic_write "$NEW_CONTENT" "$STATE_FILE"
       echo "STATE.md recovered: Phase=${latest_phase} Status=${recovered_status}" >&2
       exit 0
   fi
   ```

3. **Ensure --recover works without other arguments**. Currently the script requires `--phase`, `--position`, `--status`, or `--raw` -- the "No updates provided" error at the end would trigger. The recovery check must happen before that validation.

**Acceptance Criteria:**
- `bash scripts/state-write.sh --recover` in a project with `.shipyard/phases/2/plans/PLAN-2.1.md` produces a STATE.md with `**Current Phase:** 2` and `**Status:** planned`
- Recovered STATE.md contains `**Schema:** 2.0`
- Recovered STATE.md contains `State recovered` in History section
- Recovery with no phases/ directory defaults to phase 1, status ready
- `--recover` exits 0 on success, exits 2 if generated file is invalid

### Task 3: Add atomic write, schema, and recovery tests to state-write.bats
**Files:** test/state-write.bats
**Action:** modify
**Description:**

Append the following test cases to `test/state-write.bats`:

1. **"state-write: structured write includes Schema 2.0"**:
   ```bash
   @test "state-write: structured write includes Schema 2.0" {
       setup_shipyard_dir
       run bash "$STATE_WRITE" --phase 1 --position "test" --status ready
       assert_success
       run cat .shipyard/STATE.md
       assert_output --partial "**Schema:** 2.0"
   }
   ```

2. **"state-write: atomic write leaves no temp files"**:
   ```bash
   @test "state-write: atomic write leaves no temp files" {
       setup_shipyard_dir
       bash "$STATE_WRITE" --phase 1 --position "test" --status ready
       # No .tmp files should remain
       run find .shipyard -name "*.tmp.*"
       assert_output ""
   }
   ```

3. **"state-write: missing .shipyard exits code 3"**:
   ```bash
   @test "state-write: missing .shipyard exits code 3" {
       cd "$BATS_TEST_TMPDIR"
       run bash "$STATE_WRITE" --phase 1 --position "test" --status ready
       assert_failure
       assert_equal "$status" 3
   }
   ```

4. **"state-write: --recover rebuilds from phase artifacts"**:
   ```bash
   @test "state-write: --recover rebuilds from phase artifacts" {
       setup_shipyard_dir
       mkdir -p .shipyard/phases/2/plans
       echo "# Plan" > .shipyard/phases/2/plans/PLAN-2.1.md

       run bash "$STATE_WRITE" --recover
       assert_success

       run cat .shipyard/STATE.md
       assert_output --partial "**Current Phase:** 2"
       assert_output --partial "**Status:** planned"
       assert_output --partial "**Schema:** 2.0"
       assert_output --partial "recovered"
   }
   ```

5. **"state-write: --recover with no phases defaults to phase 1"**:
   ```bash
   @test "state-write: --recover with no phases defaults to phase 1" {
       setup_shipyard_dir

       run bash "$STATE_WRITE" --recover
       assert_success

       run cat .shipyard/STATE.md
       assert_output --partial "**Current Phase:** 1"
       assert_output --partial "**Status:** ready"
   }
   ```

6. **"state-write: --recover detects completed phase from summary"**:
   ```bash
   @test "state-write: --recover detects completed phase from summary" {
       setup_shipyard_dir
       mkdir -p .shipyard/phases/3/results
       echo "# Summary" > .shipyard/phases/3/results/SUMMARY-3.1.md

       run bash "$STATE_WRITE" --recover
       assert_success

       run cat .shipyard/STATE.md
       assert_output --partial "**Current Phase:** 3"
       assert_output --partial "**Status:** complete"
   }
   ```

**Acceptance Criteria:**
- All six new tests pass
- All seven existing state-write tests still pass
- `npx bats test/state-write.bats` exits 0
- `bash test/run.sh` exits 0

## Verification

```bash
cd /Users/lgbarn/Personal/shipyard
# Run state-write tests specifically
npx bats test/state-write.bats
# Run full suite
bash test/run.sh
# Shellcheck
shellcheck --severity=warning scripts/state-write.sh
# Manual smoke test: recovery
cd /tmp && mkdir -p .shipyard/phases/2/plans && echo "# P" > .shipyard/phases/2/plans/PLAN-2.1.md
bash /Users/lgbarn/Personal/shipyard/scripts/state-write.sh --recover
cat .shipyard/STATE.md
# Should show Phase 2, Status planned, Schema 2.0
rm -rf /tmp/.shipyard
```
