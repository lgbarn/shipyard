# Phase 3 Research: Reliability and State Management

**Date:** 2026-02-01
**Phase:** 3 - Reliability and State Management
**Researcher:** Domain Researcher Agent
**Status:** Complete

---

## Executive Summary

Phase 3 adds reliability features to Shipyard's state management: standardized exit codes, corruption detection/recovery, atomic writes, and schema versioning. This research identifies current gaps, evaluates implementation approaches, and recommends specific solutions compatible with the existing bash/jq/git stack on macOS and Linux.

**Key Findings:**
- Current scripts use inconsistent exit codes (mostly implicit 0 or 1)
- `state-write.sh` writes directly to STATE.md (non-atomic, corruption risk)
- `state-read.sh` crashes when `.shipyard/phases/` is missing (known bug #4)
- No corruption detection or recovery mechanism exists
- No schema versioning in STATE.md format

**Recommended Approach:**
- Use standard exit codes: 0=success, 1=user error, 2=state corruption, 3=missing dependency
- Implement atomic writes via `mktemp` + `mv` pattern (POSIX-compatible)
- Add validation on read with structured JSON error output
- Fix phases/ bug with `-d` existence check before `find`
- Add `schema: 2.0` field to STATE.md header
- Implement `--recover` flag in state-write.sh to rebuild from artifacts

---

## 1. Technology Options

### 1.1 Exit Code Standards

**Option A: Minimal Exit Codes (0, 1)**
- **Approach:** Use only 0 for success, 1 for any failure
- **Pros:** Simplest implementation, least testing burden
- **Cons:** Cannot distinguish error types for automated recovery or monitoring
- **Maturity:** Universal standard, well-understood
- **Recommendation:** ❌ Not recommended - insufficient granularity for reliability goals

**Option B: Standard Script Exit Codes (0, 1, 2)**
- **Approach:** 0=success, 1=general error, 2=misuse/invalid arguments
- **Pros:** Common convention, matches bash built-ins
- **Cons:** No distinction between state corruption and missing dependencies
- **Maturity:** Widely adopted (used by curl, grep, etc.)
- **Recommendation:** ❌ Not recommended - doesn't cover all Phase 3 needs

**Option C: Custom 4-Code Standard (0, 1, 2, 3)**
- **Approach:** 0=success, 1=user error, 2=state corruption, 3=missing dependency
- **Pros:** Distinguishes all error classes needed for recovery automation
- **Cons:** Custom convention requires documentation
- **Maturity:** Custom, but similar to systemd service exit codes
- **Recommendation:** ✅ **RECOMMENDED** - meets all requirements

| Exit Code | Meaning | Examples | Recovery Action |
|-----------|---------|----------|-----------------|
| 0 | Success | Command completed normally | None |
| 1 | User Error | Invalid phase number, bad status value, missing required args | Fix command and retry |
| 2 | State Corruption | Truncated STATE.md, missing required fields, malformed JSON | Run `--recover` |
| 3 | Missing Dependency | jq not found, git not found, not a git repo | Install tool or init git |

### 1.2 Atomic Write Patterns

**Option A: Direct Write with Backup**
- **Approach:** Copy STATE.md to STATE.md.bak, then overwrite
- **Pros:** Simple, easy to understand
- **Cons:** Not truly atomic, corruption window still exists
- **Example:**
  ```bash
  cp STATE.md STATE.md.bak
  printf '%s\n' "$content" > STATE.md
  ```
- **Recommendation:** ❌ Not recommended - doesn't solve corruption risk

**Option B: Write-to-Temp + Atomic Move**
- **Approach:** Write to temp file, then `mv` over original (atomic on POSIX)
- **Pros:** True atomic replacement, POSIX-guaranteed, handles kill/crash mid-write
- **Cons:** Requires cleanup if script crashes before mv
- **Maturity:** Industry standard (used by package managers, config tools)
- **Example:**
  ```bash
  TMPFILE=$(mktemp "${STATE_FILE}.XXXXXX")
  printf '%s\n' "$content" > "$TMPFILE"
  mv "$TMPFILE" "$STATE_FILE"
  ```
- **Recommendation:** ✅ **RECOMMENDED** - battle-tested pattern

**Option C: File Locking (flock)**
- **Approach:** Use `flock` to prevent concurrent writes
- **Pros:** Prevents race conditions in multi-process scenarios
- **Cons:** Not available on all systems, adds complexity, doesn't prevent corruption from crash
- **Maturity:** Linux-standard, not POSIX (macOS via Homebrew)
- **Recommendation:** ❌ Not recommended - overkill for single-user tool, portability issues

**Implementation Details for Option B:**

```bash
# Cross-platform mktemp usage
# macOS requires template, Linux works with or without
STATE_FILE=".shipyard/STATE.md"
TMPFILE=$(mktemp "${STATE_FILE}.XXXXXX" 2>/dev/null || mktemp -t "state-write")

# Trap to ensure cleanup
cleanup() {
    [ -f "$TMPFILE" ] && rm -f "$TMPFILE"
}
trap cleanup EXIT INT TERM

# Write content
printf '%s\n' "$content" > "$TMPFILE"

# Validate before moving (optional but recommended)
if [ ! -s "$TMPFILE" ]; then
    echo "Error: Generated STATE.md is empty" >&2
    exit 2
fi

# Atomic move
mv "$TMPFILE" "$STATE_FILE"
```

### 1.3 State Validation Strategies

**Option A: Required Fields Check**
- **Approach:** Grep for mandatory fields, fail if missing
- **Pros:** Fast, simple, no dependencies
- **Cons:** Doesn't validate format, can be fooled by partial matches
- **Example:**
  ```bash
  grep -q "^**Current Phase:**" STATE.md || exit 2
  grep -q "^**Status:**" STATE.md || exit 2
  ```
- **Recommendation:** ✅ **RECOMMENDED** for initial implementation

**Option B: Parse and Validate All Fields**
- **Approach:** Extract each field, validate format/type
- **Pros:** Comprehensive, catches malformed data
- **Cons:** More code, slower, fragile to format changes
- **Recommendation:** ⚠️ Consider for future enhancement

**Option C: Schema Validation (JSON Schema, etc.)**
- **Approach:** Convert to JSON, validate against schema
- **Pros:** Formal validation, machine-readable errors
- **Cons:** Requires conversion layer, new dependency (unless using jq)
- **Recommendation:** ❌ Not recommended - over-engineered for markdown state

**Required Fields Definition:**

Based on current STATE.md structure and script usage:
- `**Last Updated:**` - Timestamp of last state change
- `**Current Phase:**` - Integer phase number
- `**Status:**` - Enum value (ready, planned, planning, building, etc.)
- `## History` - Section header (content optional but section must exist)

Optional fields:
- `**Current Position:**` - Human-readable description
- Blocker information
- Schema version (new in 2.0)

### 1.4 Recovery Mechanisms

**Option A: Rebuild from Git History**
- **Approach:** Parse git log for checkpoint tags, extract phase from tag names
- **Pros:** Uses existing checkpoint infrastructure
- **Cons:** Incomplete - doesn't capture current position or blockers
- **Recommendation:** ⚠️ Partial solution, needs augmentation

**Option B: Rebuild from .shipyard/ Artifacts**
- **Approach:** Scan phases/ directories, find latest plan/summary files
- **Pros:** More complete state information, doesn't require git
- **Cons:** Requires parsing multiple files, may not have accurate status
- **Example Logic:**
  ```bash
  # Find highest phase number with content
  latest_phase=$(find .shipyard/phases/ -maxdepth 1 -type d -name "[0-9]*" | \
                 sed 's/.*\///' | sort -n | tail -1)

  # Check for completed summary
  if [ -f ".shipyard/phases/$latest_phase/results/SUMMARY-*.md" ]; then
      status="complete"
  elif [ -f ".shipyard/phases/$latest_phase/plans/PLAN-*.md" ]; then
      status="planned"
  else
      status="ready"
  fi
  ```
- **Recommendation:** ✅ **RECOMMENDED** as primary recovery method

**Option C: Hybrid Approach**
- **Approach:** Use artifacts for phase/status, git history for timeline
- **Pros:** Most complete recovery, preserves history
- **Cons:** More complex, depends on both git and artifacts
- **Recommendation:** ✅ **RECOMMENDED** for comprehensive recovery

**Recovery Algorithm:**

1. Detect .shipyard/ directory exists (exit 3 if not)
2. Scan `.shipyard/phases/` for highest numbered phase directory
3. Check phase directory for completion markers:
   - `results/SUMMARY-*.md` exists → `complete`
   - `plans/PLAN-*.md` exists → `planned`
   - Directory exists but empty → `ready`
4. Extract history from git checkpoint tags (if available)
5. Generate new STATE.md with recovered values + `schema: 2.0`
6. Add recovery marker to history: `[timestamp] State recovered from artifacts`

---

## 2. Recommended Approach

### 2.1 Exit Code Implementation

**Contract Definition:**

Add to all three script headers:
```bash
# Exit Codes:
#   0 - Success
#   1 - User error (invalid arguments, missing required options)
#   2 - State corruption (malformed STATE.md, missing required fields)
#   3 - Missing dependency (jq/git not found, not a git repo)
```

**state-read.sh Exit Points:**
- 0: Normal execution, JSON output produced
- 1: Invalid tier value in config.json
- 2: STATE.md missing required fields, malformed structure
- 3: jq not found in PATH

**state-write.sh Exit Points:**
- 0: STATE.md written successfully
- 1: Invalid --phase (non-integer), invalid --status (not in enum), missing required args
- 2: Post-write validation failed (STATE.md is empty or malformed)
- 3: .shipyard/ directory missing (should be caught early), mktemp failed

**checkpoint.sh Exit Points:**
- 0: Tag created or pruned successfully, OR not a git repo (warning printed)
- 1: Invalid --prune days (non-integer), label sanitization resulted in empty string
- 3: git command failed for reason other than "not a repo"

### 2.2 Atomic Write Implementation

**Modify state-write.sh lines 77-81** (raw write section) and **lines 92-120** (structured write section):

```bash
# Function to perform atomic write
atomic_write() {
    local content="$1"
    local target="$STATE_FILE"

    # Create temp file in same directory (ensures same filesystem for atomic mv)
    local tmpfile
    tmpfile=$(mktemp "${target}.tmp.XXXXXX") || {
        echo "Error: Failed to create temporary file" >&2
        exit 3
    }

    # Ensure cleanup on exit
    trap 'rm -f "$tmpfile"' EXIT INT TERM

    # Write content to temp file
    printf '%s\n' "$content" > "$tmpfile"

    # Validate non-empty
    if [ ! -s "$tmpfile" ]; then
        echo "Error: Generated STATE.md is empty (validation failed)" >&2
        rm -f "$tmpfile"
        exit 2
    fi

    # Validate required fields
    if ! grep -q "^**Current Phase:**" "$tmpfile" || \
       ! grep -q "^**Status:**" "$tmpfile" || \
       ! grep -q "^## History" "$tmpfile"; then
        echo "Error: Generated STATE.md missing required fields" >&2
        rm -f "$tmpfile"
        exit 2
    fi

    # Atomic move
    mv "$tmpfile" "$target" || {
        echo "Error: Failed to move temp file to STATE.md" >&2
        exit 2
    }
}
```

### 2.3 State Corruption Detection

**Add to state-read.sh after reading STATE.md** (around line 21):

```bash
if [ -f ".shipyard/STATE.md" ]; then
    state_md=$(cat ".shipyard/STATE.md" 2>/dev/null || echo "")

    # Validate STATE.md has required fields
    if [ -z "$state_md" ]; then
        echo '{"error": "State file is empty", "exitCode": 2}' | jq .
        exit 2
    fi

    if ! echo "$state_md" | grep -q "^**Status:**"; then
        cat <<EOF | jq .
{
  "error": "STATE.md is corrupt or incomplete",
  "details": "Missing required field: **Status:**",
  "exitCode": 2,
  "recovery": "Run: bash scripts/state-write.sh --recover"
}
EOF
        exit 2
    fi

    if ! echo "$state_md" | grep -q "^**Current Phase:**"; then
        cat <<EOF | jq .
{
  "error": "STATE.md is corrupt or incomplete",
  "details": "Missing required field: **Current Phase:**",
  "exitCode": 2,
  "recovery": "Run: bash scripts/state-write.sh --recover"
}
EOF
        exit 2
    fi

    # Continue with normal processing...
fi
```

### 2.4 Schema Versioning

**STATE.md Format with Schema Version:**

```markdown
# Shipyard State

**Schema:** 2.0
**Last Updated:** 2026-02-01T12:00:00Z
**Current Phase:** 3
**Current Position:** Planning reliability features
**Status:** planning

## History

- [2026-02-01T12:00:00Z] Phase 3: Planning reliability features (planning)
```

**Add to state-write.sh structured write section:**

```bash
printf '%s\n' "# Shipyard State" ""
printf '%s\n' "**Schema:** 2.0"
printf '%s\n' "**Last Updated:** ${TIMESTAMP}" ""
```

**Version Migration Path:**
- v1.x STATE.md: No schema field → scripts treat as 1.x format
- v2.0 STATE.md: `**Schema:** 2.0` → scripts validate against 2.0 requirements
- Future: Add schema detection to enable backward compatibility or migration warnings

### 2.5 Recovery Implementation

**Add --recover flag to state-write.sh:**

```bash
# New argument parsing
RECOVER=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        --recover)
            RECOVER=true
            shift
            ;;
        # ... existing cases ...
    esac
done

# Recovery logic (before normal write operations)
if [ "$RECOVER" = true ]; then
    echo "Attempting to recover STATE.md from .shipyard/ artifacts..." >&2

    # Find latest phase
    latest_phase=""
    if [ -d ".shipyard/phases" ]; then
        latest_phase=$(find .shipyard/phases/ -maxdepth 1 -type d -name "[0-9]*" 2>/dev/null | \
                       sed 's/.*\///' | sed 's/^0*//' | sort -n | tail -1)
    fi

    if [ -z "$latest_phase" ]; then
        latest_phase="1"
        recovered_status="ready"
        recovered_position="Recovered - no phase artifacts found"
    else
        # Determine status from artifacts
        phase_dir=".shipyard/phases/${latest_phase}"
        if [ -d "$phase_dir" ]; then
            # Check for different completion markers
            if find "$phase_dir/results/" -name "SUMMARY-*.md" 2>/dev/null | grep -q .; then
                recovered_status="complete"
                recovered_position="Phase $latest_phase completed (recovered from summary)"
            elif find "$phase_dir/plans/" -name "PLAN-*.md" 2>/dev/null | grep -q .; then
                recovered_status="planned"
                recovered_position="Phase $latest_phase planned (recovered from plans)"
            else
                recovered_status="ready"
                recovered_position="Phase $latest_phase ready (recovered from directory)"
            fi
        else
            recovered_status="ready"
            recovered_position="Recovered state"
        fi
    fi

    # Extract history from git if available
    recovered_history=""
    if git rev-parse --git-dir >/dev/null 2>&1; then
        # Get checkpoint tags
        while IFS= read -r tag; do
            [ -z "$tag" ] && continue
            # Extract timestamp and label from tag
            tag_date=$(echo "$tag" | grep -oE '[0-9]{8}T[0-9]{6}Z' | sed 's/\(....\)\(..\)\(..\)T\(..\)\(..\)\(..\)Z/\1-\2-\3T\4:\5:\6Z/')
            tag_label=$(echo "$tag" | sed 's/shipyard-checkpoint-//' | sed 's/-[0-9]*T[0-9]*Z$//')
            recovered_history="${recovered_history}- [${tag_date:-unknown}] Checkpoint: ${tag_label}\n"
        done < <(git tag -l "shipyard-checkpoint-*" 2>/dev/null | sort)
    fi

    # Build recovered STATE.md
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    {
        printf '%s\n' "# Shipyard State" ""
        printf '%s\n' "**Schema:** 2.0"
        printf '%s\n' "**Last Updated:** ${timestamp}"
        printf '%s\n' "**Current Phase:** ${latest_phase}"
        printf '%s\n' "**Current Position:** ${recovered_position}"
        printf '%s\n' "**Status:** ${recovered_status}"
        printf '%s\n' "" "## History" ""
        printf '%s\n' "- [${timestamp}] State recovered from .shipyard/ artifacts"
        if [ -n "$recovered_history" ]; then
            printf '%b' "$recovered_history"
        fi
    } > "${STATE_FILE}.recovered"

    # Validate recovered file
    if [ -s "${STATE_FILE}.recovered" ] && \
       grep -q "^**Current Phase:**" "${STATE_FILE}.recovered" && \
       grep -q "^**Status:**" "${STATE_FILE}.recovered"; then
        mv "${STATE_FILE}.recovered" "$STATE_FILE"
        echo "✓ STATE.md recovered successfully" >&2
        echo "  Phase: $latest_phase" >&2
        echo "  Status: $recovered_status" >&2
        exit 0
    else
        echo "Error: Recovery generated invalid STATE.md" >&2
        rm -f "${STATE_FILE}.recovered"
        exit 2
    fi
fi
```

### 2.6 Known Bug Fix: state-read.sh Phases Directory

**Current Bug (Issue #4):**
Line 74 of state-read.sh: `find .shipyard/phases/` fails with exit 1 when directory doesn't exist, causing script to abort under `set -euo pipefail`.

**Fix:**
```bash
# OLD (line 73-74):
# Find phase directory (handles zero-padded names like 01-name)
phase_dir=$(find .shipyard/phases/ -maxdepth 1 -type d -name "${phase}*" -o -name "0${phase}*" 2>/dev/null | head -1)

# NEW:
# Find phase directory (handles zero-padded names like 01-name)
if [ -d ".shipyard/phases" ]; then
    phase_dir=$(find .shipyard/phases/ -maxdepth 1 -type d -name "${phase}*" -o -name "0${phase}*" 2>/dev/null | head -1)
else
    phase_dir=""
fi
```

**Additional fixes needed in same section:**
- Line 79: Check if plans/ directory exists before looping
- Line 88: Check if results/ directory exists before finding summaries

### 2.7 Dirty Worktree Warning (checkpoint.sh)

**Add after successful tag creation** (after line 48):

```bash
git tag -a "$TAG" -m "Shipyard checkpoint: ${LABEL}" 2>/dev/null || {
    echo "Warning: Could not create checkpoint tag (not in a git repo or no commits yet)" >&2
    exit 0
}

echo "Checkpoint created: ${TAG}"

# Warn if worktree is dirty
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "Warning: Git worktree has uncommitted changes" >&2
    echo "  Consider committing before checkpointing for clean rollback points" >&2
fi

exit 0
```

---

## 3. Potential Risks and Mitigations

### 3.1 Atomic Write Race Conditions

**Risk:** Multiple processes writing to STATE.md simultaneously could corrupt state.

**Likelihood:** Low - Shipyard is designed for single-user, sequential usage.

**Mitigation:**
- Atomic `mv` ensures only one write completes
- Temp files use unique names (mktemp guarantees uniqueness)
- Future: Add flock if concurrent usage becomes a requirement

### 3.2 Recovery Incompleteness

**Risk:** Recovery may not accurately reconstruct state if artifacts are missing or incomplete.

**Likelihood:** Medium - User may delete phase directories or run recovery in partial state.

**Mitigation:**
- Recovery always produces valid STATE.md (even if conservative)
- Mark recovered state clearly in history with timestamp
- Default to "ready" status if uncertain (safest assumption)
- Document recovery limitations in script header

**Example Edge Case:**
```bash
# User deleted phases/2/ but phases/3/ exists
# Recovery will find phase 3, but history is incomplete
# Mitigation: Set status to "ready" and position to "Recovered - verify phase status"
```

### 3.3 mktemp Portability

**Risk:** `mktemp` behavior differs between macOS (BSD) and Linux (GNU).

**Likelihood:** High - Will be encountered in cross-platform usage.

**Known Differences:**
- macOS requires template argument: `mktemp -t prefix` or `mktemp template.XXXXXX`
- Linux accepts both forms
- Exit codes differ on failure

**Mitigation:**
```bash
# Portable pattern (works on both platforms)
TMPFILE=$(mktemp "${STATE_FILE}.tmp.XXXXXX" 2>/dev/null) || \
TMPFILE=$(mktemp -t "state-write.XXXXXX")

# Alternative: Try both forms
if ! TMPFILE=$(mktemp "${STATE_FILE}.tmp.XXXXXX" 2>/dev/null); then
    TMPFILE=$(mktemp) || {
        echo "Error: Cannot create temp file" >&2
        exit 3
    }
fi
```

### 3.4 Exit Code Backward Compatibility

**Risk:** Existing scripts or users relying on current exit codes may break.

**Likelihood:** Low - Currently exit codes are not formally documented.

**Mitigation:**
- Document all exit codes in script headers
- Update any wrapper scripts or skill definitions
- Add exit code tests to Phase 2 test suite
- Consider this a breaking change for v2.0 (acceptable per PROJECT.md)

### 3.5 Validation False Positives

**Risk:** Required field check could fail if STATE.md format changes slightly (whitespace, capitalization).

**Likelihood:** Medium - Markdown is flexible, users might hand-edit.

**Mitigation:**
- Use anchored grep patterns (`^` prefix) but allow trailing whitespace
- Don't validate field values in read path (only presence)
- Provide clear error messages with field name
- Consider case-insensitive matching if users edit manually:
  ```bash
  grep -iq "^**current phase:**" STATE.md
  ```

### 3.6 Schema Version Migration Path

**Risk:** No clear path for migrating v1.x STATE.md to v2.0 format.

**Likelihood:** High - Existing Shipyard users will have v1.x state.

**Mitigation:**
- Auto-detect missing schema field → treat as 1.x
- On first write with v2.0 scripts, add schema field automatically
- Document manual migration in CHANGELOG:
  ```bash
  # Migration command
  sed -i.bak '3i\
  **Schema:** 2.0' .shipyard/STATE.md
  ```
- OR: Make schema field optional, only validate if present

---

## 4. Relevant Documentation Links

### Bash and Shell Scripting

- **Bash Exit Status:** https://www.gnu.org/software/bash/manual/html_node/Exit-Status.html
  - Defines conventional exit codes (0, 1, 2 for misuse)
- **POSIX Shell Specification:** https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html
  - Reference for portable shell scripting patterns
- **ShellCheck Wiki:** https://www.shellcheck.net/wiki/
  - Common pitfalls and best practices (already used in Phase 1)

### Atomic File Operations

- **`mv` Atomicity Guarantee:** https://pubs.opengroup.org/onlinepubs/9699919799/functions/rename.html
  - POSIX guarantees atomic replacement when source/dest on same filesystem
- **mktemp Man Page:** https://man7.org/linux/man-pages/man1/mktemp.1.html
  - Linux version, documents template syntax
- **BSD mktemp:** https://www.freebsd.org/cgi/man.cgi?query=mktemp
  - macOS version, different options

### State Management Patterns

- **Git Internal File Handling:** https://github.com/git/git/blob/master/refs.c
  - Example of atomic writes in production tool (lock + rename pattern)
- **systemd Exit Codes:** https://www.freedesktop.org/software/systemd/man/systemd.exec.html#Process%20Exit%20Codes
  - Industry example of custom exit code conventions

### Testing Resources

- **bats-core Documentation:** https://bats-core.readthedocs.io/
  - Already in use, will add tests for exit codes
- **Testing Exit Codes in Bats:** https://bats-core.readthedocs.io/en/stable/tutorial.html#exit-status
  - `assert_failure`, `assert_success` usage

### Known Issues

- **Issue #4 (state-read.sh phases/ bug):** Tracked in `.shipyard/ISSUES.md`, line 10
  - Direct link to fix: Add directory existence check before `find`

---

## 5. Implementation Considerations

### 5.1 Integration Points with Existing Codebase

**state-write.sh:**
- Line 77-81: Raw write section → needs atomic write wrapper
- Line 92-120: Structured write section → needs atomic write wrapper + schema field
- Add new recovery section before main logic (lines 85-90)
- Validation can reuse existing field check patterns (lines 61-75)

**state-read.sh:**
- Line 19-22: STATE.md read section → needs corruption detection
- Line 74: phases/ find bug → add directory check
- Line 79-97: Phase context loading → add existence checks for plans/ and results/
- Add jq existence check in early script (before first use at line 35)

**checkpoint.sh:**
- Line 48-51: Tag creation section → add dirty worktree check
- No exit code changes needed (already returns 0 on "not a git repo")
- Prune section (lines 16-33) already validates integer input

**test/state-read.bats:**
- Add test for corrupt STATE.md (missing Status field) → expect exit 2
- Add test for missing jq → expect exit 3
- Add test for phases/ directory missing → should not crash
- Update test helper to optionally create corrupted STATE.md

**test/state-write.bats:**
- Add test for atomic write (kill mid-write simulation may be impractical)
- Add test for post-write validation failure → expect exit 2
- Add test for --recover flag → verify recovered STATE.md structure
- Add test for schema field presence in output

**test/checkpoint.bats:**
- Add test for dirty worktree warning (create uncommitted changes, verify warning)
- Existing tests already cover validation

**test/integration.bats:**
- Add test: corrupt STATE.md → recovery → read → verify successful round-trip
- Add test: write with kill simulation (hard to implement, may defer)

### 5.2 Migration Concerns

**Existing Users:**
- v1.x STATE.md files don't have schema field
- v2.0 scripts should accept both formats on read
- v2.0 scripts should add schema field on first write

**Migration Script (Optional):**
```bash
# One-time migration for existing Shipyard projects
if [ -f ".shipyard/STATE.md" ] && ! grep -q "^**Schema:**" .shipyard/STATE.md; then
    sed -i.v1backup '2a\
**Schema:** 2.0
' .shipyard/STATE.md
    echo "Migrated STATE.md to v2.0 schema"
fi
```

**Breaking Changes:**
- Exit codes: New convention (unlikely to break users - not documented in v1.x)
- STATE.md format: Backward compatible on read, schema field added on write
- Recovery flag: New feature, no breakage

### 5.3 Performance Implications

**Atomic Writes:**
- Additional overhead: ~1-5ms for mktemp + mv vs direct write
- Negligible for Shipyard's use case (state updates are infrequent)
- No measurable impact on user experience

**Validation:**
- 3-4 grep calls per read: ~1ms total
- STATE.md is small (~50-200 lines), parsing is instant
- No performance concern

**Recovery:**
- Find operations on `.shipyard/phases/`: ~10-50ms depending on phase count
- Git tag listing: ~20-100ms for typical repo
- Recovery is manual operation, performance not critical
- Total recovery time: <200ms for typical project

### 5.4 Testing Strategies

**Exit Code Testing:**
```bats
@test "state-write: missing .shipyard exits with code 3" {
    cd "$BATS_TEST_TMPDIR"
    run bash "$STATE_WRITE" --phase 1 --position "test" --status ready
    assert_equal "$status" "3"
}

@test "state-read: corrupt STATE.md exits with code 2" {
    setup_shipyard_dir
    echo "# Broken State" > .shipyard/STATE.md
    run bash "$STATE_READ"
    assert_equal "$status" "2"
    echo "$output" | jq -e '.error'
}
```

**Atomic Write Testing:**
```bats
@test "state-write: atomic write produces valid STATE.md" {
    setup_shipyard_dir
    bash "$STATE_WRITE" --phase 1 --position "test" --status ready

    # Verify no .tmp files left behind
    run find .shipyard -name "*.tmp.*"
    assert_equal "$output" ""

    # Verify STATE.md is well-formed
    grep -q "^**Schema:** 2.0" .shipyard/STATE.md
    grep -q "^**Status:**" .shipyard/STATE.md
}
```

**Recovery Testing:**
```bats
@test "state-write: --recover rebuilds from artifacts" {
    setup_shipyard_dir
    mkdir -p .shipyard/phases/2/plans
    echo "# Plan" > .shipyard/phases/2/plans/PLAN-2.1.md

    # Remove STATE.md
    rm .shipyard/STATE.md

    # Recover
    run bash "$STATE_WRITE" --recover
    assert_success

    # Verify recovered state
    grep -q "^**Current Phase:** 2" .shipyard/STATE.md
    grep -q "^**Status:** planned" .shipyard/STATE.md
    grep -q "State recovered" .shipyard/STATE.md
}
```

**Bug Fix Testing:**
```bats
@test "state-read: missing phases directory does not crash" {
    setup_shipyard_with_state
    # Do NOT create .shipyard/phases/

    run bash "$STATE_READ"
    assert_success  # Should not crash with exit 1
    echo "$output" | jq -e '.hookSpecificOutput'
}
```

### 5.5 Rollback Plan

If Phase 3 changes introduce regressions:

1. **Immediate Rollback:**
   - Revert commits for state-write.sh, state-read.sh, checkpoint.sh
   - Keep test additions (don't lose test coverage)
   - Document rollback reason in ISSUES.md

2. **Partial Rollback:**
   - Keep exit code standardization (low risk)
   - Revert atomic writes if temp file issues arise
   - Revert recovery if algorithm proves incomplete

3. **Git Checkpoints:**
   - Create checkpoint before starting Phase 3 implementation: `bash scripts/checkpoint.sh pre-phase-3`
   - Create checkpoint after each script modification
   - Use `git revert` for clean rollback history

4. **Test-Driven Rollback:**
   - If any Phase 2 test starts failing, rollback immediately
   - Don't merge Phase 3 until all existing tests pass + new tests pass

---

## 6. Open Questions and Further Investigation

### 6.1 Questions Requiring Decisions

**Q1: Should recovery be a separate script or a flag in state-write.sh?**
- **Recommendation:** Flag in state-write.sh (`--recover`)
- **Rationale:** Simpler to maintain, reuses existing write logic, clearer UX
- **Alternative:** Separate `scripts/recover.sh` if recovery logic becomes complex

**Q2: Should schema field be mandatory in v2.0 STATE.md?**
- **Recommendation:** Add on write, optional on read (backward compatible)
- **Rationale:** Allows gradual migration, doesn't break existing projects
- **Future:** Make mandatory in v3.0 after migration period

**Q3: What should recovery do if it finds conflicting artifacts?**
- **Example:** phases/3/plans/ exists but phases/2/results/ is missing
- **Recommendation:** Use highest phase number, set status to "ready" (conservative)
- **Rationale:** User can manually correct status, safer than assuming completion

**Q4: Should atomic write validation be strict or lenient?**
- **Strict:** Fail if any field is missing or malformed
- **Lenient:** Only check critical fields (phase, status)
- **Recommendation:** Lenient - check required fields only
- **Rationale:** Allows flexibility for future STATE.md enhancements

### 6.2 Areas for Future Enhancement

**E1: Incremental State Backup**
- Maintain `.shipyard/STATE.md.history/` with timestamped backups
- Enables rollback to specific state snapshots
- Deferred to Phase 4+ (not critical for v2.0)

**E2: State Locking for Concurrent Access**
- Add `flock` support for multi-process safety
- Low priority - Shipyard is single-user tool
- Revisit if concurrent execution becomes a use case

**E3: JSON State Format**
- Replace markdown STATE.md with STATE.json
- Benefits: Easier parsing, formal schema validation
- Drawback: Less human-readable, breaks v1.x compatibility
- Deferred indefinitely (markdown is a feature, not a bug)

**E4: Automated State Corruption Detection in Hooks**
- Run validation on every session start (state-read.sh)
- Auto-trigger recovery if corruption detected
- Risk: Could be annoying if false positives
- Consider for v2.1+ based on user feedback

### 6.3 Inconclusive Research Areas

**I1: Optimal Temp File Cleanup Strategy**
- Current: `trap cleanup EXIT INT TERM`
- Alternative: Keep temp files for debugging (add `.gitignore` rule)
- **Decision needed:** Cleanup vs debugging aid tradeoff

**I2: Recovery History Reconstruction Accuracy**
- Git checkpoint tags may not capture all state transitions
- Phase artifacts may be incomplete or deleted
- **Further investigation:** User testing needed to validate recovery UX

**I3: Exit Code 2 vs Exit Code 3 Boundary**
- Edge case: STATE.md exists but is empty - corruption (2) or missing dependency (3)?
- Edge case: jq returns invalid JSON - corruption (2) or jq bug (3)?
- **Decision needed:** Establish clearer boundary in edge cases

---

## 7. Summary and Next Steps

### Recommended Implementation Order

1. **Fix Known Bug (Issue #4)** - state-read.sh phases/ directory check
   - Low risk, high value, unblocks execution tier testing
   - Estimated effort: 15 minutes

2. **Add Exit Code Contract** - Update all three script headers
   - Zero code changes initially, just documentation
   - Estimated effort: 30 minutes

3. **Implement Atomic Writes** - state-write.sh refactor
   - Moderate risk, test thoroughly with Phase 2 tests
   - Estimated effort: 2 hours (implementation + testing)

4. **Add Schema Version Field** - state-write.sh output format
   - Low risk, simple addition to structured write
   - Estimated effort: 30 minutes

5. **Implement Corruption Detection** - state-read.sh validation
   - Moderate risk, needs comprehensive error JSON format
   - Estimated effort: 1.5 hours

6. **Implement Recovery** - state-write.sh --recover flag
   - High complexity, requires careful testing
   - Estimated effort: 3 hours (algorithm + testing + edge cases)

7. **Add Dirty Worktree Warning** - checkpoint.sh enhancement
   - Low risk, minor UX improvement
   - Estimated effort: 30 minutes

8. **Update Tests** - Add Phase 3 test cases to existing bats files
   - Critical for validation, parallelize with implementation
   - Estimated effort: 2 hours

**Total Estimated Effort:** 10-12 hours

### Success Metrics

- [ ] All Phase 2 tests continue to pass
- [ ] All three scripts document exit codes in headers
- [ ] state-write.sh uses atomic writes (verified by temp file cleanup test)
- [ ] STATE.md includes `**Schema:** 2.0` field
- [ ] state-read.sh detects and reports corrupt STATE.md with exit code 2
- [ ] state-write.sh --recover successfully rebuilds STATE.md from artifacts
- [ ] checkpoint.sh warns when worktree is dirty
- [ ] Issue #4 (phases/ directory bug) is resolved
- [ ] Minimum 8 new test cases added across all test files
- [ ] shellcheck passes with zero warnings on all modified scripts

### Files to Create/Modify

**Modify:**
- `/Users/lgbarn/Personal/shipyard/scripts/state-read.sh` - Add validation, fix bug, add exit codes
- `/Users/lgbarn/Personal/shipyard/scripts/state-write.sh` - Add atomic writes, schema field, recovery
- `/Users/lgbarn/Personal/shipyard/scripts/checkpoint.sh` - Add dirty worktree warning
- `/Users/lgbarn/Personal/shipyard/test/state-read.bats` - Add corruption detection tests
- `/Users/lgbarn/Personal/shipyard/test/state-write.bats` - Add atomic write and recovery tests
- `/Users/lgbarn/Personal/shipyard/test/checkpoint.bats` - Add dirty worktree test
- `/Users/lgbarn/Personal/shipyard/test/integration.bats` - Add recovery round-trip test

**No new files required** - All changes are enhancements to existing scripts and tests.

---

**End of Research Document**
