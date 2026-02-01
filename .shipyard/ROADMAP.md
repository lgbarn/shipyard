# Shipyard v2.0 Roadmap

**Milestone:** Shipyard v2.0 -- Hardened, Tested, Token-Efficient
**Baseline:** v1.2.0 (3 bash scripts, 310 LOC total; 14 skills, 11 commands, 9 agents)
**Constraints:** No new runtime deps. Must remain a Claude Code plugin. macOS + Linux.

---

## Phase 1 -- Security Hardening (Scripts)

**Complexity:** S
**Depends on:** nothing
**Goal:** Eliminate all injection, path traversal, and input validation gaps in the 3 bash scripts. Add .gitignore.

### Scope

- `scripts/state-read.sh` (158 lines) -- uses unquoted `$phase` in `find`, grep -oP (GNU-only), unvalidated config values from jq, unquoted glob expansions in `ls` and `for` loops.
- `scripts/state-write.sh` (111 lines) -- `--raw` writes arbitrary content with no validation; `--phase` accepts any string (no integer check); printf %b enables format-string injection.
- `scripts/checkpoint.sh` (41 lines) -- `$LABEL` injected directly into git tag name with no sanitization; `$DAYS` passed unvalidated to `date -v`.
- Add `.gitignore` (node_modules, .DS_Store, *.log, etc.).

### Success Criteria

1. `shellcheck --severity=warning scripts/*.sh` exits 0 with zero warnings.
2. All script arguments validated: phase is integer, label is alphanumeric+hyphens, status is from a known enum.
3. Path traversal prevented: no `..` allowed in file paths derived from user input.
4. `.gitignore` committed and covers standard exclusions.
5. grep -oP replaced with POSIX-compatible alternative (works on macOS default grep).

### Files Touched

- `scripts/state-read.sh`
- `scripts/state-write.sh`
- `scripts/checkpoint.sh`
- `.gitignore` (new)

---

## Phase 2 -- Testing Foundation (bats-core)

**Complexity:** M
**Depends on:** Phase 1
**Goal:** Establish bats-core test suite covering all 3 scripts, plus a CI-ready runner.

### Scope

- Install bats-core as a dev dependency (or document install instructions; no runtime dep).
- Unit tests for `state-read.sh`: test each context tier (minimal, planning, execution, full), missing .shipyard dir, missing STATE.md, malformed config.json, JSON output validity.
- Unit tests for `state-write.sh`: structured write, raw write, missing .shipyard dir, invalid phase, status enum validation, history preservation.
- Unit tests for `checkpoint.sh`: tag creation, label sanitization rejection, prune by age, no-git-repo graceful exit.
- Integration test: init-state -> write -> read -> checkpoint -> prune round-trip.
- CI runner script (`test/run.sh`) that installs bats if needed and runs the suite.

### Success Criteria

1. `test/run.sh` exits 0 on a clean checkout (macOS and Linux).
2. Minimum 15 test cases across the 3 scripts.
3. Each script has at least 1 negative test (bad input rejected).
4. Integration test proves read-after-write consistency.

### Files Touched

- `test/run.sh` (new)
- `test/unit/state-read.bats` (new)
- `test/unit/state-write.bats` (new)
- `test/unit/checkpoint.bats` (new)
- `test/integration/round-trip.bats` (new)
- `test/helpers/` (new -- shared setup/teardown fixtures)

---

## Phase 3 -- Reliability and State Management

**Complexity:** M
**Depends on:** Phase 1
**Goal:** Add proper exit codes, state corruption detection/recovery, and version checks.

### Scope

- Define exit code contract: 0=success, 1=user error, 2=state corruption, 3=missing dependency.
- `state-read.sh`: detect corrupt/incomplete STATE.md (missing required fields), emit structured error JSON instead of crashing. Add version field to state output.
- `state-write.sh`: atomic writes (write to temp file, then mv). Validate STATE.md is well-formed after write. Add schema version to STATE.md header.
- `checkpoint.sh`: verify git repo and at least one commit before tagging. Warn if worktree is dirty.
- Add `scripts/recover.sh` or extend `state-write.sh` with `--recover` flag to rebuild STATE.md from git history and .shipyard/ artifacts.
- Schema version field in STATE.md (`schema: 2.0`) for future migrations.

### Success Criteria

1. Truncated STATE.md is detected and reported (exit code 2), not silently ignored.
2. Atomic writes confirmed: kill during write does not corrupt STATE.md.
3. `--recover` rebuilds a valid STATE.md from .shipyard/ contents.
4. All exit codes documented in script headers and tested in Phase 2 tests (add tests here too).
5. `schema: 2.0` present in all newly created STATE.md files.

### Files Touched

- `scripts/state-read.sh`
- `scripts/state-write.sh`
- `scripts/checkpoint.sh`
- `test/unit/state-read.bats` (additional tests)
- `test/unit/state-write.bats` (additional tests)
- `test/unit/checkpoint.bats` (additional tests)

---

## Phase 4 -- Token Optimization

**Complexity:** M
**Depends on:** Phase 1
**Goal:** Reduce session injection from ~6000 to ~2000 tokens. Enforce per-file budgets. Apply progressive disclosure across all Shipyard content.

### Scope

- `state-read.sh` session hook: strip the full `using-shipyard` SKILL.md injection. Replace with a 20-line summary (command list + "use Skill tool for details"). Target: hook output under 2000 tokens with state loaded.
- `skills/using-shipyard/SKILL.md` (175 lines): keep full content but it will no longer be injected -- only loaded on-demand via Skill tool.
- All SKILL.md files: enforce 500-line max. Only `shipyard-writing-skills` (634 lines) exceeds this -- split or trim.
- Commands and agents: audit for duplicated instructions. Extract shared patterns into a single reference skill or preamble.
- Add token budget comments at the top of each SKILL.md: `<!-- budget: 400 lines / ~X tokens -->`.

### Success Criteria

1. `state-read.sh` output measured at under 2500 tokens with a typical project state (planning tier).
2. No SKILL.md exceeds 500 lines.
3. `skills/shipyard-writing-skills/SKILL.md` reduced from 634 to under 500 lines.
4. Duplicated instruction blocks across commands identified and consolidated (at least 3 instances removed).
5. Session start no longer injects full skill content -- only a summary.

### Files Touched

- `scripts/state-read.sh`
- `skills/using-shipyard/SKILL.md`
- `skills/shipyard-writing-skills/SKILL.md`
- Various `commands/*.md` (dedup pass)
- Various `agents/*.md` (dedup pass)

---

## Phase 5 -- Lessons-Learned System

**Complexity:** M
**Depends on:** Phase 3, Phase 4
**Goal:** Auto-capture discoveries during building/shipping and persist them for future sessions.

### Scope

- New file: `.shipyard/LESSONS.md` -- append-only log of discoveries, keyed by date and phase.
- Modify `commands/ship.md` to include a "lessons learned" prompt step before finalizing: ask user what went well, what was surprising, what to avoid next time.
- Modify `commands/build.md` to capture blockers and workarounds encountered during execution as candidate lessons.
- New skill: `skills/lessons-learned/SKILL.md` -- instructs the agent on how to extract, format, and persist lessons.
- User review step: after auto-capture, present lessons to user for approval/edit before persisting.
- Optional: append approved lessons to project CLAUDE.md (if it exists) as a "## Lessons Learned" section.

### Success Criteria

1. After `/shipyard:ship`, user is prompted with captured lessons for review.
2. Approved lessons are appended to `.shipyard/LESSONS.md` with timestamp and phase.
3. If CLAUDE.md exists in project root, a "Lessons Learned" section is appended/updated.
4. Lessons from previous phases are visible in `state-read.sh` output (execution tier only, max 5 recent).
5. Skill file under 200 lines.

### Files Touched

- `commands/ship.md`
- `commands/build.md`
- `skills/lessons-learned/SKILL.md` (new)
- `scripts/state-read.sh` (add lessons to execution tier)

---

## Phase 6 -- Developer Experience

**Complexity:** S
**Depends on:** Phase 4
**Goal:** Add CONTRIBUTING.md, reduce documentation duplication, improve onboarding.

### Scope

- `CONTRIBUTING.md` (new): how to add commands, skills, agents. Testing instructions. PR checklist. Style guide for markdown files.
- Audit README.md: ensure it references CONTRIBUTING.md for contributor details, trim any duplicated setup instructions.
- Schema versioning: add `"schemaVersion": "2.0"` to `hooks/hooks.json` and document the migration path from v1.x.
- `package.json`: bump version to `2.0.0`. Add `test` script pointing to `test/run.sh`. Add `engines` field for bash/jq/git minimum versions.
- Ensure all 14 skills have consistent frontmatter/structure (name, description, usage example in first 10 lines).

### Success Criteria

1. `CONTRIBUTING.md` exists and covers: adding commands, adding skills, adding agents, running tests, PR requirements.
2. `package.json` version is `2.0.0` with a working `npm test` command.
3. `hooks/hooks.json` contains `schemaVersion: "2.0"`.
4. No duplicated setup/install instructions across README.md and CONTRIBUTING.md.
5. All 14 skills have a consistent header block in the first 10 lines.

### Files Touched

- `CONTRIBUTING.md` (new)
- `README.md`
- `package.json`
- `hooks/hooks.json`
- Various `skills/*/SKILL.md` (header consistency)

---

## Phase 7 -- Final Validation and Release

**Complexity:** S
**Depends on:** Phase 2, Phase 3, Phase 5, Phase 6
**Goal:** End-to-end validation of all v2.0 changes. Tag and prepare release.

### Scope

- Run full test suite (`test/run.sh`) and fix any failures.
- Run `shellcheck --severity=style scripts/*.sh` and fix any remaining issues.
- End-to-end smoke test: `init -> plan -> build -> ship` workflow on a sample project to verify lessons-learned, state management, token injection, and recovery all work together.
- Verify `.gitignore` is effective (no unwanted files tracked).
- Verify session injection token count is under 2500 tokens (measure with `wc -w` on hook output as proxy).
- Tag release as `v2.0.0`. Update CHANGELOG or release notes.

### Success Criteria

1. `test/run.sh` exits 0 with all tests passing.
2. `shellcheck --severity=style scripts/*.sh` exits 0.
3. Smoke test of full lifecycle completes without manual intervention.
4. Session hook output under 2500 tokens (measured).
5. `git tag v2.0.0` created.
6. npm package publishable (`npm pack` succeeds, `files` field correct).

### Files Touched

- `test/` (fixes if needed)
- `scripts/*.sh` (final polish)
- `package.json` (final verification)

---

## Dependency Graph

```
Phase 1 (Security)
  |
  +---> Phase 2 (Testing) -------+
  |                               |
  +---> Phase 3 (Reliability) ---+---> Phase 7 (Validation + Release)
  |                               |
  +---> Phase 4 (Tokens) --------+
          |                       |
          +---> Phase 5 (Lessons)-+
          |
          +---> Phase 6 (DX) ----+
```

**Wave 1:** Phase 1
**Wave 2:** Phase 2, Phase 3, Phase 4 (parallel after Phase 1)
**Wave 3:** Phase 5, Phase 6 (parallel after their dependencies)
**Wave 4:** Phase 7 (final gate)
