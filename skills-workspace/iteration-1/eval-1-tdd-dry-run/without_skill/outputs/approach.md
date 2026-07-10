# Approach: Adding --dry-run to state-write.sh

## First Step: Read the Existing Test File

Before touching any code, I read `test/state-write.bats` and `scripts/state-write.sh` to understand:

- How tests are structured (BATS, `run bash "$STATE_WRITE" ...`, `assert_success`, `assert_output --partial`)
- What the existing argument parser looks like (the `while [[ $# -gt 0 ]]; do case "$1" in` block)
- Where writes actually happen (three places: recovery mode, `--raw`, and structured write)
- The pattern for output messages (e.g., `"STATE.json updated at ${TIMESTAMP}"`)

## Do I Write a Test or Implementation First?

Test first. This is the TDD discipline: write a failing test that specifies the exact behavior, then write the minimum implementation to make it pass.

## Specific Tests I Would Write

I add these cases to `test/state-write.bats`:

```bash
# bats test_tags=unit
@test "state-write: --dry-run prints would-write content without writing STATE.json" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --phase 2 --position "Building plan 1" --status in_progress --dry-run
    assert_success
    assert_output --partial '"phase"'
    assert_output --partial '"status"'
    assert_output --partial "in_progress"
    [ ! -f .shipyard/STATE.json ]
}

# bats test_tags=unit
@test "state-write: --dry-run with --raw prints content without writing" {
    setup_shipyard_dir
    local raw='{"schema":3,"phase":1,"position":"Custom","status":"ready","updated_at":"2026-01-01T00:00:00Z","blocker":null}'
    run bash "$STATE_WRITE" --raw "$raw" --dry-run
    assert_success
    assert_output --partial '"position"'
    assert_output --partial "Custom"
    [ ! -f .shipyard/STATE.json ]
}

# bats test_tags=unit
@test "state-write: --dry-run does not write HISTORY.md" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --phase 1 --position "test" --status ready --dry-run
    assert_success
    [ ! -f .shipyard/HISTORY.md ]
}

# bats test_tags=unit
@test "state-write: --dry-run does not create .bak or .sha256 files" {
    setup_shipyard_dir
    bash "$STATE_WRITE" --phase 1 --position "First" --status ready
    run bash "$STATE_WRITE" --phase 2 --position "Second" --status building --dry-run
    assert_success
    # .bak would only exist if an actual write happened
    [ ! -f .shipyard/STATE.json.bak ] || \
        [ "$(jq -r '.phase' .shipyard/STATE.json.bak)" = "1" ]  # still the old bak
    # STATE.json still contains phase 1, not phase 2
    assert_json_field "phase" "1"
}
```

The key behavioral assertions are:
1. Exit 0 (success)
2. Stdout contains the JSON that WOULD have been written
3. `STATE.json` is NOT created/modified
4. `HISTORY.md` is NOT appended to
5. No `.bak` or `.sha256` side effects

## How I Verify the Tests Fail

```bash
cd /Users/lgbarn/Personal/shipyard
npm test -- --filter "dry-run"
# or directly:
./node_modules/.bin/bats test/state-write.bats --filter "dry-run"
```

Expected result: all four new tests fail because `state-write.sh` does not yet recognize `--dry-run` — it will hit the `*) echo "Unknown argument: $1" >&2; exit 1` branch and exit with failure. The "file should not exist" assertions would also fail if the script had partially written before hitting the unknown argument. This confirms the tests are genuinely failing for the right reason.

## Then What? — The Implementation

After confirming red, I implement in `scripts/state-write.sh` with surgical, minimal changes:

**Step 1 — Add `DRY_RUN` variable near the other argument variables (around line 148):**

```bash
DRY_RUN=false
```

**Step 2 — Add the `--dry-run` case to the argument parser (inside the existing `while` loop):**

```bash
        --dry-run)
            DRY_RUN=true
            shift
            ;;
```

**Step 3 — Guard the three write sites with `if [ "$DRY_RUN" = false ]`.**

The three write sites are:

a) Recovery mode (around line 262):
```bash
    if [ "$DRY_RUN" = true ]; then
        echo "[dry-run] Would write STATE.json:"
        echo "$NEW_CONTENT"
        exit 0
    fi
    cp "$STATE_FILE" "${STATE_FILE}.bak" 2>/dev/null || true
    atomic_write "$NEW_CONTENT" "$STATE_FILE"
    shasum -a 256 "$STATE_FILE" | cut -d' ' -f1 > "${STATE_FILE}.sha256"
    append_history "State recovered from .shipyard/ artifacts"
    ...
```

b) Raw write (around line 282):
```bash
    if [ "$DRY_RUN" = true ]; then
        echo "[dry-run] Would write STATE.json:"
        echo "$RAW_CONTENT"
        exit 0
    fi
    cp "$STATE_FILE" "${STATE_FILE}.bak" 2>/dev/null || true
    atomic_write "$RAW_CONTENT" "$STATE_FILE"
    ...
```

c) Structured write (around line 299):
```bash
    # Build NEW_CONTENT via jq -n as before, then:
    if [ "$DRY_RUN" = true ]; then
        echo "[dry-run] Would write STATE.json:"
        echo "$NEW_CONTENT"
        exit 0
    fi
    cp "$STATE_FILE" "${STATE_FILE}.bak" 2>/dev/null || true
    atomic_write "$NEW_CONTENT" "$STATE_FILE"
    ...
```

The dry-run path: builds the JSON (so jq validation still catches bad inputs), prints it, and exits 0 without touching any file on disk.

## Verify the Fix

Run the tests again:

```bash
./node_modules/.bin/bats test/state-write.bats --filter "dry-run"
```

All four new tests should now pass (green). Then run the full suite to confirm no regressions:

```bash
npm test
```

108 existing tests + 4 new tests should all pass.

## Why This Order?

Writing the tests first forces precise thinking about the contract before touching implementation details. The tests document the behavior (no files written, specific stdout, exit 0) in a way that is executable and verifiable. The implementation then becomes a straightforward matter of plumbing the `DRY_RUN` flag through to the three write sites — with the tests acting as a safety net against regressions at every other write path.
