# Simplification Report
**Phase:** 1 - Security Hardening
**Date:** 2026-02-01
**Files analyzed:** 4 (checkpoint.sh, state-write.sh, state-read.sh, .gitignore)
**Findings:** 1 Medium, 2 Low

## Medium Priority

### Duplicated integer validation pattern across scripts
- **Type:** Consolidate (deferred)
- **Locations:**
  - `/Users/lgbarn/Personal/shipyard/scripts/checkpoint.sh:18` -- `if ! [[ "$DAYS" =~ ^[0-9]+$ ]]; then`
  - `/Users/lgbarn/Personal/shipyard/scripts/state-write.sh:61` -- `if [ -n "$PHASE" ] && ! [[ "$PHASE" =~ ^[0-9]+$ ]]; then`
  - `/Users/lgbarn/Personal/shipyard/scripts/state-read.sh:28` -- `if [ -n "$phase" ] && ! [[ "$phase" =~ ^[0-9]+$ ]]; then`
- **Description:** The `^[0-9]+$` integer validation pattern with error-message-to-stderr appears in all three scripts, written independently by separate builder agents. Each has a slightly different error message format and guard condition. This is the classic cross-task duplication pattern.
- **Suggestion:** Under the Rule of Three, this warrants extraction. A shared `validate_int` function in a sourced `scripts/lib/validators.sh` would consolidate the pattern. However, with only 3 scripts total in the project (and only 2-3 lines per instance), the duplication cost is low. A shared library adds a sourcing dependency that increases coupling for marginal benefit.
- **Impact:** ~6 lines removable, but introduces a new file and `source` dependency. Recommend deferring unless a 4th script is added.

## Low Priority

### Enum validation pattern appears twice with different shapes
- **Locations:**
  - `/Users/lgbarn/Personal/shipyard/scripts/state-write.sh:67-74` -- `case "$STATUS" in ready|planned|...) ;; *) error ;; esac`
  - `/Users/lgbarn/Personal/shipyard/scripts/state-read.sh:37-39` -- `case "$context_tier" in auto|minimal|...) ;; *) context_tier="auto" ;; esac`
- **Description:** Both scripts use a `case` statement to validate an enum value, but the fallback behavior differs (one exits with error, one silently defaults). This is a noted parallel pattern but the differing fallback behavior is intentional -- `context_tier` has a sensible default while `--status` does not.
- **Suggestion:** No action. The differing fallback semantics justify the separate implementations.

### state-read.sh uses string concatenation with `\n` literals for context building
- **Locations:**
  - `/Users/lgbarn/Personal/shipyard/scripts/state-read.sh:52,59,65,84,96,99,115,153,159,162,164,168`
- **Description:** The state-read.sh script builds `state_context` by appending `\n` literal strings (e.g., `state_context="${state_context}\n### Section\n${content}\n"`). These are NOT interpreted as newlines during assignment -- they are literal backslash-n characters in the variable. They only become newlines when passed through `jq --arg` at line 171, which processes escape sequences. This works but is non-obvious. A reader might expect `printf` or `$'\n'` syntax.
- **Suggestion:** This is a pre-existing pattern that Phase 1 chose not to change (the focus was on removing `printf '%b'` and `grep -oP`, not rewriting the context builder). Leave as-is; it functions correctly and changing it risks regressions in the session hook output. Note for future refactoring if state-read.sh is rewritten.

## Findings NOT Flagged (Clean Code Confirmations)

- **No dead code.** All functions, variables, and imports in the changed files are used.
- **No unnecessary abstractions.** The scripts are flat procedural code with no wrapper functions or factories.
- **No over-defensive null checks.** Guard clauses like `[ -z "$tag" ] && continue` (checkpoint.sh:25) and `[ -e "$plan_file" ] || continue` (state-read.sh:80) protect against real edge cases (empty lines from process substitution, unexpanded globs).
- **No AI bloat.** Error messages are concise and actionable. Comments are minimal and relevant. No verbose try/catch patterns or redundant type checking.
- **No complexity hotspots.** `state-read.sh` is the longest at 178 lines, but it is a straight-line script with clear section comments. No function exceeds 40 lines (there are no functions -- it is procedural). Nesting stays at 3 levels maximum (the plan/summary loading loops).
- **`.gitignore` is clean.** No duplicated patterns, no overly broad globs, well-organized by category.

## Summary

- **Duplication found:** 1 instance (integer validation) across 3 files -- noted but below extraction threshold for a 3-script project
- **Dead code found:** 0 unused definitions
- **Complexity hotspots:** 0 functions exceeding thresholds
- **AI bloat patterns:** 0 instances
- **Estimated cleanup impact:** ~6 lines removable via shared validator, but net complexity would increase due to new sourcing dependency

## Recommendation

**No simplification action recommended before shipping Phase 1.** The changes are appropriately minimal -- each script received targeted, surgical fixes (input validation, safe iteration, POSIX compatibility) without introducing unnecessary abstractions. The one duplicated pattern (integer validation) is below the threshold where extraction would reduce net complexity given the small number of scripts. The code reads cleanly and each security fix is traceable to a specific vulnerability.

Defer the shared validator idea to Phase 3 (Reliability) or later, if additional scripts are added that need the same pattern.
