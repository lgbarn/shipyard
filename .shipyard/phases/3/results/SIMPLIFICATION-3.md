# Simplification Report
**Phase:** Phase 3 - Reliability and State Management
**Date:** 2026-02-01T00:00:00Z
**Files analyzed:** 8 files (3 scripts, 4 test files, 1 test helper)
**Lines of code:** 1073 total
**Findings:** 8 total (2 High, 3 Medium, 3 Low)

---

## High Priority

### H1: Duplicate timestamp date format strings
- **Type:** Consolidate
- **Locations:**
  - scripts/checkpoint.sh:50 (`+"%Y%m%dT%H%M%SZ"`)
  - scripts/state-write.sh:68, 163 (`+"%Y-%m-%dT%H:%M:%SZ"`)
- **Description:** Two different timestamp formats are used across scripts. checkpoint.sh uses compact format (20260201T120000Z), while state-write.sh uses ISO-8601 with hyphens and colons (2026-02-01T12:00:00Z). Both represent UTC timestamps but are inconsistent.
- **Suggestion:** Standardize on ISO-8601 format (`+"%Y-%m-%dT%H:%M:%SZ"`) across all scripts. Create a shared function `timestamp_utc()` in a common library file if more scripts will need this.
- **Impact:** Eliminates format inconsistency, improves parseability (ISO-8601 is more widely supported by tools), reduces cognitive load when reading STATE.md vs checkpoint tags.

### H2: Duplicate tag date extraction pattern
- **Type:** Consolidate
- **Locations:**
  - scripts/checkpoint.sh:31 (`grep -oE '[0-9]{8}T[0-9]{6}Z'`)
  - scripts/state-write.sh:155 (`grep -oE '[0-9]{8}T[0-9]{6}Z'`)
- **Description:** Identical regex pattern to extract timestamp from checkpoint tag names appears in both scripts. If timestamp format changes (per H1), both locations must be updated.
- **Suggestion:** Extract to a shared constant or function. If scripts remain standalone, document the coupling in both locations with a comment: `# NOTE: Must match checkpoint tag format in checkpoint.sh`
- **Impact:** Reduces duplication, prevents desync bugs if timestamp format changes.

---

## Medium Priority

### M1: Repeated STATE.md validation pattern
- **Type:** Refactor
- **Locations:**
  - scripts/state-read.sh:36-56 (empty check + field presence check)
  - scripts/state-write.sh:44-49 (empty file validation in atomic_write)
- **Description:** Both scripts validate STATE.md but with different approaches. state-read.sh checks for required fields (`**Status:**`, `**Current Phase:**`) using grep, while state-write.sh only checks for empty files in atomic_write. No shared validation logic.
- **Suggestion:** Create a shared `validate_state_md()` function that checks for:
  - Non-empty file
  - Presence of required fields
  - Schema version compatibility

  Call from both scripts. This would catch more corruption cases at write-time.
- **Impact:** Improved reliability (catch issues earlier), reduced code duplication (20+ lines → single function call), consistent validation behavior.

### M2: Repeated setup pattern in integration tests
- **Type:** Consolidate
- **Locations:**
  - test/integration.bats:5-6, 49-50, 64-65, 94-95, 112-113
- **Description:** Five integration tests start with identical setup:
  ```bash
  setup_shipyard_dir
  mkdir -p .shipyard/phases
  ```
  This 2-line pattern appears verbatim in 5 out of 6 integration tests.
- **Suggestion:** Add `setup_shipyard_with_phases()` helper to test_helper.bash:
  ```bash
  setup_shipyard_with_phases() {
      setup_shipyard_dir
      mkdir -p .shipyard/phases
  }
  ```
  Replace all 5 occurrences with single function call.
- **Impact:** 10 lines → 5 lines, improved test readability, easier to extend setup (e.g., if all integration tests later need config.json).

### M3: Excessive stderr suppression with fallback echo
- **Type:** Refactor
- **Locations:**
  - scripts/state-read.sh:25, 33, 70, 92, 98, 123, 138, 153, 192 (11 occurrences)
  - scripts/state-write.sh:155
- **Description:** Pattern `$(command 2>/dev/null || echo "")` appears 12 times. While defensive, this hides all errors (not just ENOENT). If `cat` fails due to permissions or I/O error, the script silently continues with empty string.
- **Suggestion:** Use `|| true` for commands where errors are expected and acceptable:
  ```bash
  state_md=$(cat ".shipyard/STATE.md" 2>/dev/null) || state_md=""
  ```
  For critical reads (like STATE.md itself), consider letting errors surface unless specifically in non-project context.
- **Impact:** More transparent error handling, slightly cleaner code (removes 12 `|| echo ""` fallbacks), potential earlier failure detection for real I/O issues.

---

## Low Priority

### L1: Verbose exit code documentation
- **Type:** Simplify
- **Locations:**
  - scripts/checkpoint.sh:14-17 (4 lines)
  - scripts/state-read.sh:6-10 (5 lines)
  - scripts/state-write.sh:13-17 (5 lines)
- **Description:** Each script has a 4-5 line exit code documentation block. While useful, the format is verbose for simple contracts. Example:
  ```bash
  # Exit Codes:
  #   0 - Success (tag created, pruned, or graceful non-git-repo warning)
  #   1 - User error (invalid arguments, empty label after sanitization)
  #   3 - Missing dependency (git command failed for reason other than "not a repo")
  ```
- **Suggestion:** Reduce to single-line format for cleaner headers:
  ```bash
  # Exit: 0=success, 1=user error, 2=state corrupt, 3=dependency missing
  ```
  Keep detailed descriptions only if exit codes are complex/ambiguous.
- **Impact:** Saves ~12 lines across 3 scripts, improves header scannability. Trade-off: slightly less detailed inline docs.

### L2: Test output validation could be more specific
- **Type:** Improve
- **Locations:**
  - test/checkpoint.bats:10, 22, 32 (checking partial output "Checkpoint created", "Warning")
  - test/state-write.bats:34, 46, 61 (checking partial output "STATE.md updated", "raw write", "## History")
- **Description:** Many tests use `assert_output --partial` with very short strings like "Checkpoint created", "Warning", "## History". These could pass even if the actual output is incorrect but happens to contain the substring.
- **Suggestion:** Consider using `assert_output --regexp` for more precise matching, or check multiple substrings in sequence:
  ```bash
  assert_output --partial "Checkpoint created"
  assert_output --partial "pre-build-phase-2"
  ```
  (This pattern is already used in some tests like checkpoint.bats:10-11).
- **Impact:** More robust test assertions, reduced false-positive risk. Minimal code change (add 1-2 lines per test).

### L3: Comment density slightly high in state-read.sh
- **Type:** Reduce
- **Locations:**
  - scripts/state-read.sh (35 comment lines out of 221 total = 15.8%)
- **Description:** state-read.sh has 35 comment lines, many stating obvious operations:
  - Line 32: `# Project has Shipyard state -- read it` (followed by `state_md=$(cat ".shipyard/STATE.md" ...)`)
  - Line 35: `# Validate STATE.md has required fields` (immediately before validation code)
  - Line 77: `# Auto-detect tier based on status` (immediately before case statement on status)

  These are self-documenting due to variable names and structure.
- **Suggestion:** Remove comments that restate the code. Keep comments for non-obvious logic (e.g., why execution tier loads plans/summaries, why phases directory check exists).
- **Impact:** Cleaner code (10-15 lines saved), improved signal-to-noise ratio. Trade-off: less guidance for unfamiliar readers.

---

## Summary

- **Duplication found:** 2 instances of exact code duplication (timestamp format, tag extraction regex), 1 pattern-based duplication (test setup), 1 validation logic duplication
- **Dead code found:** 0 unused definitions (all functions, variables, and tests are actively used)
- **Complexity hotspots:** 1 function (state-write.sh recovery block: 57 lines, but acceptable given single-purpose recovery logic)
- **AI bloat patterns:** 12 instances of defensive `|| echo ""` fallbacks, moderate comment density in state-read.sh
- **Estimated cleanup impact:**
  - High priority refactors: ~15 lines saved, eliminates 2 format inconsistencies
  - Medium priority refactors: ~30 lines saved, consolidates 3 patterns
  - Low priority refactors: ~25 lines saved, improves clarity

**Total potential savings:** ~70 lines (6.5% reduction from 1073 → ~1000 lines)

---

## Recommendation

**Simplification is recommended for High priority items before next phase.**

The code quality is generally good — no major architectural issues, no dead code, and complexity is justified by reliability requirements. However, two High priority findings (timestamp format inconsistency and duplicate tag extraction) create maintenance risk:

1. **H1 (timestamp formats):** Blocks clean checkpoint tag parsing in future. If state-write.sh ever needs to parse checkpoint tags for history reconstruction, the format mismatch will cause bugs.

2. **H2 (duplicate regex):** Fragile coupling between checkpoint.sh and state-write.sh. If checkpoint tag format changes, both locations must be updated in sync.

**Suggested action:** Address H1 and H2 in a quick refactor pass (~30 minutes). Medium and Low priority findings can be deferred — they're minor improvements that don't block correctness or future work.

**Deferred findings:** If not addressed now, log M1, M2, and M3 in `.shipyard/ISSUES.md` as technical debt for future cleanup.
