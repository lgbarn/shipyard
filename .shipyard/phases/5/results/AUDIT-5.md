# Security Audit Report
**Phase:** Phase 5 - Lessons-Learned System
**Date:** 2026-02-01
**Scope:** 5 files analyzed, 284 lines added
**Auditor:** Security & Compliance Auditor

## Summary
**Verdict:** PASS
**Critical findings:** 0
**Important findings:** 2
**Advisory findings:** 3

Phase 5 implements a lessons-learned system that captures discoveries during building/shipping and feeds them back into project memory. The implementation focuses on reading from LESSONS.md in state-read.sh (lines 166-179) and instructing agents to write to LESSONS.md and CLAUDE.md in ship.md. All security-critical operations (file reading, grep/sed usage) have been examined.

## Critical Findings
None.

## Important Findings

### Finding 1: Unvalidated User Input to File System Operations (CLAUDE.md Write)
- **Location:** /Users/lgbarn/Personal/shipyard/commands/ship.md:199-202
- **Category:** Path Traversal / File Write Safety
- **Description:** Step 3a instructs agents to write to `CLAUDE.md` in the "project root" based on user-provided lesson content. The command definition does not specify validation of the CLAUDE.md path or sanitization of user-provided lesson text before writing to files. While this is an instruction to an LLM agent (not executable code), the agent must perform file writes based on user input.
- **Risk:** If an agent follows these instructions literally without validating the file path, a malicious user could potentially:
  1. Provide lesson content containing path traversal sequences that influence where files are written
  2. Inject content that could be interpreted as executable code in contexts where CLAUDE.md is processed
  3. Overwrite CLAUDE.md with malicious instructions that affect future agent behavior
- **Remediation:** Add explicit validation instructions to ship.md Step 3a:
  ```markdown
  3. If `CLAUDE.md` exists in the project root:
     - Validate that CLAUDE.md is in the working directory root (not a symlink or path traversal)
     - Ask user: "Update CLAUDE.md with these lessons? (y/n)"
     - Sanitize lesson content: ensure no path traversal characters, no executable directives
  ```
- **Reference:** CWE-22 (Improper Limitation of a Pathname to a Restricted Directory)

### Finding 2: Unquoted Variable in Process Substitution (state-read.sh)
- **Location:** /Users/lgbarn/Personal/shipyard/scripts/state-read.sh:174
- **Category:** Shell Injection
- **Description:** Line 174 uses `<<< "$last_five"` in a while-read loop. The variable `$last_five` is derived from `grep -n` output (line 167) and `tail -5` (line 169), which processes line numbers from LESSONS.md. While the variable IS quoted in the here-string, the data flows through multiple processing steps that could be vulnerable if LESSONS.md contains malicious content.
- **Risk:** If LESSONS.md is user-controlled (which it is, via Step 3a of ship.md), a malicious user could craft lesson headers containing newlines or special characters that cause the `while IFS=: read -r line_num _` loop to behave unexpectedly. The grep pattern `^## \[` is anchored and specific, which limits exploitation, but the subsequent processing does not validate that `line_num` is a pure integer before using it in `sed -n`.
- **Remediation:** Add validation after line 171:
  ```bash
  while IFS=: read -r line_num _; do
      # Validate line_num is a pure integer
      if ! [[ "$line_num" =~ ^[0-9]+$ ]]; then
          continue
      fi
      chunk=$(sed -n "${line_num},$((line_num + 8))p" ".shipyard/LESSONS.md" 2>/dev/null || echo "")
      lesson_snippet="${lesson_snippet}${chunk}\n"
  done <<< "$last_five"
  ```
- **Reference:** CWE-78 (Improper Neutralization of Special Elements used in an OS Command)

## Advisory Findings

### Finding 3: No Integrity Check on LESSONS.md Content
- **Location:** /Users/lgbarn/Personal/shipyard/scripts/state-read.sh:166-179
- **Description:** The lessons loading code reads LESSONS.md without verifying its integrity or origin. If LESSONS.md is modified outside the Shipyard workflow (e.g., by a malicious script or compromised dependency), the injected lessons could mislead agents.
- **Risk:** Low. This is primarily a trust boundary issue — Shipyard trusts files in .shipyard/ directory. However, if a project is cloned from an untrusted source, malicious lessons could influence agent behavior.
- **Remediation:** Document in SKILL.md that LESSONS.md should be reviewed before first use in new projects. Consider adding a comment in state-read.sh noting the trust assumption.

### Finding 4: Incomplete Input Validation in ship.md Instructions
- **Location:** /Users/lgbarn/Personal/shipyard/commands/ship.md:173, 204
- **Description:** Ship.md instructs agents to check if user types "skip" or provide specific commit messages, but does not specify handling of unexpected input formats (e.g., "SKIP", "Skip", leading/trailing whitespace).
- **Risk:** Minimal. Agents may interpret input inconsistently, leading to UX issues rather than security vulnerabilities.
- **Remediation:** Add normalization instructions: "Check if user input matches 'skip' (case-insensitive, trimmed)."

### Finding 5: No Rate Limiting on Lesson Extraction
- **Location:** /Users/lgbarn/Personal/shipyard/scripts/state-read.sh:169
- **Description:** The script extracts last 5 lesson headers with `tail -5`, but if LESSONS.md contains thousands of lesson sections, the intermediate `grep -n` operation on line 167 could consume significant memory.
- **Risk:** Very Low. LESSONS.md is expected to grow linearly with project phases (typically < 50 entries). Memory exhaustion is unlikely.
- **Remediation:** None required. Note for future: if LESSONS.md exceeds 1000 entries, consider adding `head -1000` before `tail -5`.

## Dependency Status
No dependency changes in this phase.

| Package | Version | Known CVEs | Status |
|---------|---------|-----------|--------|
| bats-core | 1.11.2 | None | OK |
| bats-support | 0.3.0 | None | OK |
| bats-assert | 2.1.0 | None | OK |

## IaC Status
Not applicable (no IaC files changed in this phase).

## Cross-Task Observations

### Positive Security Patterns
1. **Defense in Depth:** The lessons loading code (state-read.sh:166-179) operates in a read-only context during SessionStart hook. Even if malicious content is in LESSONS.md, it cannot directly execute code — it can only influence agent prompts.
2. **Tier-Based Access Control:** Lessons are only loaded in execution/full tier (line 124 condition), preventing unnecessary exposure during planning phases.
3. **Error Suppression Safety:** All file operations use `2>/dev/null || echo ""` patterns, ensuring that missing files do not crash the script or expose error details.
4. **Test Coverage:** Three new tests (test/state-read.bats:128-211) verify lessons loading behavior, including negative cases (no LESSONS.md, wrong tier).

### Areas Requiring Attention
1. **User Input to File Write Flow:** The ship.md → agent → LESSONS.md/CLAUDE.md write path trusts that LLM agents will sanitize user input. This is a weak security boundary. Recommendation: Add a validation gate before file writes (see Important Finding 1).
2. **Lessons as Prompt Injection Vector:** LESSONS.md content is directly injected into agent prompts via state-read.sh. Malicious lesson content could attempt prompt injection attacks to manipulate agent behavior. The markdown structure provides some protection (lessons are clearly delimited), but consider adding a prompt injection warning in SKILL.md.
3. **No CLAUDE.md Write Audit Trail:** ship.md instructs agents to modify CLAUDE.md (potentially in the project root outside .shipyard/), but does not require logging what was changed or preserving a backup. Recommendation: Instruct agents to create CLAUDE.md.backup before modifications.

### Security Coherence Across Tasks
- **Task 1.1 (Skill Definition):** Defines format and quality standards but does not address security implications of lessons content. Status: **Adequate** — quality standards implicitly filter some malicious content (e.g., rejecting code snippets referencing specific line numbers).
- **Task 1.2 (ship.md Integration):** Adds lesson capture step but lacks input validation and path verification. Status: **Needs Hardening** — see Important Finding 1.
- **Task 2.1 (state-read.sh Loading):** Implements read operations with good error handling but no content validation. Status: **Adequate** — read-only operations limit blast radius.

### Comparison to Previous Phases
Phase 5 introduces a new user-controlled data file (LESSONS.md) that flows into agent prompts and potentially into CLAUDE.md (which affects future agent behavior). This is the first phase to create a persistent feedback loop where user input in one session can influence agent instructions in future sessions. Previous phases focused on improving code that Shipyard owns (shell scripts, command definitions). Phase 5's security model depends on trusting LLM agents to sanitize user input before file writes — this is a weaker guarantee than input validation in shell scripts.

**Recommendation:** Before shipping Phase 5, add explicit validation instructions to ship.md Step 3a (see Important Finding 1 remediation).

## Test Results
All 39 tests pass, including 3 new tests for lessons loading:
- ✓ Lessons displayed in execution tier when LESSONS.md exists
- ✓ No lessons displayed when LESSONS.md missing
- ✓ No lessons displayed in planning tier (tier restriction enforced)

**Test coverage assessment:** Good. Tests verify functional behavior and tier-based access control. Missing: Tests for malicious content in LESSONS.md (e.g., newlines in headers, path traversal in lesson text).

**Recommendation:** Add one test in test/state-read.bats:
```bash
@test "state-read: lessons with malicious headers do not cause injection" {
    # Create LESSONS.md with newline injection attempt in header
    setup_shipyard_with_state
    mkdir -p .shipyard/phases/1
    cat > .shipyard/LESSONS.md <<'EOF'
## [2026-01-15] Phase 1: Test
$(whoami)
---
EOF
    run bash "$STATE_READ"
    assert_success
    refute_output --partial "$(whoami)"
}
```

## shellcheck Status
✓ All scripts pass shellcheck with zero warnings.
```
scripts/state-read.sh: No issues detected
```

## Conclusion
Phase 5 successfully implements the lessons-learned system with good separation of concerns (read logic in state-read.sh, write instructions in ship.md, format/quality in SKILL.md). The implementation follows established security patterns from previous phases (quoted variables, error suppression, tier-based access).

**Two Important findings require remediation before shipping:**
1. Add path validation and content sanitization instructions to ship.md Step 3a
2. Add integer validation in state-read.sh line_num processing loop

**Once these are addressed, Phase 5 is ready to ship.**

**Files analyzed:**
- /Users/lgbarn/Personal/shipyard/skills/lessons-learned/SKILL.md (108 lines)
- /Users/lgbarn/Personal/shipyard/commands/build.md (+10 lines, lesson seeding note)
- /Users/lgbarn/Personal/shipyard/commands/ship.md (+63 lines, Step 3a lessons capture)
- /Users/lgbarn/Personal/shipyard/scripts/state-read.sh (+16 lines, lessons loading)
- /Users/lgbarn/Personal/shipyard/test/state-read.bats (+87 lines, 3 new tests)
