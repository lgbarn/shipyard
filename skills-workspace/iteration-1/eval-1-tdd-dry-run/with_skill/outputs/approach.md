# TDD Approach: --dry-run flag for state-write.sh

## Constraint

No production code is written first. The Iron Law applies: no production code
without a failing test first. The implementation of `--dry-run` does not exist
yet, so the first step is always a test.

---

## Step 1: Write the first failing test (RED)

Open `/Users/lgbarn/Personal/shipyard/test/state-write.bats` and add one
minimal test at the end of the file, tagged `unit`:

```bash
# bats test_tags=unit
@test "state-write: --dry-run prints JSON without writing STATE.json" {
    setup_shipyard_dir
    run bash "$STATE_WRITE" --phase 2 --position "Building plan 1" --status in_progress --dry-run
    assert_success
    assert_output --partial '"phase"'
    assert_output --partial '"status"'
    [ ! -f .shipyard/STATE.json ]
}
```

**Why this specific test?**

It captures the entire observable contract of --dry-run in a single assertion
sequence:

1. The command exits 0 (success, not an error).
2. stdout contains the JSON that *would* be written (spot-check two key fields).
3. STATE.json is *not* created on disk.

"and" does not appear in the test name, so it is describing one behavior
(dry-run mode), not multiple behaviors. The three assertions together define
that one behavior; they are not separate features.

---

## Step 2: Verify the test fails for the right reason (Verify RED)

```bash
cd /Users/lgbarn/Personal/shipyard
npx bats test/state-write.bats --filter "dry-run prints JSON without writing"
```

Expected failure: the script does not recognize `--dry-run` and exits via the
`Unknown argument` branch with exit code 1. The `assert_success` assertion will
fail with something like:

```
expected exit code 0, got 1
output: Unknown argument: --dry-run
```

This is the correct failure. It fails because the feature is absent, not
because of a typo or test error. If the test passes here, stop — something is
wrong with the test or a `--dry-run` handler already exists.

---

## Step 3: Write minimal implementation (GREEN)

Only now open `/Users/lgbarn/Personal/shipyard/scripts/state-write.sh`.

**Change 1 — Add `DRY_RUN` variable near the other flag defaults (around line 153):**

```bash
DRY_RUN=false
```

**Change 2 — Add a `--dry-run` case to the argument parser (around line 187, inside the `while` loop):**

```bash
        --dry-run)
            DRY_RUN=true
            shift
            ;;
```

**Change 3 — In the structured-write branch (around line 290-303), wrap the
write side-effects in a conditional:**

```bash
    if [ "$DRY_RUN" = true ]; then
        echo "$NEW_CONTENT"
    else
        cp "$STATE_FILE" "${STATE_FILE}.bak" 2>/dev/null || true
        atomic_write "$NEW_CONTENT" "$STATE_FILE"
        shasum -a 256 "$STATE_FILE" | cut -d' ' -f1 > "${STATE_FILE}.sha256"
        append_history "Phase ${PHASE:-?}: ${POSITION:-updated} (${STATUS:-unknown})"
        echo "STATE.json updated at ${TIMESTAMP}: Phase=${PHASE:-?} Position=${POSITION:-?} Status=${STATUS:-?}"
        if [ "$STATUS" = "complete" ] || [ "$STATUS" = "complete_with_gaps" ]; then
            rm -f ".shipyard/NOTES.md"
        fi
    fi
```

Nothing else changes. No new abstractions, no refactoring other code.

---

## Step 4: Verify the test passes (Verify GREEN)

```bash
npx bats test/state-write.bats --filter "dry-run prints JSON without writing"
```

Expected: `ok - state-write: --dry-run prints JSON without writing STATE.json`

Then run the full suite to ensure no regressions:

```bash
npx bats test/state-write.bats
```

All previously passing tests must still pass. If any break, fix the
implementation (not the tests) before proceeding.

---

## Step 5: Write additional failing tests (repeat RED) before adding more behavior

Before adding --dry-run support to `--raw` mode or `--recover` mode, write a
failing test for each additional behavior first, then implement minimally.

Examples of next tests (each written before its implementation):

**--raw + --dry-run:**
```bash
# bats test_tags=unit
@test "state-write: --dry-run with --raw prints content without writing" {
    setup_shipyard_dir
    local raw='{"schema":3,"phase":1,"position":"Custom","status":"ready","updated_at":"2026-01-01T00:00:00Z","blocker":null}'
    run bash "$STATE_WRITE" --raw "$raw" --dry-run
    assert_success
    assert_output --partial '"position"'
    [ ! -f .shipyard/STATE.json ]
}
```

---

## Step 6: Refactor (REFACTOR)

After all tests are green, review for duplication or clarity improvements:

- Does `DRY_RUN` logic appear in multiple code paths? Consider extracting a
  `maybe_write()` helper.
- Are variable names clear?
- No new behavior is added during refactor.

After every refactor step, re-run the full suite to confirm all tests remain
green.

---

## Summary of Order

1. Write the test in `test/state-write.bats` — do not touch `state-write.sh`
2. Run the test, confirm it fails with "Unknown argument: --dry-run" (exit 1)
3. Implement `--dry-run` in `state-write.sh` (three small changes)
4. Run the test, confirm it passes
5. Run full suite, confirm no regressions
6. Repeat from step 1 for each additional --dry-run code path (--raw, --recover)
7. Refactor once all paths are green

The first step is always the test. Never implementation first.
