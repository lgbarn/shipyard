# Phase 1 Research: Security Hardening

**Date:** 2026-02-01
**Scope:** 3 bash scripts (`state-read.sh`, `state-write.sh`, `checkpoint.sh`) + `.gitignore`
**Method:** Manual audit + ShellCheck 0.11.0 static analysis

---

## 1. ShellCheck Results (Raw)

### `scripts/state-read.sh`
```
line 69 col 36: SC2012 (info) - Use find instead of ls to better handle non-alphanumeric filenames.
line 74 col 39: SC2012 (info) - Use find instead of ls to better handle non-alphanumeric filenames.
```

### `scripts/state-write.sh`
```
(clean -- no warnings)
```

### `scripts/checkpoint.sh`
```
line 18 col 25: SC2086 (info) - Double quote to prevent globbing and word splitting.
```

ShellCheck misses several issues because it does not flag GNU-only constructs or semantic injection risks. The deeper manual analysis follows.

---

## 2. Per-Script Findings

### 2.1 `scripts/state-read.sh` (158 lines)

| Line(s) | Issue | Severity | Category |
|---------|-------|----------|----------|
| 24 | `grep -oP '(?<=...)'` -- PCRE flag `-P` is GNU grep only; fails on macOS BSD grep | **High** | Portability |
| 25 | Same as line 24 -- second `grep -oP` call | **High** | Portability |
| 65 | `find ... -name "${phase}*"` -- `$phase` is unvalidated user-derived data from grep. If `$phase` contains glob chars (`*`, `?`, `[`), the `find -name` pattern breaks. Also unquoted could cause word splitting. | **Medium** | Injection / Input Validation |
| 65 | `find ... -name "0${phase}*"` -- same issue, plus prepending `0` to non-numeric `$phase` is semantically wrong | **Medium** | Input Validation |
| 69 | `for plan_file in $(ls ...)` -- word-splitting on filenames with spaces; ShellCheck SC2012 | **Medium** | Robustness |
| 74 | `for summary_file in $(ls ...)` -- same as line 69 | **Medium** | Robustness |
| 43, 50, 56, 71, 76, 79, 91, 95, 96 | `printf`-style expansion via string interpolation: variables like `${state_md}`, `${project_md}`, etc. are embedded directly into strings that are later passed to `printf '%b'` (indirectly via `jq --arg`). If any file content contains backslash sequences (`\n`, `\t`, `\0`), `jq --arg` handles this safely, but the `\n` literals in the bash string building are fragile. | **Low** | Fragility |
| 30 | `jq -r '.context_tier // "auto"'` -- config value is not validated against an allowlist. A malicious `config.json` could set `context_tier` to any string, though the `case` on line 34-40 defaults safely. | **Low** | Input Validation |
| 102 | `${phase:-1}` in suggestion string -- if `$phase` is non-numeric (e.g., from a corrupted STATE.md), the suggestion displays garbage. Not a security issue but a quality one. | **Low** | Input Validation |
| 115 | `next_phase=$((${phase:-0} + 1))` -- if `$phase` is not an integer, arithmetic expansion will error under `set -e`, crashing the script. In bash, `$(( ))` evaluates arbitrary expressions, so a `$phase` like `a]` could cause unexpected behavior. | **Medium** | Injection / Crash |
| 116 | `grep -q "Phase ${next_phase}\|Phase 0${next_phase}"` -- uses BRE `\|` alternation which is a GNU grep extension; not portable to all systems. Works on macOS but is technically non-standard. | **Low** | Portability |
| 148 | Long string built entirely in memory with no size limit. A very large STATE.md or PROJECT.md could cause memory issues. | **Low** | Robustness |

**Summary of state-read.sh issues:**
- 2 **High** (GNU grep `-P` on macOS)
- 3 **Medium** (unvalidated `$phase` in find/arithmetic, `ls` word-splitting)
- 5 **Low** (input validation, portability, fragility)

### 2.2 `scripts/state-write.sh` (111 lines)

| Line(s) | Issue | Severity | Category |
|---------|-------|----------|----------|
| 33-34 | `--phase "$2"` -- no validation that `$PHASE` is a positive integer. Accepts any string including shell metacharacters. | **Medium** | Input Validation |
| 49-50 | `--raw "$2"` -- writes `$RAW_CONTENT` directly to `STATE_FILE` with zero sanitization. Any content is accepted. While this is by design, it means any caller can overwrite STATE.md with arbitrary data. | **Medium** | Design Risk |
| 62 | `echo "$RAW_CONTENT" > "$STATE_FILE"` -- `echo` with arbitrary content can misbehave if content starts with `-n`, `-e`, or `-E` (interpreted as flags). Should use `printf '%s\n'` instead. | **Medium** | Injection |
| 81 | `NEW_STATE+="**Current Phase:** ${PHASE}\n"` -- `$PHASE` is interpolated directly. Since it later goes through `printf '%b'` on line 104, if `$PHASE` contains `\n`, `\t`, `\x`, or `%` sequences, they will be interpreted. | **High** | Format String Injection |
| 83, 85, 88, 90 | Same pattern: `$POSITION`, `$STATUS`, `$BLOCKER` all go through `printf '%b'` without sanitization. | **High** | Format String Injection |
| 104 | `printf '%b' "$NEW_STATE" > "$STATE_FILE"` -- `%b` interprets backslash escape sequences in the argument. This is the root cause of the format string injection. Should use `printf '%s'` instead, and handle newlines via literal newlines or `$'\n'`. | **High** | Format String Injection |
| 94 | `echo "$EXISTING" \| grep -q "## History"` -- safe, but if `$EXISTING` is very large, piping the entire file through echo is inefficient. Minor. | **Low** | Performance |
| 95 | `echo "$EXISTING" \| sed -n '/## History/,$p'` -- same concern; also `sed` pattern is fine here. | **Low** | Performance |
| 86 | `--status` accepts any string. Should validate against known status values: `ready`, `planned`, `planning`, `building`, `in_progress`, `complete`, `complete_with_gaps`, `shipped`. | **Medium** | Input Validation |

**Summary of state-write.sh issues:**
- 3 **High** (printf `%b` format string injection via `$PHASE`, `$POSITION`, `$STATUS`, `$BLOCKER`)
- 3 **Medium** (no integer check on `--phase`, no status allowlist, `echo` vs `printf` for raw content)
- 2 **Low** (performance with large content)

### 2.3 `scripts/checkpoint.sh` (41 lines)

| Line(s) | Issue | Severity | Category |
|---------|-------|----------|----------|
| 18 | `date -v-${DAYS}d` -- `$DAYS` is unquoted (SC2086) and unvalidated. If `$DAYS` contains spaces or shell metacharacters, word splitting occurs. If `$DAYS` is `; rm -rf /`, the `date` command itself won't execute it, but the value should still be validated as a positive integer. | **Medium** | Input Validation |
| 18 | `date -v-${DAYS}d` -- macOS-only syntax. The fallback `date -d "${DAYS} days ago"` is GNU-only. This dual approach works but `$DAYS` is injected into both without validation. | **Medium** | Input Validation |
| 20 | `for tag in $(git tag -l "shipyard-checkpoint-*")` -- word-splitting on tag names. Tag names are controlled by this script so the risk is low, but a maliciously-created tag with spaces would cause issues. | **Low** | Robustness |
| 31 | `LABEL="${1:-auto}"` -- no sanitization. `$LABEL` is used directly in the git tag name on line 33. | **High** | Injection |
| 33 | `TAG="shipyard-checkpoint-${LABEL}-${TIMESTAMP}"` -- if `$LABEL` contains spaces, slashes, or other chars invalid in git tag names, `git tag` will fail. More critically, if `$LABEL` contains `..` or starts with `-`, it could cause git to misinterpret the argument. | **High** | Injection |
| 35 | `git tag -a "$TAG" -m "Shipyard checkpoint: ${LABEL}"` -- `$LABEL` in the message is less dangerous (git handles it), but the tag name itself is the concern. | **High** | Injection |

**Summary of checkpoint.sh issues:**
- 3 **High** (unsanitized `$LABEL` in git tag name)
- 2 **Medium** (unvalidated `$DAYS` in date commands)
- 1 **Low** (word-splitting on tag list)

---

## 3. Recommended Fixes

### 3.1 `state-read.sh` Fixes

**Fix 1: Replace `grep -oP` (lines 24-25)**

Replace PCRE lookbehinds with POSIX-compatible alternatives:

```bash
# Before (line 24):
status=$(echo "$state_md" | grep -oP '(?<=\*\*Status:\*\* ).*' 2>/dev/null || echo "")

# After:
status=$(echo "$state_md" | sed -n 's/^.*\*\*Status:\*\* //p' | head -1)

# Before (line 25):
phase=$(echo "$state_md" | grep -oP '(?<=\*\*Current Phase:\*\* )\d+' 2>/dev/null || echo "")

# After:
phase=$(echo "$state_md" | sed -n 's/^.*\*\*Current Phase:\*\* \([0-9][0-9]*\).*/\1/p' | head -1)
```

**Fix 2: Validate `$phase` as integer (after line 25)**

```bash
# Validate phase is a positive integer or empty
if [[ -n "$phase" ]] && ! [[ "$phase" =~ ^[0-9]+$ ]]; then
    phase=""
fi
```

**Fix 3: Quote `$phase` in find and protect against glob injection (line 65)**

```bash
# Before:
phase_dir=$(find .shipyard/phases/ -maxdepth 1 -type d -name "${phase}*" -o -name "0${phase}*" 2>/dev/null | head -1)

# After (with validated integer $phase, glob chars are impossible):
phase_dir=$(find .shipyard/phases/ -maxdepth 1 -type d \( -name "${phase}-*" -o -name "${phase}" -o -name "0${phase}-*" -o -name "0${phase}" \) 2>/dev/null | head -1)
```

**Fix 4: Replace `ls` with glob (lines 69, 74)**

```bash
# Before (line 69):
for plan_file in $(ls "${phase_dir}/plans/"PLAN-*.md 2>/dev/null | head -3); do

# After:
plan_count=0
for plan_file in "${phase_dir}/plans/"PLAN-*.md; do
    [ -f "$plan_file" ] || continue
    [ "$plan_count" -ge 3 ] && break
    plan_count=$((plan_count + 1))
    ...
done

# Same pattern for line 74 (summary_file loop).
```

Note: The `tail -3` (last 3 summaries) on line 74 is harder with a glob. Consider using a sorted array approach:

```bash
summary_files=()
for f in "${phase_dir}/results/"SUMMARY-*.md; do
    [ -f "$f" ] && summary_files+=("$f")
done
# Take last 3
start=$(( ${#summary_files[@]} > 3 ? ${#summary_files[@]} - 3 : 0 ))
for ((i=start; i<${#summary_files[@]}; i++)); do
    summary_file="${summary_files[$i]}"
    ...
done
```

**Fix 5: Protect arithmetic on `$phase` (line 115)**

Already covered by Fix 2 (integer validation). With that in place, `$(( ${phase:-0} + 1 ))` is safe.

**Fix 6: Validate `context_tier` against allowlist (after line 30)**

```bash
case "$context_tier" in
    auto|minimal|planning|execution|brownfield|full) ;; # valid
    *) context_tier="auto" ;; # fallback for unknown values
esac
```

### 3.2 `state-write.sh` Fixes

**Fix 1: Replace `printf '%b'` with `printf '%s'` (line 104)**

This is the most critical fix. `%b` interprets backslash escapes in the argument, which means user-supplied values like `$PHASE`, `$POSITION`, etc. can inject arbitrary control characters.

```bash
# Before (line 104):
printf '%b' "$NEW_STATE" > "$STATE_FILE"

# After -- use $'\n' for newlines in the string building, then:
printf '%s' "$NEW_STATE" > "$STATE_FILE"
```

This requires changing all the `\n` in the string building (lines 77-102) from escaped-in-string to literal newlines or `$'\n'` concatenation:

```bash
NEW_STATE="# Shipyard State"$'\n\n'
NEW_STATE+="**Last Updated:** ${TIMESTAMP}"$'\n\n'
# ... etc.
```

**Fix 2: Validate `--phase` as positive integer (after line 34)**

```bash
--phase)
    PHASE="$2"
    if ! [[ "$PHASE" =~ ^[0-9]+$ ]]; then
        echo "Error: --phase must be a positive integer, got: ${PHASE}" >&2
        exit 1
    fi
    shift 2
    ;;
```

**Fix 3: Validate `--status` against allowlist (after line 42)**

```bash
--status)
    STATUS="$2"
    case "$STATUS" in
        ready|planned|planning|building|in_progress|complete|complete_with_gaps|shipped) ;;
        *)
            echo "Error: --status must be one of: ready, planned, planning, building, in_progress, complete, complete_with_gaps, shipped" >&2
            exit 1
            ;;
    esac
    shift 2
    ;;
```

**Fix 4: Replace `echo` with `printf '%s\n'` for raw write (line 62)**

```bash
# Before:
echo "$RAW_CONTENT" > "$STATE_FILE"

# After:
printf '%s\n' "$RAW_CONTENT" > "$STATE_FILE"
```

**Fix 5: Consider adding a max-length check on `--raw` content**

Not strictly a security issue, but a robustness concern. STATE.md should not be unbounded.

```bash
if [ "${#RAW_CONTENT}" -gt 65536 ]; then
    echo "Error: --raw content exceeds 64KB limit" >&2
    exit 1
fi
```

### 3.3 `checkpoint.sh` Fixes

**Fix 1: Validate `$DAYS` as positive integer (after line 17)**

```bash
DAYS="${2:-30}"
if ! [[ "$DAYS" =~ ^[0-9]+$ ]] || [ "$DAYS" -eq 0 ] || [ "$DAYS" -gt 365 ]; then
    echo "Error: days must be a positive integer (1-365), got: ${DAYS}" >&2
    exit 1
fi
```

**Fix 2: Quote `$DAYS` in date command (line 18)**

```bash
# Before:
CUTOFF=$(date -u -v-${DAYS}d +"%Y%m%dT%H%M%SZ" 2>/dev/null || date -u -d "${DAYS} days ago" +"%Y%m%dT%H%M%SZ")

# After (with integer validation above, quoting is safe):
CUTOFF=$(date -u -v-"${DAYS}"d +"%Y%m%dT%H%M%SZ" 2>/dev/null || date -u -d "${DAYS} days ago" +"%Y%m%dT%H%M%SZ")
```

**Fix 3: Sanitize `$LABEL` (after line 31)**

Only allow alphanumeric characters, hyphens, underscores, and dots:

```bash
LABEL="${1:-auto}"
# Strip invalid characters from label
LABEL=$(printf '%s' "$LABEL" | tr -cd 'a-zA-Z0-9._-')
# Ensure label is not empty after sanitization
if [ -z "$LABEL" ]; then
    LABEL="auto"
fi
# Prevent leading hyphen (git would interpret as flag)
LABEL="${LABEL#-}"
# Limit length
if [ "${#LABEL}" -gt 64 ]; then
    LABEL="${LABEL:0:64}"
fi
```

**Fix 4: Use `--` to prevent git flag injection (line 35)**

While tag names starting with `-` are prevented by Fix 3, defense in depth:

```bash
# Note: git tag does not support -- for the tag name position,
# but the sanitization in Fix 3 prevents leading-hyphen issues.
git tag -a "$TAG" -m "Shipyard checkpoint: ${LABEL}" 2>/dev/null || {
```

---

## 4. GNU vs macOS Portability Issues

| Script | Line | Construct | macOS Behavior | Fix |
|--------|------|-----------|---------------|-----|
| state-read.sh | 24, 25 | `grep -oP` (PCRE) | **Fails** -- BSD grep has no `-P` flag | Use `sed -n 's/pattern/\1/p'` |
| state-read.sh | 116 | `grep -q "...\|..."` (BRE alternation) | Works on macOS but not POSIX standard | Use `grep -qE "...\|..."` (ERE) or two greps |
| checkpoint.sh | 18 | `date -v-Nd` (macOS) / `date -d` (GNU) | Dual approach is correct | Keep both; just validate `$DAYS` |
| state-write.sh | -- | No portability issues | -- | -- |

---

## 5. `.gitignore` Recommendations

The project currently has **no `.gitignore` file**. The `.npmignore` excludes `.git`, `.shipyard`, `.claude`, and `*.bak` from npm publishing, but nothing protects the git repo itself.

### Recommended `.gitignore` contents

```gitignore
# OS files
.DS_Store
Thumbs.db

# Editor/IDE
*.swp
*.swo
*~
.vscode/
.idea/
*.sublime-workspace

# Node.js (if dependencies are ever added)
node_modules/
npm-debug.log*

# Shipyard per-project state (should not be committed to the plugin repo)
# Note: .shipyard/ is the per-project state directory created in user repos.
# It IS committed in user repos (that's the point), but should NOT be in
# the plugin's own repo since it's dev/test state.
.shipyard/

# Backup files
*.bak
*.orig
*.tmp

# Environment and secrets
.env
.env.*
*.pem
*.key
```

### Rationale

- `.shipyard/` -- This is the plugin's own dev state; it should not ship as part of the plugin package. The `.npmignore` already excludes it from npm, but it should also be excluded from git to avoid committing test state.
- `.DS_Store` -- Standard macOS junk file; the developer is on macOS (darwin).
- `node_modules/` -- Future-proofing; the `package.json` exists but has no dependencies yet.
- Editor files -- Standard exclusions for multi-developer projects.
- Secret files -- Defense in depth; prevents accidental credential commits.

---

## 6. Issue Priority Summary

### Critical (must fix)

| # | Script | Issue | Risk |
|---|--------|-------|------|
| 1 | state-write.sh:104 | `printf '%b'` format string injection | Arbitrary control chars in STATE.md via `--phase`, `--position`, `--status`, `--blocker` |
| 2 | state-read.sh:24-25 | `grep -oP` GNU-only | Script fails entirely on macOS (the primary platform) |
| 3 | checkpoint.sh:31-35 | Unsanitized `$LABEL` in git tag name | Malformed tags, potential git argument injection |

### Important (should fix)

| # | Script | Issue | Risk |
|---|--------|-------|------|
| 4 | state-read.sh:65 | Unvalidated `$phase` in `find -name` | Glob injection, incorrect directory matching |
| 5 | state-read.sh:115 | Arithmetic on unvalidated `$phase` | Script crash or expression injection |
| 6 | state-write.sh:33-34 | No integer check on `--phase` | Garbage values in STATE.md |
| 7 | state-write.sh:42 | No allowlist for `--status` | Arbitrary status values |
| 8 | checkpoint.sh:18 | Unvalidated `$DAYS` in date command | Word splitting, unexpected behavior |
| 9 | state-write.sh:62 | `echo` vs `printf` for raw content | Content starting with `-n`/`-e` misinterpreted |

### Minor (nice to fix)

| # | Script | Issue | Risk |
|---|--------|-------|------|
| 10 | state-read.sh:69,74 | `ls` in for-loop | Filenames with spaces break |
| 11 | state-read.sh:30 | `context_tier` from config not validated | Falls through to default safely, but explicit is better |
| 12 | state-read.sh:116 | BRE `\|` alternation | Non-standard but works on macOS |
| 13 | checkpoint.sh:20 | Word-splitting on `git tag -l` output | Low risk since tags are script-controlled |

---

## 7. Patterns and Conventions to Follow

Based on the existing codebase:

1. **All scripts use `set -euo pipefail`** -- maintain this. It catches many errors early.
2. **All scripts use `#!/usr/bin/env bash`** -- maintain this for portability.
3. **Error messages go to stderr** (`>&2`) -- maintain this pattern.
4. **Exit codes:** 0 for success, 1 for errors. Keep this convention.
5. **`2>/dev/null || fallback`** pattern is used throughout -- acceptable for optional operations.
6. **Variables are UPPER_CASE for script-level, lower_case for function-local** -- maintain this.
7. **No external dependencies beyond coreutils + jq + git** -- keep this minimal dependency approach.

### Validation Helper Pattern

Consider adding a shared validation snippet at the top of each script or a shared `lib.sh`:

```bash
# Validate a value is a positive integer
validate_positive_int() {
    local name="$1" value="$2"
    if ! [[ "$value" =~ ^[0-9]+$ ]]; then
        echo "Error: ${name} must be a positive integer, got: '${value}'" >&2
        return 1
    fi
}

# Sanitize a string for use in filenames/tag names
sanitize_label() {
    local label="$1"
    label=$(printf '%s' "$label" | tr -cd 'a-zA-Z0-9._-')
    label="${label#-}"  # strip leading hyphen
    [ -z "$label" ] && label="auto"
    printf '%s' "${label:0:64}"
}
```

Whether to extract a shared `lib.sh` or inline these validations is a style choice. Given that there are only 3 scripts and they are small, **inlining the validations is simpler and avoids a sourcing dependency**.

---

## 8. Implementation Considerations

### Testing Strategy

Each fix should be verifiable:

- **Portability fixes** (grep -oP): Run on macOS natively. If CI is Linux-based, test both paths.
- **Input validation**: Test with edge cases: empty string, negative numbers, strings with spaces/special chars, very long strings.
- **printf %b fix**: Test that `--phase "1\n\nINJECTED"` does NOT produce newlines in output.
- **Label sanitization**: Test that `--label "../../etc/passwd"` produces `....etcpasswd` or similar safe output.

### Rollback Safety

All changes are to script internals. No data format changes. A checkpoint before starting is wise:

```bash
scripts/checkpoint.sh "pre-phase-1-security"
```

### Order of Implementation

1. `.gitignore` (no risk, immediate benefit)
2. `checkpoint.sh` fixes (smallest script, builds confidence)
3. `state-write.sh` fixes (most critical security issue: `printf '%b'`)
4. `state-read.sh` fixes (most changes, but lower severity since it is read-only)

---

## 9. Relevant Documentation

- [ShellCheck Wiki - SC2086](https://www.shellcheck.net/wiki/SC2086) -- double-quote to prevent globbing and word splitting
- [ShellCheck Wiki - SC2012](https://www.shellcheck.net/wiki/SC2012) -- use find instead of ls
- [Bash Pitfalls (Greg's Wiki)](https://mywiki.wooledge.org/BashPitfalls) -- comprehensive list of common bash mistakes
- [printf %b security](https://mywiki.wooledge.org/BashFAQ/002) -- why `printf '%s'` is safer than `printf '%b'` or `echo`
- [git-tag documentation](https://git-scm.com/docs/git-tag) -- valid tag name characters
- [POSIX grep specification](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/grep.html) -- no `-P` flag in POSIX
