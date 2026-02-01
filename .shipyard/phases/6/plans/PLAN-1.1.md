---
phase: developer-experience
plan: 1
wave: 1
dependencies: []
must_haves:
  - CONTRIBUTING.md exists with sections for adding commands, skills, agents, running tests, PR requirements, and style guide
  - README.md references CONTRIBUTING.md and has no duplicated setup instructions
  - README.md skill count updated from 14 to 15
  - README.md includes lessons-learned in plugin structure and skill table
  - Model routing JSON block removed from README.md (replaced with PROTOCOLS.md reference)
  - Issue #20 addressed (init.md duplication already resolved in prior phase; verify no regression in README)
files_touched:
  - CONTRIBUTING.md
  - README.md
tdd: false
---

# Plan 1.1: CONTRIBUTING.md and README.md Cleanup

## Context

Phase 6 requires a CONTRIBUTING.md covering contributor workflows and a README.md audit to eliminate duplication and update stale counts. The README currently says "14 skills" but Phase 5 added `lessons-learned` (total: 15). The Model Routing Defaults JSON block (lines 230-244) duplicates `docs/PROTOCOLS.md` and should be replaced with a cross-reference.

## Tasks

<task id="1" files="CONTRIBUTING.md" tdd="false">
  <action>
    Create `CONTRIBUTING.md` at the repository root with the following sections:

    1. **Prerequisites** -- reference README.md for installation; list system dependencies (bash >= 4.0, jq >= 1.6, git >= 2.20, node >= 16 for npm test)
    2. **Adding Commands** -- create `commands/<name>.md` with required YAML frontmatter (`description`, `disable-model-invocation: true`, `argument-hint`), register in README.md commands table, follow step-numbered workflow pattern
    3. **Adding Skills** -- create `skills/<name>/SKILL.md` with frontmatter (`name`, `description`), add TOKEN BUDGET comment, use kebab-case naming, note the hardcoded skill list in `scripts/state-read.sh` that must be updated (Issue #16), follow the consistent header block: frontmatter -> blank line -> TOKEN BUDGET comment -> blank line -> `# Title` -> blank line -> Overview/Triggers
    4. **Adding Agents** -- create `agents/<name>.md` with frontmatter (`name`, `description` with examples, `model`), model values: `opus`/`sonnet`/`haiku`/`inherit`, register in README.md agents table
    5. **Running Tests** -- `npm test` or `bash test/run.sh`, bats-core framework, test files in `test/` with `.bats` extension, shared helpers in `test/test_helper.bash`
    6. **PR Requirements** -- all tests pass (`npm test`), `shellcheck --severity=warning scripts/*.sh` passes, no duplicated content across docs, conventional commit messages (reference `docs/PROTOCOLS.md`)
    7. **Markdown Style Guide** -- `#` for doc title / `##` for major sections / `###` for subsections, YAML frontmatter required in commands/skills/agents, kebab-case file/dir names, pipe-delimited tables, triple-backtick code blocks with language hints, TOKEN BUDGET comments are advisory (Issue #19)

    Do NOT include installation instructions (reference README.md instead). Do NOT duplicate config defaults.
  </action>
  <verify>test -f /Users/lgbarn/Personal/shipyard/CONTRIBUTING.md && grep -q "Adding Commands" /Users/lgbarn/Personal/shipyard/CONTRIBUTING.md && grep -q "Adding Skills" /Users/lgbarn/Personal/shipyard/CONTRIBUTING.md && grep -q "Adding Agents" /Users/lgbarn/Personal/shipyard/CONTRIBUTING.md && grep -q "Running Tests" /Users/lgbarn/Personal/shipyard/CONTRIBUTING.md && grep -q "PR" /Users/lgbarn/Personal/shipyard/CONTRIBUTING.md && grep -q "Style Guide" /Users/lgbarn/Personal/shipyard/CONTRIBUTING.md && echo "PASS" || echo "FAIL"</verify>
  <done>CONTRIBUTING.md exists with all 7 required sections. No installation instructions duplicated from README.md.</done>
</task>

<task id="2" files="README.md" tdd="false">
  <action>
    Update `README.md` with these changes:

    1. **Skill count**: Change "14 skills" to "15 skills" on line 74 ("Shipyard includes 14 skills...")
    2. **Skill table**: Add a row for `lessons-learned` skill: `| \`lessons-learned\` | After phase completion, before shipping, reflecting on work |`
    3. **Plugin structure**: Add `lessons-learned/` to the skills tree listing (after `infrastructure-validation/`)
    4. **Feature comparison table** (line 248): Update version from `v1.2.0` to `v2.0.0` in the header row
    5. **Feature comparison** (line 284): Change "14 skills" to "15 skills" in the Skills row
    6. **Feature comparison** (line 296): Change "14" to "15" in the Scale/Skills row
    7. **Model Routing Defaults** (lines 230-244): Replace the entire JSON code block and its `### Model Routing Defaults` heading with a single line: `See \`docs/PROTOCOLS.md\` for model routing configuration and the full config.json skeleton.`
    8. **Contributing section**: Add a new `## Contributing` section before the `## License` section with text: `See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add commands, skills, and agents, run tests, and submit pull requests.`
  </action>
  <verify>grep -q "15 skills" /Users/lgbarn/Personal/shipyard/README.md && grep -q "lessons-learned" /Users/lgbarn/Personal/shipyard/README.md && grep -q "CONTRIBUTING.md" /Users/lgbarn/Personal/shipyard/README.md && ! grep -q "model_routing" /Users/lgbarn/Personal/shipyard/README.md && echo "PASS" || echo "FAIL"</verify>
  <done>README.md references CONTRIBUTING.md, shows 15 skills, includes lessons-learned, and the Model Routing JSON block is replaced with a PROTOCOLS.md reference.</done>
</task>

<task id="3" files="CONTRIBUTING.md,README.md" tdd="false">
  <action>
    Cross-reference verification: confirm no duplicated setup/install content between CONTRIBUTING.md and README.md.

    1. Verify CONTRIBUTING.md does NOT contain `plugin marketplace add`, `plugin install`, or `git clone` (install instructions belong in README.md only)
    2. Verify CONTRIBUTING.md does NOT contain a full config.json skeleton or model routing defaults
    3. Verify README.md Contributing section points to CONTRIBUTING.md without inlining contributor details
  </action>
  <verify>grep -c "plugin marketplace add\|plugin install\|git clone" /Users/lgbarn/Personal/shipyard/CONTRIBUTING.md | xargs test 0 -eq && echo "PASS: no install duplication" || echo "FAIL: duplication found"</verify>
  <done>Zero duplicated install/setup instructions between CONTRIBUTING.md and README.md.</done>
</task>
