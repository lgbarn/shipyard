# REVIEW-1.1: Replace Full Skill Injection with Compact Summary

## Stage 1: Spec Compliance
**Verdict:** PASS

### Task 1: Replace skill file read with inline summary
- **Status:** PASS
- **Notes:**
  - The `using_shipyard_content=$(cat ...)` line is fully removed -- zero occurrences remain in `state-read.sh`.
  - A `skill_summary` variable is defined via heredoc (lines 25-47) containing all 14 skill names in `shipyard:<name>` format with short purpose descriptions.
  - The summary content is 21 lines of text (within the 30-line limit specified in acceptance criteria).
  - Header reads "## Shipyard Skills & Commands" as specified.
  - Includes a Triggers paragraph and a Commands line listing all 11 commands.

### Task 2: Update context assembly to use summary instead of full content
- **Status:** PASS
- **Notes:**
  - `full_context` (line 232) references `${skill_summary}` instead of the former `${using_shipyard_content}`.
  - The preamble text now reads "Below are available Shipyard skills and commands. Use the Skill tool to load any skill for full details." -- no mention of "full content" of any skill (confirmed zero occurrences of "full content" in the file).
  - The `<EXTREMELY_IMPORTANT>` wrapper and "You have Shipyard available" preamble are preserved.
  - The `${state_context}` injection is unchanged.

### Task 3: Measure and validate token reduction
- **Status:** PASS
- **Notes:**
  - Summary reports 216 words without state (target: under 800) and 215 words with planning state (target: under 1000). Both well within limits.
  - Summary reports 15 occurrences of `shipyard:` covering all 14 unique skills (the extra is `shipyard:init` in the suggestion/commands area). Confirmed by independent grep: 14 bullet items in the skill list.
  - Summary reports 36/36 tests passing.

### Deviation Assessment
1. **Removed duplicate "Available Commands" block** -- The plan said the existing command list "can be kept where it is or merged into the summary." The builder chose to merge it into the summary and remove the duplicate. This is explicitly permitted by the plan wording ("or merged into the summary").
2. **Simplified no-project-detected branch** -- The "Available Commands" section was removed from the else branch since `skill_summary` is injected unconditionally and already lists all commands. This is a logical consequence of Deviation 1 and does not violate any acceptance criteria.

Both deviations are plan-consistent and reduce token count further.

## Stage 2: Code Quality

### Critical
None.

### Important
None.

### Suggestions

1. **Heredoc `|| true` guard is correct but worth a comment** (`/Users/lgbarn/Personal/shipyard/scripts/state-read.sh:25`)
   - The `read -r -d '' skill_summary <<'SKILLEOF' || true` pattern is necessary because `read` returns nonzero when it hits EOF without finding the delimiter character (empty string). Under `set -e` this would abort without the `|| true`. This is a well-known shell idiom but could confuse future maintainers.
   - Remediation: Add a brief comment above the line, e.g., `# || true needed: read returns 1 on EOF under heredoc-to-variable pattern`.

2. **Skill list maintenance coupling** (`/Users/lgbarn/Personal/shipyard/scripts/state-read.sh:29-43`)
   - The 14 skill names are now hardcoded in the shell script. If a skill is added or renamed, this list must be manually updated. There is no automation or test that validates the list matches the actual `skills/` directory contents.
   - Remediation: Consider adding a test in the bats suite that compares the skill names in `state-read.sh` against `ls skills/` to catch drift. This is low priority since the skill set is stable.

## Summary

**Recommendation: APPROVE**

The implementation cleanly satisfies all three tasks and their acceptance criteria. The full SKILL.md injection is eliminated, replaced by a 21-line compact summary listing all 14 skills, trigger information, and 11 commands. Token reduction is dramatic (approximately 95% based on reported measurements). The two noted deviations are plan-consistent and beneficial. JSON output structure is preserved via the existing `jq -n --arg` pattern. No critical or important issues found. Two minor suggestions logged for future consideration.
