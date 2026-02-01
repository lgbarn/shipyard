# Review: Plan 1.1

## Verdict: PASS

## Stage 1: Spec Compliance

### Task 1: Create .gitignore
- Status: PASS
- Notes: File matches the plan specification character-for-character. All required categories
  are present: OS files (.DS_Store, Thumbs.db), editor files (swp, swo, ~, .idea/, .vscode/,
  sublime), dependencies (node_modules/), shipyard dev state (.shipyard/), and secrets
  (.env, .env.*, credentials.json, *.pem, *.key).

### Task 2: Harden checkpoint.sh (3 fixes)
- Status: PASS
- **Fix 1 -- DAYS integer validation**: Implemented exactly as specified. Regex `^[0-9]+$`
  correctly rejects non-integers. Error message matches spec. Exits with code 1 to stderr.
  Verified: `--prune abc` and `--prune "5; rm -rf /"` both rejected correctly.
- **Fix 2 -- LABEL sanitization**: Implemented exactly as specified. Uses `tr -cd` to strip
  unsafe characters, strips leading hyphen, validates non-empty, truncates at 64 characters.
  Verified: `'test<label>'` becomes `testlabel`.
- **Fix 3 -- Word-splitting fix**: `for` loop replaced with `while IFS= read -r` fed by
  process substitution, matching the spec exactly. Empty-line guard `[ -z "$tag" ] && continue`
  is present.

### Task 3: Manual testing
- Status: PASS
- Notes: All injection vectors tested and neutralized. shellcheck exits 0 with zero warnings.

### Stage 1 Overall: All 3 tasks implemented as specified. All done criteria met.

## Stage 2: Code Quality

### Critical
(none)

### Minor
- **Leading-hyphen stripping is single-character only** (`scripts/checkpoint.sh` line 37):
  `${LABEL#-}` uses `#` (shortest match) so input `"---"` becomes `"--"`. This is not a
  real security issue because the label is always embedded after the `shipyard-checkpoint-`
  prefix in the tag name, so `--` never appears at argument position. However, using
  `${LABEL##-}` would not help either since `##` means longest match of the pattern `-`
  which is still one character. A loop or `sed 's/^-*//'` would strip all leading hyphens.
  This is cosmetic only -- no remediation required.

- **DAYS=0 is accepted** (`scripts/checkpoint.sh` line 18): The regex `^[0-9]+$` accepts
  `0`, which means `--prune 0` would attempt to prune checkpoints from "0 days ago" (i.e.,
  today). This is technically valid behavior but the error message says "positive integer"
  which excludes zero. Cosmetic inconsistency, not a bug.

### Positive
- `set -euo pipefail` is present and correct -- matches project conventions.
- Error messages go to stderr as required.
- The `date` command has both macOS (`-v`) and GNU (`-d`) fallback, ensuring cross-platform
  compatibility.
- DAYS is quoted in the `date -v-"${DAYS}"d` call, fixing a pre-existing unquoted variable
  (visible in the diff).
- Process substitution for tag iteration is the correct pattern to avoid subshell variable
  scoping issues.
- Label length cap at 64 characters prevents excessively long git tag names.
- Git flag injection prevention (leading-hyphen strip) is a thoughtful defense-in-depth
  measure even though the tag prefix already provides protection.

## Integration Review
- No file overlap with PLAN-1.2 (state-write.sh) or PLAN-1.3 (state-read.sh).
- The `.gitignore` adding `.shipyard/` is consistent with the project pattern of committing
  shipyard state selectively via `git add -f`.
- No regressions introduced.

## Summary
APPROVE. All must-have requirements are met. shellcheck passes clean. The implementation
matches the plan specification exactly. Two cosmetic observations noted (leading-hyphen
stripping depth, zero acceptance) -- neither is a defect given the runtime context.
