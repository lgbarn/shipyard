# Shipyard Issues

## Open Issues

| ID | Severity | Source | Description | File | Date |
|----|----------|--------|-------------|------|------|
| 1 | medium | reviewer | Fragile jq validation pattern using `$?` after pipeline -- should use `run jq` + `assert_success` instead | test/state-read.bats:13-14,90-91 | 2026-02-01 |
| 2 | medium | reviewer | Test 5 (planning tier) does not defensively create `.shipyard/phases/` unlike other tests | test/state-read.bats:60-78 | 2026-02-01 |
| 3 | medium | reviewer | Minimal tier test does not assert PROJECT.md/ROADMAP.md are excluded from output | test/state-read.bats:34-43 | 2026-02-01 |
| 4 | medium | builder | `state-read.sh` line 74: `find .shipyard/phases/` fails under `set -e` when directory missing | scripts/state-read.sh:74 | 2026-02-01 |
| 5 | low | reviewer | Extract jq validation into shared `assert_valid_json()` helper to reduce duplication | test/test_helper.bash | 2026-02-01 |
| 6 | low | reviewer | Test 3 naming should include "tier" for consistency with other tier tests | test/state-read.bats:34 | 2026-02-01 |

## Closed Issues

| ID | Severity | Source | Description | Resolution | Date |
|----|----------|--------|-------------|------------|------|
