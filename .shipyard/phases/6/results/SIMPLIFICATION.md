# Simplification Report
**Phase:** Phase 6 - Developer Experience
**Date:** 2026-02-01
**Files analyzed:** 22
**Findings:** 4 total (1 high priority, 2 medium priority, 1 low priority)

## High Priority

### Triplication of version requirements across three files
- **Type:** Consolidate
- **Locations:**
  - `/Users/lgbarn/Personal/shipyard/CONTRIBUTING.md:10-13`
  - `/Users/lgbarn/Personal/shipyard/package.json:20-26`
  - `/Users/lgbarn/Personal/shipyard/README.md:10` (partial - only mentions jq)
- **Description:** System dependency versions (bash >= 4.0, jq >= 1.6, git >= 2.20, node >= 16) are now specified in three locations with slightly different formats. CONTRIBUTING.md lists all four with markdown formatting, package.json uses JSON with `engines.node` and `systemDependencies` for the others, and README.md only mentions jq in prose.
- **Suggestion:** Make package.json the single source of truth. Update CONTRIBUTING.md Prerequisites section to programmatically reference package.json or use a build step to generate the version table. Alternatively, add a comment in CONTRIBUTING.md: "<!-- Versions must match package.json -->" and accept manual sync risk.
- **Impact:**
  - Lines saved: ~4 lines if using comments/references
  - Clarity gained: Single source of truth eliminates version drift
  - Maintenance: Reduces risk of updating one file but not others

## Medium Priority

### schemaVersion field added to hooks.json without documentation
- **Type:** Document
- **Locations:** `/Users/lgbarn/Personal/shipyard/hooks/hooks.json:2`
- **Description:** A `schemaVersion: "2.0"` field was added to hooks.json, but there's no schema documentation, no validation of this version field, and no indication of what changed between version 1.x and 2.0.
- **Suggestion:** Either (1) create `docs/HOOKS-SCHEMA.md` documenting the schema versions and what changed, or (2) if this is preparatory for future multi-version support, add an inline comment explaining the intent: `"schemaVersion": "2.0", // Reserved for future schema evolution`.
- **Impact:**
  - Clarity gained: Future maintainers understand the versioning intent
  - Prevents confusion about undocumented schema versions

### Missing lessons-learned skill in using-shipyard table
- **Type:** Synchronize
- **Locations:**
  - `/Users/lgbarn/Personal/shipyard/skills/using-shipyard/SKILL.md:54-71` (table missing lessons-learned)
  - `/Users/lgbarn/Personal/shipyard/README.md:74-92` (complete table with lessons-learned)
- **Description:** The using-shipyard skill says "14 skills" but the table only lists 14 skills (missing `lessons-learned`). The README correctly says "15 skills" and includes `lessons-learned` in its table. The actual skill count is 15 (verified by counting directories in `skills/`). The `lessons-learned` skill was added in Phase 5 but never added to the using-shipyard discovery table.
- **Suggestion:** Add the missing table row to `skills/using-shipyard/SKILL.md` between lines 70-71:
  ```markdown
  | `shipyard:lessons-learned` | Phase retrospectives and knowledge capture |
  ```
  And update line 54 from "Shipyard provides these 14 skills:" to "Shipyard provides these 15 skills:".
- **Impact:**
  - Lines changed: 2 (add table row, update count)
  - Clarity gained: Skill discovery table matches actual available skills
  - User impact: Users can now discover the lessons-learned skill through the using-shipyard reference

## Low Priority

### "Thank you for your interest" pleasantry in CONTRIBUTING.md
- **Type:** Refactor
- **Locations:** `/Users/lgbarn/Personal/shipyard/CONTRIBUTING.md:3`
- **Description:** The opening line "Thank you for your interest in contributing to Shipyard" is polite but adds no functional value. This is a minor AI pleasantry pattern.
- **Suggestion:** Remove the pleasantry and start directly with "This guide covers how to add commands, skills, and agents, run tests, and submit pull requests." Alternatively, keep it for community tone - this is subjective.
- **Impact:**
  - Lines saved: 1-2 lines
  - Impact: Minimal - this is stylistic

## Summary

- **Duplication found:** 1 instance (version requirements) across 3 files
- **Dead code found:** 0 unused definitions
- **Complexity hotspots:** 0 functions exceeding thresholds
- **AI bloat patterns:** 1 instance (pleasantry in CONTRIBUTING.md)
- **Documentation gaps:** 1 instance (undocumented schemaVersion field)
- **Synchronization issues:** 1 instance (skill count mismatch)
- **Estimated cleanup impact:** 4-6 lines removable, 1 single-source-of-truth improvement, 2 documentation/sync fixes

## Recommendation

**Simplification is recommended before shipping for HIGH priority only.**

The version requirements triplication (HIGH) should be addressed because it creates a real maintenance burden - future updates will need to touch three files in different formats, increasing the risk of version drift.

The MEDIUM priority findings are minor:
- schemaVersion documentation can be deferred if this is preparatory work
- Skill count mismatch is cosmetic but easy to fix (2-line change)

The LOW priority finding (pleasantry) is entirely subjective and can be safely ignored.

## Additional Observations

**What went well:**
- CONTRIBUTING.md properly references README.md for installation instructions instead of duplicating them
- No duplication of command/skill/agent descriptions between files
- Skills receive only frontmatter updates (adding `# Skill Title` headers), minimal content changes
- The builder.md protocol reference fix (commit cbdf870) shows good attention to consistency
- package.json `systemDependencies` field is a good pattern for non-npm dependencies

**No simplification needed for:**
- Skill frontmatter standardization (commits 83e55c3, e81d3a0) - these are necessary formatting fixes
- Token budget comments added to skills - advisory metadata, not bloat
- Version bump to 2.0.0 - appropriate for this milestone
- Keywords added to package.json - standard npm metadata

The phase overall shows disciplined documentation work with minimal bloat. The main finding (version triplication) is a result of maintaining both npm metadata and contributor documentation, which is a reasonable trade-off if manual synchronization is acceptable.
