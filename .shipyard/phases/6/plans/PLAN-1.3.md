---
phase: developer-experience
plan: 3
wave: 1
dependencies: []
must_haves:
  - All 15 skills have a # Title heading on line 8
  - shipyard-brainstorming description is unquoted
  - using-shipyard has # Title on line 8 with EXTREMELY-IMPORTANT block shifted down
  - Issue #17 fixed (skipped step 2 in shipyard-writing-skills/SKILL.md)
  - Issue #18 fixed (heading hierarchy in EXAMPLES.md)
  - Issue #22 fixed (builder.md protocol reference format)
files_touched:
  - skills/using-shipyard/SKILL.md
  - skills/shipyard-brainstorming/SKILL.md
  - skills/shipyard-writing-skills/SKILL.md
  - skills/shipyard-writing-skills/EXAMPLES.md
  - agents/builder.md
tdd: false
---

# Plan 1.3: Skill Frontmatter Standardization and Issue Fixes

## Context

Research found that 14 of 15 skills follow a consistent header pattern (frontmatter -> TOKEN BUDGET -> `# Title` on line 8 -> Overview/Triggers on line 10). Two skills deviate: `using-shipyard` lacks a `# Title` heading on line 8, and `shipyard-brainstorming` has an unnecessarily quoted description. Additionally, three open issues (#17, #18, #22) involve minor formatting fixes in skill and agent files that fit naturally into this consistency pass.

## Tasks

<task id="1" files="skills/using-shipyard/SKILL.md,skills/shipyard-brainstorming/SKILL.md" tdd="false">
  <action>
    Standardize the two non-conforming skill headers:

    **`skills/using-shipyard/SKILL.md`**: Insert `# Using Shipyard` on line 8 and a blank line on line 9, shifting the existing `<EXTREMELY-IMPORTANT>` block from line 8 down to line 10. The result for lines 1-10 should be:
    ```
    ---
    name: using-shipyard
    description: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
    ---

    <!-- TOKEN BUDGET: 210 lines / ~630 tokens -->

    # Using Shipyard

    <EXTREMELY-IMPORTANT>
    ```

    **`skills/shipyard-brainstorming/SKILL.md`**: Remove the double quotes around the description value. Change line 3 from:
    ```
    description: "You MUST use this before any creative work..."
    ```
    to:
    ```
    description: You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation. Also used during /shipyard:init for requirements gathering.
    ```
  </action>
  <verify>cd /Users/lgbarn/Personal/shipyard && line8_using=$(sed -n '8p' skills/using-shipyard/SKILL.md) && line8_brainstorm=$(sed -n '8p' skills/shipyard-brainstorming/SKILL.md) && [[ "$line8_using" == "# Using Shipyard" ]] && [[ "$line8_brainstorm" == "# Brainstorming Ideas Into Designs" ]] && ! grep -q '^description: "' skills/shipyard-brainstorming/SKILL.md && echo "PASS" || echo "FAIL"</verify>
  <done>Both skills have a `# Title` heading on line 8 and shipyard-brainstorming has an unquoted description.</done>
</task>

<task id="2" files="skills/shipyard-writing-skills/SKILL.md,skills/shipyard-writing-skills/EXAMPLES.md" tdd="false">
  <action>
    Fix Issues #17 and #18:

    **Issue #17** (`skills/shipyard-writing-skills/SKILL.md` lines 418-422): The Discovery Workflow numbered list skips step 2. Renumber the list:
    ```
    1. **Encounters problem** ("tests are flaky")
    2. **Finds SKILL** (description matches)
    3. **Scans overview** (is this relevant?)
    4. **Reads patterns** (quick reference table)
    5. **Loads example** (only when implementing)
    ```

    **Issue #18** (`skills/shipyard-writing-skills/EXAMPLES.md` line 165): The Red Flags section uses `## Red Flags` (h2) inside what should be a subsection. Change `## Red Flags - STOP and Start Over` to `### Red Flags - STOP and Start Over`.
  </action>
  <verify>cd /Users/lgbarn/Personal/shipyard && grep -n "^2\. \*\*Finds SKILL" skills/shipyard-writing-skills/SKILL.md > /dev/null && grep -q "^### Red Flags" skills/shipyard-writing-skills/EXAMPLES.md && echo "PASS" || echo "FAIL"</verify>
  <done>Discovery Workflow is numbered 1-5 with no gaps. Red Flags heading uses ### (correct hierarchy).</done>
</task>

<task id="3" files="agents/builder.md" tdd="false">
  <action>
    Fix Issue #22 (`agents/builder.md` line 78): Normalize the protocol reference format. Change:
    ```
    For IaC changes, follow **Commit Convention** IaC section (see `docs/PROTOCOLS.md`).
    ```
    to:
    ```
    For IaC changes, follow **Commit Convention** IaC section (see `docs/PROTOCOLS.md`) -- use IaC-specific prefixes for Terraform, Ansible, and Docker commits.
    ```
    This matches the pattern on line 82: `Follow **Worktree Protocol** (see \`docs/PROTOCOLS.md\`) -- handle worktree paths, branch context, and \`.shipyard/\` directory location.` Both lines now have capitalized "Follow" (fix the lowercase "follow") and a trailing `--` description.

    Specifically, also capitalize "follow" to "Follow" on line 78 to match the convention on line 82.
  </action>
  <verify>cd /Users/lgbarn/Personal/shipyard && grep -q "Follow \*\*Commit Convention\*\*.*--" agents/builder.md && echo "PASS" || echo "FAIL"</verify>
  <done>builder.md line 78 uses consistent protocol reference format: capitalized "Follow", trailing double-dash description.</done>
</task>
