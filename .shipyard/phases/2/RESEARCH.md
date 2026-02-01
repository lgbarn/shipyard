# Phase 2 Research: Testing Foundation

**Date:** 2026-02-01
**Goal:** Establish bats-core test suite covering all 3 scripts, plus a CI-ready runner.

---

## 1. Script Interfaces

### 1.1 `scripts/state-read.sh`

**Purpose:** SessionStart hook. Reads `.shipyard/STATE.md`, `config.json`, and project files to build adaptive context JSON for Claude Code.

| Aspect | Details |
|---|---|
| **Inputs** | Filesystem: `.shipyard/STATE.md`, `.shipyard/config.json`, `.shipyard/PROJECT.md`, `.shipyard/ROADMAP.md`, `.shipyard/ISSUES.md`, `.shipyard/codebase/*.md`, phase plan/result files. Also reads `skills/using-shipyard/SKILL.md` relative to plugin root. |
| **Arguments** | None (no CLI arguments) |
| **Output** | JSON to stdout: `{ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: <string> } }` |
| **Exit codes** | Always exits 0 |
| **Dependencies** | `jq`, `sed`, `head`, `find`, `grep`, `cat` |
| **Key behaviors** | 1. Detects `.shipyard/` presence. 2. Reads `config.json` for `context_tier` (auto/minimal/planning/execution/brownfield/full). 3. Auto-detects tier from status if `auto`. 4. Loads tiered context (STATE always, PROJECT/ROADMAP at planning+, phase plans at execution+, codebase docs at full). 5. Generates command suggestions based on status. 6. Wraps all context in JSON via `jq`. |
| **Error conditions** | Missing `.shipyard/` -> outputs "No Shipyard Project Detected" context (still exits 0). Invalid `context_tier` in config -> falls back to `auto`. Non-integer phase -> treated as empty. |

**Context tiers and what they load:**

| Tier | STATE.md | PROJECT.md + ROADMAP.md | Phase plans/summaries | Codebase docs |
|---|---|---|---|---|
| minimal | Yes | No | No | No |
| planning | Yes | Yes | No | No |
| execution | Yes | Yes | Yes | No |
| full | Yes | Yes | Yes | Yes |
| brownfield | (not distinct from full in code) | Yes | Yes | Yes |

**Auto-detection mapping:**

| Status | Auto tier |
|---|---|
| `building`, `in_progress` | execution |
| `planning`, `planned`, `ready`, `shipped`, `complete`, empty | planning |
| anything else | planning |

### 1.2 `scripts/state-write.sh`

**Purpose:** Updates `.shipyard/STATE.md` with structured fields or raw content.

| Aspect | Details |
|---|---|
| **Arguments** | `--phase <N>` (integer), `--position <desc>`, `--status <status>`, `--blocker <desc>`, `--raw <content>` |
| **Output** | Confirmation message to stdout |
| **Exit codes** | `0` = success, `1` = error |
| **Dependencies** | `date`, `printf`, `sed`, `grep`, `cat` |

**Exit code 1 conditions:**
- `.shipyard/` directory does not exist
- `--phase` is not a positive integer
- `--status` is not in allowed set
- Unknown argument passed
- No update flags provided at all

**Valid status values:** `ready`, `planned`, `planning`, `building`, `in_progress`, `complete`, `complete_with_gaps`, `shipped`, `blocked`, `paused`

**Behavior modes:**
1. **Raw write** (`--raw`): Overwrites STATE.md entirely with provided content.
2. **Structured write**: Builds STATE.md with header fields, optional blocker section, preserved history section, and appended history entry.
3. **No args**: Error exit.

### 1.3 `scripts/checkpoint.sh`

**Purpose:** Creates and prunes git tags for rollback points.

| Aspect | Details |
|---|---|
| **Arguments** | `<label>` (positional) OR `--prune [days]` |
| **Output** | Confirmation message to stdout |
| **Exit codes** | `0` = success (including git failures, which are warnings), `1` = error |
| **Dependencies** | `git`, `date`, `tr`, `grep` |

**Exit code 1 conditions:**
- `--prune` argument is not a positive integer
- Label sanitizes to empty string (no alphanumeric/dot/underscore/hyphen chars)

**Key behaviors:**
- **Create mode**: Sanitizes label via `tr -cd 'a-zA-Z0-9._-'`, strips leading hyphens, truncates to 64 chars, creates annotated tag `shipyard-checkpoint-<label>-<timestamp>`.
- **Prune mode**: Lists `shipyard-checkpoint-*` tags, extracts embedded timestamp, deletes tags older than N days.
- Git failure on create is a warning (exits 0), not an error.
- Uses macOS `date -v` with fallback to GNU `date -d` for date arithmetic.

---

## 2. bats-core Availability and Installation

### Current State

bats-core is **not installed** on this system. It is available via:

| Method | Version | Command | Adds runtime dep? |
|---|---|---|---|
| npm devDependency | 1.13.0 | `npm install --save-dev bats` | No (devDep only) |
| Homebrew | 1.13.0 | `brew install bats-core` | No (system-level) |
| Git submodule | latest | `git submodule add ...` | No |

### Recommended: npm devDependency

**Justification:**
1. The project already has a `package.json` (it is an npm package `@lgbarn/shipyard`).
2. `npm install --save-dev bats` adds zero runtime overhead -- it is excluded from the `files` array.
3. CI runners can install with `npm ci` without extra steps.
4. No git submodule complexity (submodule init/update steps, `.gitmodules` file).
5. Version pinning via `package-lock.json` gives reproducible test runs.

**Helper libraries** should also be npm devDependencies:
- `bats-support` (required by bats-assert)
- `bats-assert` (provides `assert_success`, `assert_failure`, `assert_output`, `assert_line`, `refute_output`)
- `bats-file` (provides `assert_file_exist`, `assert_dir_exist`, etc.)

Install commands:
```bash
npm install --save-dev bats bats-support bats-assert bats-file
```

**Why not the alternatives:**
- **Homebrew**: Not available on Linux CI runners by default; requires separate install step.
- **Git submodules**: Adds friction for contributors (`git submodule update --init`); overkill when npm is already present.

### References

- [bats-core GitHub](https://github.com/bats-core/bats-core)
- [bats-core Installation docs](https://bats-core.readthedocs.io/en/stable/installation.html)
- [bats-core Writing Tests](https://bats-core.readthedocs.io/en/stable/writing-tests.html)
- [bats-core Tutorial](https://bats-core.readthedocs.io/en/stable/tutorial.html)
- [bats npm package](https://www.npmjs.com/package/bats)

---

## 3. Test Fixture Strategy

### 3.1 Temporary Directories

bats-core provides `$BATS_TEST_TMPDIR` (unique per test) and `$BATS_TMPDIR` (shared). The strategy:

```bash
setup() {
    # Create isolated test workspace
    TEST_WORKSPACE="$(mktemp -d "$BATS_TEST_TMPDIR/workspace-XXXXXX")"
    mkdir -p "$TEST_WORKSPACE/.shipyard"
    cd "$TEST_WORKSPACE"
}

teardown() {
    # BATS_TEST_TMPDIR is auto-cleaned; explicit cleanup not required
    cd "$BATS_SUITE_TMPDIR"  # Avoid stale cwd
}
```

### 3.2 Git Repository Setup

`checkpoint.sh` requires a git repo with at least one commit. A reusable fixture:

```bash
setup_git_repo() {
    git init "$TEST_WORKSPACE"
    cd "$TEST_WORKSPACE"
    git config user.email "test@test.com"
    git config user.name "Test"
    echo "init" > README.md
    git add README.md
    git commit -m "Initial commit"
}
```

This creates a real, isolated git repo per test. No mocking needed for most checkpoint tests -- real `git tag` operations on a throwaway repo are fast and faithful.

### 3.3 Mock Strategy

| What to mock | Approach | Rationale |
|---|---|---|
| `git` in checkpoint.sh | **Do not mock** -- use real git repos in temp dirs | Real git operations are fast (<50ms) and avoid false confidence from mocks |
| `jq` in state-read.sh | **Do not mock** -- require jq as test dependency | jq is a hard dependency; mocking it would test nothing |
| `date -u` | **Mock only for timestamp-dependent assertions** | Use `export -f date` to return fixed timestamps when testing prune cutoff logic |
| Filesystem | **Real files in temp dirs** | Creating `.shipyard/STATE.md` etc. in `$BATS_TEST_TMPDIR` is trivial |
| `SKILL.md` reading | **Provide a stub file** | state-read.sh reads from `$PLUGIN_ROOT/skills/using-shipyard/SKILL.md`; create a minimal fixture |

### 3.4 Loading Helpers

```bash
# test/test_helper.bash
load "$(npm root)/bats-support/load"
load "$(npm root)/bats-assert/load"
load "$(npm root)/bats-file/load"

# Path to scripts under test
SCRIPTS_DIR="$(cd "$(dirname "$BATS_TEST_DIRNAME")/../scripts" && pwd)"
```

### 3.5 Platform Considerations

- `checkpoint.sh` uses `date -v` (macOS) with fallback to `date -d` (GNU/Linux). Tests must pass on both.
- CI will run on Ubuntu (GitHub Actions); local dev is macOS. Both need testing.
- `state-read.sh` uses `find` with `-maxdepth` which is POSIX-compatible.

---

## 4. Detailed Test Case List

### 4.1 `state-read.sh` Tests

#### Basic Operation
| # | Test Case | Inputs | Expected |
|---|---|---|---|
| R01 | No .shipyard directory | Empty workspace | JSON output with "No Shipyard Project Detected" |
| R02 | Empty .shipyard directory (no STATE.md) | `.shipyard/` exists, no STATE.md | JSON with "No Shipyard Project Detected" (falls through to else) |
| R03 | Valid STATE.md, no config.json | STATE.md with status + phase | JSON with state context, auto-detected tier |
| R04 | Valid JSON output structure | Any valid setup | Output parses as valid JSON via `jq` |

#### Context Tier Selection
| # | Test Case | Inputs | Expected |
|---|---|---|---|
| R05 | Explicit tier from config.json | `config.json` with `context_tier: "minimal"` | Only STATE.md loaded |
| R06 | Explicit tier "full" | `config.json` with `context_tier: "full"` | STATE + PROJECT + ROADMAP + phase + codebase |
| R07 | Invalid tier in config falls back to auto | `config.json` with `context_tier: "bogus"` | Behaves as auto |
| R08 | Auto tier with status "building" | STATE.md with `Status: building` | Tier = execution |
| R09 | Auto tier with status "planning" | STATE.md with `Status: planning` | Tier = planning |
| R10 | Auto tier with status "in_progress" | STATE.md with `Status: in_progress` | Tier = execution |
| R11 | Auto tier with empty status | STATE.md without Status line | Tier = planning |

#### Content Loading by Tier
| # | Test Case | Inputs | Expected |
|---|---|---|---|
| R12 | Minimal tier skips PROJECT.md | `context_tier: "minimal"`, PROJECT.md exists | Output does NOT contain PROJECT.md content |
| R13 | Planning tier loads PROJECT.md | `context_tier: "planning"`, PROJECT.md exists | Output contains PROJECT.md content |
| R14 | Planning tier loads ROADMAP.md (first 80 lines) | `context_tier: "planning"`, ROADMAP.md with 100 lines | Output contains first 80 lines only |
| R15 | Execution tier loads phase plans | Phase dir with PLAN-*.md files | Output contains plan content |
| R16 | Execution tier limits to 3 plans | Phase dir with 5 PLAN files | Only first 3 appear |
| R17 | Execution tier loads recent summaries (last 3) | Phase dir with 5 SUMMARY files | Only last 3 appear |
| R18 | Full tier loads codebase docs | `.shipyard/codebase/STACK.md` etc. | Output contains codebase snippets |

#### Command Suggestions
| # | Test Case | Inputs | Expected |
|---|---|---|---|
| R19 | Status "ready" suggests plan | `Status: ready` | Output contains `/shipyard:plan` |
| R20 | Status "planned" suggests build | `Status: planned` | Output contains `/shipyard:build` |
| R21 | Status "complete" with next phase | `Status: complete`, ROADMAP mentions next phase | Output contains plan next phase |
| R22 | Status "shipped" suggests init | `Status: shipped` | Output contains `/shipyard:init` |
| R23 | Issues file present | `.shipyard/ISSUES.md` with entries | Output contains issue count |

#### Edge Cases
| # | Test Case | Inputs | Expected |
|---|---|---|---|
| R24 | Non-integer phase in STATE.md | `Current Phase: abc` | Phase treated as empty |
| R25 | Missing SKILL.md | Plugin root without skill file | Output contains "not found" fallback |
| R26 | Malformed config.json | Invalid JSON in config.json | Falls back to `context_tier: auto` |

### 4.2 `state-write.sh` Tests

#### Structured Write
| # | Test Case | Inputs | Expected |
|---|---|---|---|
| W01 | Write phase + position + status | `--phase 2 --position "test" --status building` | STATE.md contains all three fields |
| W02 | Write phase only | `--phase 3` | STATE.md has phase, no position/status lines |
| W03 | Write with blocker | `--phase 1 --status blocked --blocker "API down"` | STATE.md has Blockers section |
| W04 | History section created on first write | No existing STATE.md | STATE.md has `## History` with entry |
| W05 | History section preserved on update | Existing STATE.md with history | Old history entries preserved, new entry appended |
| W06 | Timestamp in ISO 8601 format | Any structured write | `Last Updated` matches `YYYY-MM-DDTHH:MM:SSZ` |

#### Raw Write
| # | Test Case | Inputs | Expected |
|---|---|---|---|
| W07 | Raw write replaces entire file | `--raw "custom content"` | STATE.md contains exactly "custom content" |
| W08 | Raw write with multiline content | `--raw` with newlines | Content preserved verbatim |
| W09 | Raw write confirmation message | `--raw "test"` | stdout contains "raw write" |

#### Validation and Errors
| # | Test Case | Inputs | Expected |
|---|---|---|---|
| W10 | Missing .shipyard directory | No `.shipyard/` | Exit 1, stderr mentions `.shipyard/` |
| W11 | Non-integer phase | `--phase abc` | Exit 1, stderr mentions "positive integer" |
| W12 | Invalid status value | `--status invalid` | Exit 1, stderr lists valid values |
| W13 | Unknown argument | `--foo bar` | Exit 1, stderr mentions unknown arg |
| W14 | No arguments at all | (none) | Exit 1, stderr mentions "No updates provided" |
| W15 | Each valid status accepted | Loop over all 10 valid statuses | Each exits 0 |

### 4.3 `scripts/checkpoint.sh` Tests

#### Tag Creation
| # | Test Case | Inputs | Expected |
|---|---|---|---|
| C01 | Create checkpoint with label | `"pre-build"` | Tag `shipyard-checkpoint-pre-build-<ts>` exists |
| C02 | Default label "auto" | (no args) | Tag contains "auto" |
| C03 | Label sanitization (special chars stripped) | `"my label!@#$%"` | Tag contains `mylabel` (special chars removed) |
| C04 | Label truncation at 64 chars | 100-char label | Tag label portion is 64 chars |
| C05 | Leading hyphen stripped | `"-dangerous"` | Tag label starts with `d`, not `-` |
| C06 | Empty label after sanitization | `"!@#$%"` | Exit 1, error about alphanumeric |
| C07 | Annotated tag with message | Valid label | `git tag -n` shows "Shipyard checkpoint:" message |
| C08 | Tag format includes timestamp | Valid label | Tag matches `shipyard-checkpoint-*-YYYYMMDDTHHMMSSZ` |

#### Prune
| # | Test Case | Inputs | Expected |
|---|---|---|---|
| C09 | Prune with default 30 days | `--prune` with old tags | Old tags removed |
| C10 | Prune with custom days | `--prune 7` with tags of various ages | Only tags >7 days old removed |
| C11 | Prune keeps recent tags | `--prune 30` with recent tags | Recent tags preserved |
| C12 | Prune reports count | `--prune` | stdout contains pruned count |
| C13 | Prune with no matching tags | `--prune` in empty repo | Reports "Pruned 0" |
| C14 | Invalid prune argument | `--prune abc` | Exit 1, error about positive integer |

#### Error Handling
| # | Test Case | Inputs | Expected |
|---|---|---|---|
| C15 | Not a git repo | Valid label, no `.git` | Exit 0, stderr contains "Warning" |
| C16 | No commits in repo | `git init` only, no commits | Exit 0, stderr contains "Warning" |

### 4.4 Integration Tests

| # | Test Case | Description |
|---|---|---|
| I01 | Write then read round-trip | `state-write.sh --phase 2 --status building`, then `state-read.sh` produces JSON containing phase 2 |
| I02 | Multiple writes preserve history | Two structured writes, verify both entries in history |
| I03 | Checkpoint create then prune | Create tag, prune with 0 days, tag removed |
| I04 | Raw write then structured read | `--raw` custom STATE.md, then read extracts status |
| I05 | Full tier end-to-end | Set up complete `.shipyard/` tree, verify all tiers load correctly |

---

## 5. CI Runner Approach

### Recommended: GitHub Actions

The project is hosted on GitHub (`github.com/lgbarn/shipyard`). GitHub Actions is the natural fit.

**Workflow file:** `.github/workflows/test.yml`

```yaml
name: Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
```

**package.json test script:**
```json
{
  "scripts": {
    "test": "npx bats test/*.bats",
    "test:unit": "npx bats test/state-read.bats test/state-write.bats test/checkpoint.bats",
    "test:integration": "npx bats test/integration.bats"
  }
}
```

### Platform Matrix (Optional Enhancement)

To catch macOS-specific `date -v` issues:
```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest]
runs-on: ${{ matrix.os }}
```

### CI Dependencies

- **jq**: Pre-installed on GitHub Actions Ubuntu runners. On macOS runners, also pre-installed.
- **git**: Pre-installed on all runners.
- **bats + helpers**: Installed via `npm ci` from devDependencies.

---

## 6. Potential Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `date -v` (macOS) vs `date -d` (Linux) causes test failures | Medium | Tests fail on one platform | Test both platforms in CI matrix; checkpoint.sh already has fallback logic |
| `state-read.sh` depends on plugin directory structure (`SKILL.md`) | Medium | Tests fail if fixture path wrong | Create minimal `SKILL.md` fixture in test setup; override `PLUGIN_ROOT` or use symlinks |
| bats-assert npm package name differs from git repo | Low | Install fails | Verify exact npm package names before adding to `package.json` |
| `state-read.sh` uses `cd` to determine `SCRIPT_DIR` | Medium | Path resolution differs when called from test | Call scripts with absolute paths; set `BATS_TEST_DIRNAME` awareness |
| Prune test needs tags with old timestamps | Medium | Cannot easily create "old" tags | Create tags with manually crafted old timestamps in the tag name (the script parses name, not git metadata) |
| `set -euo pipefail` in scripts interacts with bats `run` | Low | Unexpected test failures | Always use `run` to invoke scripts; check `$status` and `$output` |

---

## 7. Recommended File Structure

```
test/
  test_helper.bash          # Loads bats-support, bats-assert, bats-file; sets paths
  fixtures/
    SKILL.md                # Minimal stub for state-read.sh
    STATE-minimal.md        # Sample STATE.md for read tests
    STATE-full.md           # Sample STATE.md with all sections
    config-minimal.json     # { "context_tier": "minimal" }
    config-full.json        # { "context_tier": "full" }
  state-read.bats           # ~26 test cases
  state-write.bats          # ~15 test cases
  checkpoint.bats           # ~16 test cases
  integration.bats          # ~5 test cases
```

**Total estimated test cases:** ~62

---

## 8. Implementation Considerations

### Helper Loading Path

With npm-installed bats helpers, the load path is:
```bash
load "$(npm root)/bats-support/load"
load "$(npm root)/bats-assert/load"
```

However, `npm root` outputs the `node_modules` path. Since `bats-support`, `bats-assert`, and `bats-file` are npm packages, their `load.bash` files live at `node_modules/bats-support/load.bash`. This needs verification after install.

### Script Invocation in Tests

Scripts use `set -euo pipefail` and reference `${BASH_SOURCE[0]}` for path resolution. In bats tests, scripts must be invoked as subprocesses via `run`:

```bash
@test "state-write: structured write" {
    run bash "$SCRIPTS_DIR/state-write.sh" --phase 2 --status building --position "test"
    assert_success
}
```

Do NOT `source` the scripts -- they have side effects (writes to files, outputs JSON, calls `exit`).

### state-read.sh Plugin Root Problem

`state-read.sh` computes `PLUGIN_ROOT` relative to its own filesystem location (`$SCRIPT_DIR/..`). In tests, this resolves correctly as long as the script is called by its real path. The SKILL.md dependency can be handled by:

1. Creating a fixture at the expected path relative to scripts/ (preferred -- no script changes needed).
2. Symlinking `skills/using-shipyard/SKILL.md` to a test fixture.

Option 1 is simplest: the test `setup_file` creates the fixture at the real `skills/using-shipyard/SKILL.md` path if it does not already exist, and `teardown_file` cleans it up only if it was created.

Since Shipyard already has a real `skills/using-shipyard/SKILL.md` in the repo, this is a non-issue for tests run from the project root.

### Testing `state-read.sh` Working Directory

`state-read.sh` reads files relative to `cwd` (e.g., `.shipyard/STATE.md`). Tests must `cd` into the temp workspace before running the script. bats `setup()` should handle this.

---

## 9. Sources

- [bats-core GitHub repository](https://github.com/bats-core/bats-core)
- [bats-core Installation docs](https://bats-core.readthedocs.io/en/stable/installation.html)
- [bats-core Writing Tests guide](https://bats-core.readthedocs.io/en/stable/writing-tests.html)
- [bats-core Tutorial](https://bats-core.readthedocs.io/en/stable/tutorial.html)
- [bats npm package (v1.13.0)](https://www.npmjs.com/package/bats)
- [bats-mock (jasonkarns)](https://github.com/jasonkarns/bats-mock) -- stubbing library
- [bats-mock (grayhemp)](https://github.com/grayhemp/bats-mock) -- alternative mock library
- [Testing Bash Scripts with BATS (HackerOne)](https://www.hackerone.com/blog/testing-bash-scripts-bats-practical-guide)
- [Testing Bash with BATS (Opensource.com)](https://opensource.com/article/19/2/testing-bash-bats)
- [Getting Started with Bash Testing with Bats (stefanzweifel.dev)](https://stefanzweifel.dev/posts/2020/12/22/getting-started-with-bash-testing-with-bats/)
