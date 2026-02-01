# REVIEW: Plan 1.1 -- CONTRIBUTING.md and README.md Cleanup

**Reviewer verdict: PASS**

---

## Stage 1: Spec Compliance

**Verdict:** PASS

### Task 1: Create CONTRIBUTING.md

- **Status:** PASS
- All 7 required sections are present and correctly structured:
  1. **Prerequisites** (line 7): References README.md for installation, lists bash >= 4.0, jq >= 1.6, git >= 2.20, node >= 16.
  2. **Adding Commands** (line 17): Covers `commands/<name>.md`, YAML frontmatter (`description`, `disable-model-invocation`, `argument-hint`), step-numbered workflow, README table registration.
  3. **Adding Skills** (line 34): Covers directory creation, SKILL.md template with correct header block order (frontmatter -> TOKEN BUDGET -> Title -> Overview/Triggers), kebab-case naming, `state-read.sh` hardcoded list note with Issue #16 reference.
  4. **Adding Agents** (line 64): Covers frontmatter (`name`, `description` with examples, `model`), valid model values (`opus`/`sonnet`/`haiku`/`inherit`), README table.
  5. **Running Tests** (line 84): Covers `npm test`, `bash test/run.sh`, bats-core, `.bats` extension, `test_helper.bash`.
  6. **PR Requirements** (line 98): Covers tests, shellcheck, no duplication, conventional commits with `docs/PROTOCOLS.md` reference.
  7. **Markdown Style Guide** (line 107): Covers heading levels, frontmatter, kebab-case, pipe tables, code blocks with language hints, TOKEN BUDGET advisory with Issue #19 reference.
- No installation instructions duplicated from README.md. Confirmed zero matches for `plugin marketplace add`, `plugin install`, or `git clone`.
- No config.json skeleton or model routing defaults present.

### Task 2: Update README.md

- **Status:** PASS
- All 8 required changes verified:
  1. **Skill count** (line 74): "15 skills" -- correct.
  2. **Skill table** (line 92): `lessons-learned` row present with correct description.
  3. **Plugin structure** (line 212): `lessons-learned/` added to skills tree.
  4. **Feature comparison header** (line 236): Shows `v2.0.0` -- correct.
  5. **Feature comparison Skills row** (line 272): "15 skills" -- correct.
  6. **Feature comparison Scale/Skills row** (line 284): "15" -- correct.
  7. **Model Routing Defaults**: The `### Model Routing Defaults` heading and JSON code block are fully removed. No match for "Model Routing Defaults" anywhere in README.md. The `model_routing` string appears only in the Configuration table (line 229) which is legitimate -- it names the config option and now says `see docs/PROTOCOLS.md` instead of duplicating defaults. The replacement reference line appears at line 232.
  8. **Contributing section** (line 294-296): `## Contributing` section present before `## License`, with correct link text pointing to `CONTRIBUTING.md`.

### Task 3: Cross-reference verification

- **Status:** PASS
- CONTRIBUTING.md contains zero install-related strings (verified via grep).
- CONTRIBUTING.md contains no config.json skeleton or model routing defaults.
- README.md Contributing section is a single-line pointer to CONTRIBUTING.md without inlining contributor details.

### Noted Deviation (Acceptable)

The plan's verify command for Task 2 included `! grep -q "model_routing"` which would fail because the Configuration table legitimately names `model_routing` as a config key. The builder correctly identified this as an overly strict check and documented the decision in SUMMARY-1.1.md. The actual goal -- removing the JSON code block and `### Model Routing Defaults` heading -- was achieved. The table entry was improved to reference `docs/PROTOCOLS.md` instead of duplicating defaults. This is the correct interpretation of the plan's intent.

---

## Stage 2: Code Quality

### Critical

None.

### Important

None.

### Suggestions

1. **CONTRIBUTING.md line 61: Issue #16 link may go stale**
   - The link `https://github.com/lgbarn/shipyard/issues/16` is hardcoded. If the issue is closed or renumbered, the reference becomes misleading. Consider also noting the specific file and line range inline so the guidance survives even if the issue link breaks.
   - Remediation: Add parenthetical context, e.g., "Update the hardcoded skill list in `scripts/state-read.sh` (around line 29-43; tracked in Issue #16)."

2. **CONTRIBUTING.md: No mention of `docs/` directory conventions**
   - The guide covers commands, skills, and agents but does not mention how to add or update files in the `docs/` directory (e.g., PROTOCOLS.md). This is minor since `docs/` changes are less frequent, but a one-line note would help completeness.
   - Remediation: Consider adding a brief note under a subsection or in the Style Guide about documentation files in `docs/`.

3. **README.md line 212: `lessons-learned/` breaks alphabetical order in tree**
   - The skills tree listing is mostly alphabetical but `lessons-learned/` appears after `shipyard-writing-skills/` and before `using-shipyard/`. Alphabetically it should appear after `infrastructure-validation/` and before `parallel-dispatch/`. The builder noted this was a deliberate placement choice to keep `using-shipyard/` last, which is a reasonable aesthetic decision, but it creates an inconsistency with the otherwise-alphabetical ordering.
   - Remediation: Either move `lessons-learned/` to its alphabetical position (between `infrastructure-validation/` and `parallel-dispatch/`) or add a comment noting the ordering convention.

---

## Summary

**Recommendation: APPROVE**

All three tasks are fully implemented as specified. CONTRIBUTING.md is well-structured with all 7 required sections, clear examples, and appropriate cross-references. README.md updates are complete: skill count is 15, `lessons-learned` is in both the table and tree, the Model Routing JSON block is removed and replaced with a PROTOCOLS.md reference, version is v2.0.0, and the Contributing section correctly points to CONTRIBUTING.md. No duplication was introduced between the two files. The only findings are low-severity suggestions around link durability, missing docs/ conventions, and tree ordering -- none of which block the merge.
