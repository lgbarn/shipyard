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

## Closed Issues

| ID | Severity | Source | Description | Resolution | Date |
|----|----------|--------|-------------|------------|------|
| 1 | medium | reviewer | Fragile jq validation pattern using `$?` after pipeline -- should use `run jq` + `assert_success` instead | Fixed in Plan 1.2: replaced with `assert_valid_json` helper | 2026-02-01 |
| 2 | medium | reviewer | Test 5 (planning tier) does not defensively create `.shipyard/phases/` unlike other tests | Fixed in Plan 1.2: added `mkdir -p .shipyard/phases` | 2026-02-01 |
| 3 | medium | reviewer | Minimal tier test does not assert PROJECT.md/ROADMAP.md are excluded from output | Fixed in Plan 1.2: added `refute_output` assertions | 2026-02-01 |
| 4 | medium | builder | `state-read.sh` line 74: `find .shipyard/phases/` fails under `set -e` when directory missing | Fixed in Plan 1.2: wrapped in `[ -d ".shipyard/phases" ]` guard | 2026-02-01 |
| 5 | low | reviewer | Extract jq validation into shared `assert_valid_json()` helper to reduce duplication | Fixed in Plan 1.2: added to test_helper.bash | 2026-02-01 |
| 6 | low | reviewer | Test 3 naming should include "tier" for consistency with other tier tests | Fixed in Plan 1.2: renamed to include "tier" | 2026-02-01 |
