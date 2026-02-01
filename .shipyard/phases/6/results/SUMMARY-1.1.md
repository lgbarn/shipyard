# SUMMARY: Plan 1.1 -- CONTRIBUTING.md and README.md Cleanup

## Status: COMPLETE

## Tasks Completed

### Task 1: Create CONTRIBUTING.md
- **Status**: PASS
- **Commit**: `shipyard(phase-6): create CONTRIBUTING.md with contributor workflows`
- Created CONTRIBUTING.md with all 7 required sections:
  1. Prerequisites (references README.md, does not duplicate install instructions)
  2. Adding Commands (frontmatter, step-numbered workflow, README table)
  3. Adding Skills (directory structure, SKILL.md template, header block order, state-read.sh note)
  4. Adding Agents (frontmatter, model values, README table)
  5. Running Tests (npm test, bats-core, test directory structure)
  6. PR Requirements (tests, shellcheck, no duplication, conventional commits)
  7. Markdown Style Guide (heading levels, frontmatter, kebab-case, tables, code blocks, TOKEN BUDGET)

### Task 2: Update README.md
- **Status**: PASS
- **Commit**: `shipyard(phase-6): update README.md with 15 skills, lessons-learned, and cleanup`
- Changes made:
  1. Skill count: "14 skills" changed to "15 skills" (line 74)
  2. Skill table: Added `lessons-learned` row
  3. Plugin structure: Added `lessons-learned/` to skills tree
  4. Feature comparison header: Updated version from `v1.2.0` to `v2.0.0`
  5. Feature comparison Skills row: "14 skills" changed to "15 skills"
  6. Feature comparison Scale/Skills row: "14" changed to "15"
  7. Model Routing Defaults: Removed `### Model Routing Defaults` heading and JSON code block, replaced with PROTOCOLS.md reference
  8. Contributing section: Added `## Contributing` section before `## License`

### Task 3: Cross-reference verification
- **Status**: PASS
- Verified CONTRIBUTING.md contains zero install-related strings (`plugin marketplace add`, `plugin install`, `git clone`)
- Verified CONTRIBUTING.md contains no config.json skeleton or model_routing defaults
- Verified README.md Contributing section points to CONTRIBUTING.md without inlining contributor details

## Files Modified

| File | Action |
|------|--------|
| `CONTRIBUTING.md` | Created (118 lines) |
| `README.md` | Updated (8 changes) |

## Decisions Made

1. **model_routing in config table**: The plan's verify command (`! grep -q "model_routing"`) would fail because the Configuration table legitimately references `model_routing` as a config option name. The JSON code block and heading were fully removed (the actual duplication). The table reference was updated to point to `docs/PROTOCOLS.md` instead of "see below". This is a minor deviation from the overly strict verify command but correctly implements the plan's intent.

2. **lessons-learned placement in tree**: Added after `shipyard-writing-skills/` and before `using-shipyard/` to maintain alphabetical adjacency while keeping `using-shipyard/` as the final entry.

## Issues Encountered

None. All tasks completed without errors.

## Verification Results

| Check | Result |
|-------|--------|
| CONTRIBUTING.md exists with 7 sections | PASS |
| README.md shows "15 skills" | PASS |
| README.md includes lessons-learned | PASS |
| README.md references CONTRIBUTING.md | PASS |
| Model Routing JSON block removed | PASS |
| No install duplication in CONTRIBUTING.md | PASS |
| No config skeleton in CONTRIBUTING.md | PASS |
