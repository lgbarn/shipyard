# Security Audit Report

**Phase:** 1 -- Security Hardening
**Date:** 2026-02-01
**Auditor:** Security & Compliance Auditor (Opus 4.5)
**Scope:** 4 files changed, 110 insertions, 36 deletions

| File | Lines Changed | Category |
|------|--------------|----------|
| `scripts/checkpoint.sh` | +21 / -3 | Bash script (git tag management) |
| `scripts/state-write.sh` | +70 / -19 | Bash script (state file writer) |
| `scripts/state-read.sh` | +30 / -4 | Bash script (session hook / state reader) |
| `.gitignore` | +25 / -0 | Git configuration |

**Commits analyzed:** `aa0fc2a` through `713bda8` (8 commits)

---

## Summary

**Verdict:** PASS

**Critical findings:** 0
**Important findings:** 2
**Advisory findings:** 5

All critical and high-severity issues identified in the Phase 1 research (`RESEARCH.md`) have been remediated. The remaining findings are low-risk items that do not block shipping but should be addressed in a future phase.

---

## Verification of Research Findings Remediation

The Phase 1 research identified 13 issues across 3 severity tiers. Below is the disposition of each.

### Critical Issues (all resolved)

| Research # | Issue | Status | Evidence |
|-----------|-------|--------|----------|
| 1 | `state-write.sh:104` -- `printf '%b'` format string injection | **RESOLVED** | `printf '%b'` completely eliminated. All output now uses `printf '%s\n'` via a command group redirected to file (lines 93-120). No user input is ever interpreted as a format string. |
| 2 | `state-read.sh:24-25` -- `grep -oP` GNU-only, fails on macOS | **RESOLVED** | Replaced with POSIX `sed -n 's/.../\1/p'` (lines 24-25). Phase extraction regex also tightened to `[0-9][0-9]*` ensuring only digits are captured. |
| 3 | `checkpoint.sh:31-35` -- Unsanitized `$LABEL` in git tag name | **RESOLVED** | Label is now sanitized via `tr -cd 'a-zA-Z0-9._-'` (line 36), leading hyphens are stripped (line 37), empty labels are rejected (lines 38-41), and length is capped at 64 characters (lines 42-44). |

### Important Issues (all resolved)

| Research # | Issue | Status | Evidence |
|-----------|-------|--------|----------|
| 4 | `state-read.sh:65` -- Unvalidated `$phase` in `find -name` | **RESOLVED** | Phase is now validated as `^[0-9]+$` (lines 27-29). With integer-only phase values, glob injection in `find -name` is impossible. |
| 5 | `state-read.sh:115` -- Arithmetic on unvalidated `$phase` | **RESOLVED** | Phase validation (line 27-29) ensures `$((${phase:-0} + 1))` on line 135 only ever operates on integers. |
| 6 | `state-write.sh:33-34` -- No integer check on `--phase` | **RESOLVED** | Explicit validation added at lines 61-64: rejects non-integer values with a clear error message. |
| 7 | `state-write.sh:42` -- No allowlist for `--status` | **RESOLVED** | Allowlist validation added at lines 66-75 with a `case` statement covering all valid statuses. The allowlist also includes `blocked` and `paused` which were missing from the research recommendation -- this is a correct expansion. |
| 8 | `checkpoint.sh:18` -- Unvalidated `$DAYS` in date command | **RESOLVED** | Integer validation added at lines 18-21. The variable is also properly quoted in the `date` command (line 22): `-v-"${DAYS}"d`. |
| 9 | `state-write.sh:62` -- `echo` vs `printf` for raw content | **RESOLVED** | Replaced with `printf '%s\n'` (line 79). Content starting with `-n`, `-e`, or `-E` is no longer misinterpreted. |

### Minor Issues (all resolved)

| Research # | Issue | Status | Evidence |
|-----------|-------|--------|----------|
| 10 | `state-read.sh:69,74` -- `ls` in for-loop | **RESOLVED** | Replaced with safe glob iteration (lines 78-86 for plans, lines 87-97 for summaries). Uses `[ -e "$file" ] || continue` guard and array-based last-3 selection. |
| 11 | `state-read.sh:30` -- `context_tier` from config not validated | **RESOLVED** | Explicit `case` allowlist added at lines 37-40, falling back to `"auto"` for unknown values. |
| 12 | `state-read.sh:116` -- BRE `\|` alternation | **RESOLVED** | Changed to ERE with `grep -qE` (line 136). |
| 13 | `checkpoint.sh:20` -- Word-splitting on `git tag -l` output | **RESOLVED** | Replaced `for tag in $(...)` with `while IFS= read -r tag` fed by process substitution (lines 24-31). |

---

## Important Findings

### 1. `--position` and `--blocker` in state-write.sh accept unsanitized free-text

- **Location:** `/Users/lgbarn/Personal/shipyard/scripts/state-write.sh` lines 38-39, 44-45
- **Category:** Input Validation (CWE-20)
- **Severity:** IMPORTANT
- **Description:** While `--phase` is validated as an integer and `--status` is validated against an allowlist, the `--position` and `--blocker` parameters accept arbitrary strings with no length limit or character restriction. These values are written directly into `STATE.md` via `printf '%s\n'`.
- **Risk:** Since `printf '%s\n'` is used (not `%b`), there is no format string injection risk. However, extremely long strings or strings containing markdown injection (e.g., embedded links, HTML) could corrupt the STATE.md structure. The callers of this script are other Shipyard scripts and the Claude agent, so the attack surface is limited to a compromised or misbehaving caller.
- **Remediation:** Add a maximum length check (e.g., 1024 characters) for `--position` and `--blocker`. Consider stripping or rejecting control characters (bytes 0x00-0x1F except newline).
- **Blocks shipping:** No. The risk is low given the caller trust model.
- **Reference:** CWE-20 (Improper Input Validation)

### 2. `find` pattern in state-read.sh uses overly broad glob

- **Location:** `/Users/lgbarn/Personal/shipyard/scripts/state-read.sh` line 74
- **Category:** Path Traversal Defense (CWE-22)
- **Severity:** IMPORTANT
- **Description:** The `find` command uses `-name "${phase}*"` which, for `phase=1`, would match directories named `1`, `10`, `11`, `100`, etc. -- not just `1` or `1-name`. The `-o -name "0${phase}*"` branch similarly matches `01`, `010`, etc. This is not a security vulnerability per se (phase is validated as integer), but it is a correctness issue that could cause the wrong phase directory to be loaded.
- **Risk:** If phases `1` and `10` both exist, requesting phase `1` might load phase `10`'s context (whichever `find` returns first with `head -1`). This is a logic bug, not a security bug.
- **Remediation:** Use more precise patterns: `-name "${phase}" -o -name "${phase}-*" -o -name "0${phase}" -o -name "0${phase}-*"`. This was recommended in the research but not implemented.
- **Blocks shipping:** No. The impact is limited to incorrect context loading in an edge case.
- **Reference:** CWE-22 (Improper Limitation of a Pathname to a Restricted Directory)

---

## Advisory Findings

### 1. `--raw` mode in state-write.sh has no size limit

- **Location:** `/Users/lgbarn/Personal/shipyard/scripts/state-write.sh` lines 78-82
- **Severity:** LOW
- **Description:** The `--raw` flag writes arbitrary content of any size to `STATE.md`. A very large payload could fill disk or cause downstream readers to stall.
- **Suggestion:** Add a size guard, e.g., reject content over 64KB.

### 2. Literal `\n` in state-read.sh string building relies on jq interpretation

- **Location:** `/Users/lgbarn/Personal/shipyard/scripts/state-read.sh` lines 52, 59, 65, 84, 96, 99, 111, 115, 153, 159, 162, 164, 168
- **Severity:** INFO
- **Description:** The state-read.sh script builds strings with literal two-character `\n` sequences (e.g., `"foo\nbar"`). These are passed to `jq --arg`, which treats them as literal backslash-n in the JSON string value. The JSON `\n` then becomes a newline when the consumer interprets the JSON. This works correctly because `jq --arg` performs proper JSON escaping. However, if the output method ever changes away from `jq`, the `\n` sequences would appear as literal characters.
- **Suggestion:** Document this design decision with a comment near the string building section. This is not a Phase 1 scope item.

### 3. `$EXISTING` variable in state-write.sh loaded without size limit

- **Location:** `/Users/lgbarn/Personal/shipyard/scripts/state-write.sh` line 86
- **Severity:** LOW
- **Description:** The entire existing `STATE.md` is loaded into memory via `cat`. If `STATE.md` has grown very large (e.g., from accumulated history entries), this could be slow.
- **Suggestion:** Consider truncating the history section after a certain number of entries in a future phase.

### 4. Process substitution in checkpoint.sh is bash-specific

- **Location:** `/Users/lgbarn/Personal/shipyard/scripts/checkpoint.sh` line 31
- **Severity:** INFO
- **Description:** The `< <(git tag -l ...)` process substitution syntax requires bash. The script already specifies `#!/usr/bin/env bash` and uses `[[ ]]` elsewhere, so this is consistent. However, if POSIX sh portability is ever desired, this would need to change.
- **Suggestion:** No action needed. The shebang correctly specifies bash.

### 5. `.gitignore` excludes `.shipyard/` from the plugin repo itself

- **Location:** `/Users/lgbarn/Personal/shipyard/.gitignore` line 18
- **Severity:** INFO
- **Description:** The `.gitignore` excludes `.shipyard/` which is the plugin's own development state directory. This is correct for the plugin repo (development state should not be committed). However, when users install this plugin in their projects, the `.shipyard/` directory in their repo IS intended to be committed. The `.gitignore` only applies to this repo, so there is no conflict, but this could cause confusion.
- **Suggestion:** The comment on line 17 ("committed selectively, not wholesale") adequately explains this. No action needed.

---

## Secrets Scanning

**Status:** CLEAN

All changed files were scanned for:
- API keys, tokens, passwords, connection strings
- Private keys and certificates
- Base64-encoded credentials
- Secrets in comments, TODOs, or test fixtures
- `.env` files committed to version control

No secrets were found in any changed file. The `.gitignore` correctly excludes `.env`, `.env.*`, `credentials.json`, `*.pem`, and `*.key`.

---

## Dependency Status

No dependencies were added or changed in Phase 1. The scripts rely only on:

| Tool | Usage | Status |
|------|-------|--------|
| `bash` | Script interpreter | System dependency, OK |
| `git` | Tag creation/deletion | System dependency, OK |
| `jq` | JSON output in state-read.sh | System dependency, OK |
| `sed` | Text extraction | System dependency, OK |
| `date` | Timestamp generation | System dependency, OK |
| `tr` | Character filtering | System dependency, OK |
| `find` | Directory discovery | System dependency, OK |
| `head` | Output limiting | System dependency, OK |
| `grep` | Pattern matching | System dependency, OK |
| `basename` | Path manipulation | System dependency, OK |

No third-party packages. No lock files applicable.

---

## IaC / Docker Status

Not applicable. Phase 1 contains no infrastructure-as-code files, Dockerfiles, or container configurations.

---

## Configuration Security

### `.gitignore` Review

| Check | Status |
|-------|--------|
| OS-specific files excluded (.DS_Store, Thumbs.db) | PASS |
| Editor files excluded (.swp, .idea, .vscode) | PASS |
| Secret files excluded (.env, .pem, .key) | PASS |
| Dependency directories excluded (node_modules/) | PASS |
| Dev state excluded (.shipyard/) | PASS |

---

## Cross-Task Observations

### 1. Authentication and Authorization Coherence

Not applicable to this phase. These are local CLI scripts with no auth model. Access control is inherited from the filesystem and git permissions.

### 2. Data Flow Security: `state-write.sh` to `state-read.sh` Pipeline

**Observation:** `state-write.sh` writes `STATE.md`, and `state-read.sh` reads it. The hardening creates a coherent defense:

- **state-write.sh** validates `--phase` as integer and `--status` against an allowlist before writing.
- **state-read.sh** re-validates `phase` as integer after extraction (defense-in-depth against a manually edited or corrupted `STATE.md`).
- **state-read.sh** validates `context_tier` from `config.json` against an allowlist.

The defense-in-depth pattern is correctly applied: even though state-write validates inputs before writing, state-read does not trust the file contents and re-validates. This is the correct approach for scripts that read files which could be edited by humans or other tools.

### 3. Error Handling Consistency

All three scripts:
- Use `set -euo pipefail` (line 14 in each)
- Send error messages to stderr (`>&2`)
- Use exit code 1 for errors, 0 for success
- Use `2>/dev/null || fallback` for optional operations

This is consistent and correct.

### 4. Input Validation Consistency

| Parameter | checkpoint.sh | state-write.sh | state-read.sh |
|-----------|--------------|----------------|---------------|
| Phase/numeric input | DAYS: integer validated | --phase: integer validated | phase: integer validated (from file) |
| Free-text input | LABEL: character-filtered, length-capped | --position, --blocker: **no validation** | status: extracted via sed pattern |
| Enum input | N/A | --status: allowlist validated | context_tier: allowlist validated |

The gap in `--position` and `--blocker` validation is noted as Important Finding #1 above. It does not block shipping because `printf '%s\n'` prevents injection, but it is an inconsistency in the validation approach.

### 5. Trust Boundaries

The scripts operate within a single trust boundary: the local filesystem. External inputs come from:
1. **Command-line arguments** (to checkpoint.sh and state-write.sh) -- validated
2. **File contents** (STATE.md, config.json, ROADMAP.md, ISSUES.md) -- partially validated (phase and context_tier are validated; other file contents are treated as opaque text)
3. **Git output** (tag list in checkpoint.sh) -- trusted (git is the source of truth)

The trust model is appropriate. File contents from `.shipyard/` are semi-trusted (they were written by Shipyard or the user), and the scripts apply validation where the values are used in sensitive contexts (arithmetic, find patterns, git commands).

### 6. Shellcheck Compliance

All three scripts pass `shellcheck` (version 0.11.0) with zero warnings after the Phase 1 changes. Before Phase 1, `checkpoint.sh` had SC2086 and `state-read.sh` had SC2012 warnings.

---

## Conclusion

Phase 1 successfully addressed all 3 critical, 6 important, and 4 minor issues identified in the security research. The fixes are well-implemented with correct patterns:

- **Format string injection** (printf %b) is fully eliminated
- **Input validation** is applied at both write and read boundaries (defense-in-depth)
- **POSIX compatibility** issues (grep -oP, BRE alternation) are resolved
- **Unsafe iteration** (ls-in-for-loop, word-splitting on git output) is replaced with safe patterns
- **Git argument injection** is prevented via character filtering and leading-hyphen stripping
- **Secrets protection** is established via .gitignore

The 2 important and 5 advisory findings are low-risk items appropriate for future phases. None block shipping.

**Phase 1 is cleared for shipping.**
