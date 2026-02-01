# Phase 6 Research: Developer Experience

**Researcher:** Domain Researcher Agent
**Date:** 2026-02-01
**Phase Goal:** Add CONTRIBUTING.md, reduce documentation duplication, improve onboarding.

---

## 1. Current State Analysis

### 1.1 Files to Create or Modify

| File | Current State | Phase 6 Action |
|------|--------------|----------------|
| `CONTRIBUTING.md` | Does not exist | Create new |
| `README.md` | 309 lines, includes full install/config/comparison tables | Trim, add CONTRIBUTING.md reference |
| `package.json` | v1.2.0, has `test` script already, no `engines` field | Bump to 2.0.0, add `engines` |
| `hooks/hooks.json` | 15 lines, no `schemaVersion` field | Add `"schemaVersion": "2.0"` |
| `skills/*/SKILL.md` (15 files) | Inconsistent frontmatter | Standardize header block |

### 1.2 Skill Count Discrepancy

The ROADMAP.md references "14 skills" and the README says "14 skills." However, the filesystem contains **15** skill directories:

1. `code-simplification`
2. `documentation`
3. `git-workflow`
4. `infrastructure-validation`
5. `lessons-learned` -- **added in Phase 5, not yet counted in README**
6. `parallel-dispatch`
7. `security-audit`
8. `shipyard-brainstorming`
9. `shipyard-debugging`
10. `shipyard-executing-plans`
11. `shipyard-tdd`
12. `shipyard-verification`
13. `shipyard-writing-plans`
14. `shipyard-writing-skills`
15. `using-shipyard`

The `lessons-learned` skill was added in Phase 5. The README and ROADMAP still reference 14. Phase 6 should update the count to 15 in README.md.

### 1.3 package.json Current State

```json
{
  "name": "@lgbarn/shipyard",
  "version": "1.2.0",
  "scripts": {
    "test": "bash test/run.sh"
  },
  "devDependencies": {
    "bats": "^1.13.0",
    "bats-assert": "^2.2.4",
    "bats-support": "^0.3.0"
  }
}
```

Observations:
- The `test` script already exists and points to `test/run.sh` -- this success criterion is partially met.
- No `engines` field exists.
- Version is `1.2.0`, needs bump to `2.0.0`.

### 1.4 hooks/hooks.json Current State

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/state-read.sh"
          }
        ]
      }
    ]
  }
}
```

The `schemaVersion` field needs to be added as a top-level property.

### 1.5 Documentation Duplication Audit

| Content | README.md | PROTOCOLS.md | commands/init.md | Overlap? |
|---------|-----------|-------------|-----------------|----------|
| Install instructions | Lines 14-27 | No | No | No overlap currently |
| Config options table | Lines 219-228 | Lines 37-59 (full JSON skeleton) | Lines ~100-104 (defaults) | **Yes: Issue #20, #21** |
| Model routing defaults | Lines 232-244 | Lines 24-34 (table) + 47-54 (JSON) | Defaults mentioned | **Yes: three locations** |
| Prerequisites | Lines 7-10 | No | No | No overlap currently |
| Command list | Lines 58-70 | No | No | No overlap currently |
| Skill list | Lines 74-92 | No | No | No overlap currently |

Key duplication findings:
- **Model routing defaults** appear in three places: README.md (lines 232-244), PROTOCOLS.md (lines 24-34 and 47-54), and commands/init.md (lines ~100-104). This is Issue #20 and #21 from ISSUES.md.
- **Config options** appear in README.md (lines 219-228) and PROTOCOLS.md (lines 37-59). The README has a human-friendly table; PROTOCOLS.md has the full JSON skeleton.
- No duplication exists yet between README.md and CONTRIBUTING.md since the latter does not exist.

**Risk for Phase 6:** When creating CONTRIBUTING.md, the setup/test instructions must NOT duplicate what is already in README.md. CONTRIBUTING.md should reference README.md for installation and focus on contributor-specific workflows.

---

## 2. Skill Frontmatter Consistency Audit

### 2.1 Current Frontmatter Pattern

All 15 skills follow the same YAML frontmatter structure:

```yaml
---
name: <skill-name>
description: <description string>
---
```

### 2.2 Header Block Analysis (First 10 Lines)

| Skill | Has `name` | Has `description` | Has TOKEN BUDGET | Has `# Title` | Has Overview/Triggers |
|-------|-----------|-------------------|-----------------|---------------|----------------------|
| code-simplification | Yes | Yes | Yes (line 6) | Yes (line 8) | Overview (line 10) |
| documentation | Yes | Yes | Yes (line 6) | Yes (line 8) | Inline (line 10) |
| git-workflow | Yes | Yes | Yes (line 6) | Yes (line 8) | Activation Triggers |
| infrastructure-validation | Yes | Yes | Yes (line 6) | Yes (line 8) | Activation Triggers |
| lessons-learned | Yes | Yes | Yes (line 6) | Yes (line 8) | Overview (line 10) |
| parallel-dispatch | Yes | Yes | Yes (line 6) | Yes (line 8) | Overview (line 10) |
| security-audit | Yes | Yes | Yes (line 6) | Yes (line 8) | Overview (line 10) |
| shipyard-brainstorming | Yes | Yes (quoted) | Yes (line 6) | Yes (line 8) | Overview (line 10) |
| shipyard-debugging | Yes | Yes | Yes (line 6) | Yes (line 8) | Activation Triggers |
| shipyard-executing-plans | Yes | Yes | Yes (line 6) | Yes (line 8) | Overview (line 10) |
| shipyard-tdd | Yes | Yes | Yes (line 6) | Yes (line 8) | Activation Triggers |
| shipyard-verification | Yes | Yes | Yes (line 6) | Yes (line 8) | Activation Triggers |
| shipyard-writing-plans | Yes | Yes | Yes (line 6) | Yes (line 8) | Overview (line 10) |
| shipyard-writing-skills | Yes | Yes | Yes (line 6) | Yes (line 8) | Overview (line 10) |
| using-shipyard | Yes | Yes | Yes (line 6) | **No** | **No** (line 8 is `<EXTREMELY-IMPORTANT>`) |

### 2.3 Inconsistencies Found

1. **`using-shipyard`**: Does not have a `# Title` heading after the TOKEN BUDGET comment. Line 8 jumps directly into an `<EXTREMELY-IMPORTANT>` block. Every other skill has `# Title` on line 8.

2. **`shipyard-brainstorming`**: The `description` field uses double quotes around the value (all others are unquoted or use different quoting). This is valid YAML but inconsistent.

3. **Section naming after line 8**: Skills split into two patterns:
   - "Overview" section: code-simplification, documentation, lessons-learned, parallel-dispatch, security-audit, shipyard-brainstorming, shipyard-executing-plans, shipyard-writing-plans, shipyard-writing-skills
   - "Activation Triggers" section: git-workflow, infrastructure-validation, shipyard-debugging, shipyard-tdd, shipyard-verification

4. **No usage example in first 10 lines**: The ROADMAP says skills should have "name, description, usage example in first 10 lines." Currently, **zero** skills have a usage example in the first 10 lines. The description field in frontmatter serves as a partial usage hint, but no explicit example block exists.

### 2.4 Recommended Consistent Header Block

```yaml
---
name: <skill-name>
description: <unquoted description string>
---

<!-- TOKEN BUDGET: N lines / ~M tokens -->

# <Skill Title>

<One-line summary of when and why to use this skill.>
```

This matches the majority pattern (12 of 15 skills). The three that deviate need adjustment:
- `using-shipyard`: Add `# Using Shipyard` heading on line 8
- `shipyard-brainstorming`: Remove unnecessary quotes from description
- All skills: The "usage example in first 10 lines" requirement from the ROADMAP may need to be reinterpreted as "the description field serves as the usage hint" since adding a full example block in lines 1-10 would displace the title and overview

---

## 3. CONTRIBUTING.md Structure Research

### 3.1 Content Requirements (from ROADMAP)

The CONTRIBUTING.md must cover:
1. How to add commands
2. How to add skills
3. How to add agents
4. Testing instructions
5. PR checklist
6. Style guide for markdown files

### 3.2 Existing Patterns to Document

**Adding a Command** (from inspecting `commands/*.md`):
- Create `commands/<name>.md`
- Required YAML frontmatter: `description`, `disable-model-invocation: true`, `argument-hint`
- Register in README.md commands table
- Follow the step-numbered workflow pattern used by existing commands

**Adding a Skill** (from `skills/shipyard-writing-skills/SKILL.md`):
- Create `skills/<name>/SKILL.md`
- Required YAML frontmatter: `name`, `description`
- Add TOKEN BUDGET comment
- Follow activation trigger pattern
- Skill names are kebab-case
- Skills auto-activate based on description matching

**Adding an Agent** (from inspecting `agents/*.md`):
- Create `agents/<name>.md`
- Required YAML frontmatter: `name`, `description` (with examples), `model`
- Model values: `opus`, `sonnet`, `haiku`, or `inherit`
- Register in README.md agents table

**Testing:**
- Run `bash test/run.sh` or `npm test`
- Tests use bats-core framework
- Test files go in `test/` directory with `.bats` extension
- Shared helpers in `test/test_helper.bash`

**PR Requirements (recommended):**
- All tests pass (`npm test`)
- `shellcheck --severity=warning scripts/*.sh` passes
- No duplicated content across documentation files
- Conventional commit messages (prefix patterns in PROTOCOLS.md)

### 3.3 Style Guide Observations

From the existing codebase:
- Markdown headings: `#` for document title, `##` for major sections, `###` for subsections
- YAML frontmatter in all command, skill, and agent files
- Kebab-case for file and directory names
- Tables use pipe-delimited markdown format
- Code blocks use triple backticks with language hints
- TOKEN BUDGET comments in skill files: `<!-- TOKEN BUDGET: N lines / ~M tokens -->`
- Commit convention: `feat(scope)`, `fix(scope)`, `docs(scope)`, etc. (documented in PROTOCOLS.md)

---

## 4. Schema Versioning for hooks.json

### 4.1 Current hooks.json Structure

The file is a simple JSON object with a single `hooks` key. Adding `schemaVersion` as a top-level field is straightforward:

```json
{
  "schemaVersion": "2.0",
  "hooks": {
    "SessionStart": [...]
  }
}
```

### 4.2 Migration Path from v1.x

The v1.x hooks.json has no `schemaVersion` field. The migration path should document:
- **Detection**: If `schemaVersion` is absent, treat as v1.x
- **Compatibility**: v2.0 hooks.json is backward-compatible structurally (the `hooks` key is unchanged)
- **What changed in v2.0**: Added `schemaVersion` field, state-read.sh improvements from Phases 1-4, schema 2.0 in STATE.md
- **Migration action**: Add `"schemaVersion": "2.0"` to the top level of hooks.json. No other changes needed to the hooks structure itself.

### 4.3 Risk

Claude Code's plugin system reads hooks.json. Adding an unknown top-level key (`schemaVersion`) should be safe -- Claude Code should ignore unknown keys. However, this should be verified during Phase 7 smoke testing.

---

## 5. package.json Changes

### 5.1 Version Bump

Current: `1.2.0` -> Target: `2.0.0`

This is a major version bump reflecting:
- Security hardening (Phase 1)
- Testing foundation (Phase 2)
- Reliability improvements (Phase 3)
- Token optimization (Phase 4)
- Lessons-learned system (Phase 5)
- Developer experience improvements (Phase 6)

### 5.2 `engines` Field

The `engines` field in package.json specifies minimum runtime versions. For Shipyard:

```json
{
  "engines": {
    "node": ">=16.0.0"
  }
}
```

However, Shipyard is NOT a Node.js application -- it is a Claude Code plugin that uses bash scripts. The `engines` field in npm's package.json spec only supports `node` and `npm` officially. Bash, jq, and git versions cannot be enforced via `engines`.

**Recommended approach:** Use `engines` for node (since npm is the install mechanism), and document bash/jq/git requirements in CONTRIBUTING.md and README.md prerequisites section. The scripts themselves already validate dependencies at runtime (e.g., `state-read.sh` checks for `jq`).

Alternative: Use a non-standard `engines` structure as documentation-only:

```json
{
  "engines": {
    "node": ">=16.0.0"
  },
  "systemDependencies": {
    "bash": ">=4.0",
    "jq": ">=1.6",
    "git": ">=2.20"
  }
}
```

The `systemDependencies` field would be ignored by npm but serves as human-readable documentation within package.json.

### 5.3 `test` Script

Already exists: `"test": "bash test/run.sh"`. This is correct and functional. `npm test` should work as-is once dependencies are installed.

---

## 6. README.md Audit

### 6.1 Content That Should Stay in README.md

- Project description (lines 1-5)
- Prerequisites (lines 7-10)
- Installation instructions (lines 12-27)
- Quick Start (lines 35-54)
- Command table (lines 56-70)
- Skill table (lines 72-92) -- **update count from 14 to 15**
- Agent table (lines 94-107)
- How It Works / Lifecycle (lines 109-140)
- Project State Structure (lines 142-161)
- Plugin Structure (lines 163-212) -- **add `lessons-learned` to skills list**
- Configuration table (lines 214-228) -- keep summary, reference PROTOCOLS.md for full config skeleton
- Feature Comparison (lines 246-297) -- **update skill count**
- Acknowledgments (lines 299-305)
- License (lines 307-308)

### 6.2 Content to Add to README.md

- Reference to CONTRIBUTING.md: Add a "Contributing" section before License pointing to the new file
- Update skill count from 14 to 15

### 6.3 Content to Trim from README.md

- **Model Routing Defaults** (lines 230-244): This JSON block duplicates PROTOCOLS.md. Replace with a one-line reference: "See `docs/PROTOCOLS.md` for model routing configuration."
- Consider whether the full Configuration table (lines 214-228) should remain or be trimmed. **Recommendation:** Keep the table (it is user-facing reference) but remove the JSON code block below it.

---

## 7. Relevant Issues to Address

The following open issues from ISSUES.md are directly in-scope for Phase 6:

| Issue | Description | Phase 6 Action |
|-------|-------------|----------------|
| #16 | Hardcoded skill list in state-read.sh has no automated sync check | Document in CONTRIBUTING.md: when adding a skill, update the hardcoded list in state-read.sh |
| #17 | Discovery Workflow numbered list skips step 2 | Fix in skills/shipyard-writing-skills/SKILL.md during frontmatter consistency pass |
| #18 | Red Flags section uses ## instead of ### in EXAMPLES.md | Fix during consistency pass |
| #19 | TOKEN BUDGET comments are advisory only | Document in CONTRIBUTING.md style guide; defer lint to future phase |
| #20 | init.md repeats config defaults also in PROTOCOLS.md | Deduplicate during README audit pass |
| #22 | Minor protocol reference format inconsistency in builder.md | Fix during consistency pass |

---

## 8. Potential Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `schemaVersion` in hooks.json breaks Claude Code plugin loading | Low | High | Test with `claude plugin install` after change; Claude Code should ignore unknown keys |
| CONTRIBUTING.md duplicates README.md setup instructions | Medium | Low | Explicit cross-references; CONTRIBUTING focuses on contributor workflows, README on user workflows |
| `engines` field with non-standard keys causes npm warnings | Low | Low | Use standard `engines.node` only; put bash/jq/git in a separate `systemDependencies` key |
| Skill frontmatter changes break skill loading | Low | High | Only change formatting/quoting, not the `name` or `description` semantic content |
| Version bump to 2.0.0 before Phase 7 validation | Low | Medium | Phase 7 is the final validation gate; 2.0.0 is set here but release tag happens in Phase 7 |
| `using-shipyard` header change disrupts activation | Low | Medium | The `<EXTREMELY-IMPORTANT>` block can move to after the standard header without changing behavior |

---

## 9. Implementation Plan Inputs

### 9.1 Suggested Task Decomposition

**Task 1: CONTRIBUTING.md + README.md updates**
- Create CONTRIBUTING.md covering all required sections
- Update README.md: add Contributing section, update skill count to 15, trim model routing JSON block, add `lessons-learned` to plugin structure
- Resolve cross-reference duplication (Issues #20)

**Task 2: package.json + hooks/hooks.json**
- Bump package.json version to 2.0.0
- Add `engines` field
- Add `schemaVersion: "2.0"` to hooks.json
- Document migration path in CONTRIBUTING.md or a dedicated section

**Task 3: Skill frontmatter consistency + issue fixes**
- Standardize all 15 skills to the consistent header pattern
- Fix `using-shipyard` missing title
- Fix `shipyard-brainstorming` quoted description
- Fix Issue #17 (skipped step 2)
- Fix Issue #18 (heading hierarchy in EXAMPLES.md)
- Fix Issue #22 (builder.md format inconsistency)

### 9.2 Verification Commands

```bash
# Success criterion 1: CONTRIBUTING.md exists with required sections
test -f CONTRIBUTING.md && grep -q "Adding Commands" CONTRIBUTING.md && grep -q "Adding Skills" CONTRIBUTING.md && grep -q "Adding Agents" CONTRIBUTING.md && grep -q "Running Tests" CONTRIBUTING.md && grep -q "PR" CONTRIBUTING.md && echo "PASS" || echo "FAIL"

# Success criterion 2: package.json version and npm test
grep -q '"version": "2.0.0"' package.json && npm test && echo "PASS" || echo "FAIL"

# Success criterion 3: hooks.json schemaVersion
jq -e '.schemaVersion == "2.0"' hooks/hooks.json > /dev/null && echo "PASS" || echo "FAIL"

# Success criterion 4: No duplicated setup/install instructions
# Manual review: grep for install instructions in CONTRIBUTING.md
grep -c "plugin marketplace add\|plugin install\|git clone" CONTRIBUTING.md | xargs test 0 -eq && echo "PASS: no install duplication" || echo "REVIEW: potential duplication"

# Success criterion 5: All skills have consistent header (title on line 8)
for skill in skills/*/SKILL.md; do
  line8=$(sed -n '8p' "$skill")
  if [[ ! "$line8" =~ ^#\  ]]; then
    echo "FAIL: $(dirname $skill | xargs basename) - line 8 is not a title: $line8"
  fi
done
echo "Header check complete"
```

---

## 10. Documentation Links

- [Claude Code Plugin Documentation](https://docs.anthropic.com/en/docs/claude-code/plugins)
- [npm package.json engines field](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#engines)
- [Conventional Commits specification](https://www.conventionalcommits.org/)
- [bats-core testing framework](https://github.com/bats-core/bats-core)
- [ShellCheck](https://www.shellcheck.net/)

---

## 11. Open Questions

1. **Skill count in ROADMAP.md**: The ROADMAP says "14 skills" but there are now 15 after Phase 5 added `lessons-learned`. Should the ROADMAP be updated, or is it intentionally a snapshot of the v1.2.0 baseline?

2. **Usage example in first 10 lines**: The ROADMAP requires "usage example in first 10 lines" for all skills. No skill currently has this. Options:
   - (a) Reinterpret: the `description` frontmatter field serves as the usage hint (already present).
   - (b) Add a brief usage line after the title, displacing Overview/Triggers to line 11+.
   - **Recommendation:** Option (a) -- the description field already tells users when to use the skill, and cramming an example into line 9-10 would be forced.

3. **`engines` field scope**: Should `engines` include only `node` (npm-standard), or also document bash/jq/git in a custom field? **Recommendation:** Use standard `engines.node` only; document system dependencies in CONTRIBUTING.md prerequisites section.
