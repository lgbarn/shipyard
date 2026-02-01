# Shipyard Issues

## Open Issues

| ID | Severity | Source | Description | File | Date |
|----|----------|--------|-------------|------|------|
| 7 | low | reviewer | `git diff-index` does not detect untracked files in dirty worktree check; consider adding `git ls-files --others` | scripts/checkpoint.sh:61 | 2026-02-01 |
| 8 | low | reviewer | Exit code 3 is documented but never emitted; add inline comment or implement not-a-repo vs other-error distinction | scripts/checkpoint.sh:17,53-56 | 2026-02-01 |
| 9 | medium | reviewer | Trap collision risk: atomic_write overwrites EXIT trap on each call, unsafe if called twice per execution | scripts/state-write.sh:40,58 | 2026-02-01 |
| 10 | medium | reviewer | Recovery find pipeline fragile: directory names starting with digit but non-numeric (e.g. 3-archive) would match | scripts/state-write.sh:127-128 | 2026-02-01 |
| 11 | medium | reviewer | Recovery loop uses echo instead of printf for tag names; unsafe if tag starts with dash | scripts/state-write.sh:155-156 | 2026-02-01 |
| 12 | low | reviewer | Raw writes bypass Schema 2.0 enforcement by design but this is undocumented | scripts/state-write.sh:180-184 | 2026-02-01 |
| 13 | low | reviewer | Recovery test assertion for "recovered" is imprecise; could match position or history | test/state-write.bats:112 | 2026-02-01 |
| 14 | low | reviewer | No test for atomic_write failure paths (mktemp failure exit 3, empty content exit 2) | test/state-write.bats | 2026-02-01 |
| 15 | low | reviewer | Heredoc `read || true` pattern lacks explanatory comment; may confuse future maintainers | scripts/state-read.sh:25 | 2026-02-01 |
| 16 | low | reviewer | Hardcoded skill list in state-read.sh has no automated sync check against skills/ directory | scripts/state-read.sh:29-43 | 2026-02-01 |
| 28 | low | reviewer | builder.md line 78 capitalizes "Follow" mid-sentence after comma; grammatically inconsistent with line 82 which starts a sentence | agents/builder.md:78 | 2026-02-01 |
| 19 | low | reviewer | TOKEN BUDGET comments in SKILL.md files are advisory only; no CI gate or lint script enforces them | skills/*/SKILL.md | 2026-02-01 |
| 20 | low | reviewer | init.md repeats config default values also present in PROTOCOLS.md Model Routing section; dual-maintenance risk | commands/init.md:100-104 | 2026-02-01 |
| 21 | low | reviewer | Model Routing Protocol contains full config.json skeleton (44 lines) only relevant to init; consider splitting or annotating | docs/PROTOCOLS.md:37-62 | 2026-02-01 |
| 23 | low | reviewer | No test for 5-lesson maximum cap; a test with 7 lessons asserting only last 5 appear would strengthen boundary coverage | test/state-read.bats | 2026-02-01 |
| 24 | low | reviewer | Magic number 8 in sed extraction window lacks inline comment explaining why 8 lines | scripts/state-read.sh:172 | 2026-02-01 |
| 25 | low | reviewer | Issue #16 link in CONTRIBUTING.md may go stale; add inline file/line context as fallback | CONTRIBUTING.md:61 | 2026-02-01 |
| 26 | low | reviewer | No mention of docs/ directory conventions in CONTRIBUTING.md | CONTRIBUTING.md | 2026-02-01 |
| 27 | low | reviewer | lessons-learned/ breaks alphabetical order in Plugin Structure tree; placed after shipyard-writing-skills/ instead of after infrastructure-validation/ | README.md:212 | 2026-02-01 |

## Closed Issues

| ID | Severity | Source | Description | Resolution | Date |
|----|----------|--------|-------------|------------|------|
| 1 | medium | reviewer | Fragile jq validation pattern using `$?` after pipeline -- should use `run jq` + `assert_success` instead | Fixed in Plan 1.2: replaced with `assert_valid_json` helper | 2026-02-01 |
| 2 | medium | reviewer | Test 5 (planning tier) does not defensively create `.shipyard/phases/` unlike other tests | Fixed in Plan 1.2: added `mkdir -p .shipyard/phases` | 2026-02-01 |
| 3 | medium | reviewer | Minimal tier test does not assert PROJECT.md/ROADMAP.md are excluded from output | Fixed in Plan 1.2: added `refute_output` assertions | 2026-02-01 |
| 4 | medium | builder | `state-read.sh` line 74: `find .shipyard/phases/` fails under `set -e` when directory missing | Fixed in Plan 1.2: wrapped in `[ -d ".shipyard/phases" ]` guard | 2026-02-01 |
| 5 | low | reviewer | Extract jq validation into shared `assert_valid_json()` helper to reduce duplication | Fixed in Plan 1.2: added to test_helper.bash | 2026-02-01 |
| 6 | low | reviewer | Test 3 naming should include "tier" for consistency with other tier tests | Fixed in Plan 1.2: renamed to include "tier" | 2026-02-01 |
| 17 | low | reviewer | Discovery Workflow numbered list skips from 1 to 3 (missing step 2) | Fixed in Phase 6 / Plan 1.3: renumbered steps 1-5 | 2026-02-01 |
| 18 | low | reviewer | Red Flags section uses ## instead of ### creating incorrect heading hierarchy in EXAMPLES.md | Fixed in Phase 6 / Plan 1.3: changed to ### | 2026-02-01 |
| 22 | low | reviewer | Minor protocol reference format inconsistency: lowercase "follow" and missing trailing description in builder.md IaC line | Fixed in Phase 6 / Plan 1.3: capitalized and added trailing description | 2026-02-01 |
