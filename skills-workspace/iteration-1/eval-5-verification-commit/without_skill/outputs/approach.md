# Approach: Verification Before Commit

## Starting Position

The user says "I've refactored the config system to use jq instead of sed. Everything looks good, can you commit this?"

I do NOT immediately commit. "Everything looks good" is a subjective claim by the author — the person most likely to have blind spots about their own changes. My job is to verify independently before creating a permanent record in git history.

---

## Step 1: Understand What Actually Changed

Before touching git, I run `git diff --stat HEAD` and `git status` to see which files were modified. This tells me the actual scope of the refactor. I do not take "config system" at face value — I need to see exactly which scripts changed.

In this repo, the relevant files are likely:
- `scripts/state-read.sh` (reads STATE.json, config.json)
- `scripts/state-write.sh` (writes STATE.json)
- Possibly `scripts/check-versions.sh`

I read the full diff (`git diff HEAD`) to understand every change made. I am looking for:
- Every `sed` call that was replaced, and whether the `jq` replacement is semantically equivalent
- Any `sed` calls that were NOT replaced but probably should have been (incomplete refactor)
- Any `sed` calls that were intentionally kept (some `sed` usage is appropriate — e.g., the XML-stripping sanitizer in `state-read.sh` line 24 and the git tag label parsing in `state-write.sh` line 247)

---

## Step 2: Run the Pre-Commit Checks Manually

This repo has a pre-commit hook that runs `check-versions.sh` and `npm test`. I run those manually NOW, before staging anything:

```
bash scripts/check-versions.sh
npm test
```

I do not skip this step. The hook will run anyway, but running it early surfaces failures before I've staged files and need to unstage them.

---

## Step 3: ShellCheck the Modified Scripts

ShellCheck is part of CI lint and covers `scripts/*.sh`. I run it locally on every changed script:

```
shellcheck scripts/state-read.sh
shellcheck scripts/state-write.sh
shellcheck scripts/check-versions.sh
```

jq-based refactors commonly introduce new ShellCheck issues:
- Unquoted variables passed to `jq --arg`
- `jq` output assigned to a variable without error handling
- Missing `|| true` on `jq` calls in `set -e` contexts
- `jq -r` returning `null` as the literal string "null" instead of empty string

---

## Step 4: Verify Semantic Equivalence of Each Replacement

I read the before-and-after for every replaced `sed` pattern and confirm the `jq` equivalent produces identical output for the same input. The most critical ones in this codebase:

- `state-read.sh` lines 67-71: sed-based Markdown parsing of `**Status:**`, `**Current Phase:**` etc. from the old STATE.md format. If these were replaced with jq reading STATE.json, I verify the JSON field names match what `state-write.sh` actually writes.
- `state-write.sh` line 219: `sed 's|.*/||'` for stripping path prefixes from git tags — a `jq` replacement here would be unusual (this is shell glob output, not JSON). I check whether this was correctly left alone or accidentally replaced.
- `state-write.sh` line 247: `sed` for stripping checkpoint tag labels. Same concern.

I specifically look for the known gotcha from this project's MEMORY: `jq -e '.field and .field'` treats value `0` as false. If any numeric fields (like `phase`) are now being tested with `and`, that would be a correctness bug.

---

## Step 5: Confirm jq Is Available as a Dependency

`jq` is already a declared dependency in this codebase (state-read.sh line 112 guards for it, doctor.md checks for it). The refactor increasing `jq` surface area does not change the dependency contract, but I confirm `jq --version` works in the current environment.

---

## Step 6: Run the Full Test Suite

```
npm test
```

This runs 108 BATS tests. I wait for it to complete. I do not commit until it passes. A refactor of the config/state read-write system is high-impact — these tests exercise the exact codepaths changed.

If any tests fail, I stop, diagnose the root cause (not patch around the failure), fix it, and re-run.

---

## Step 7: Spot-Check Live Behavior (Optional but Recommended)

If the test suite passes, I do a quick sanity check against a real `.shipyard/STATE.json` if one is present, or a synthetic one:

```bash
echo '{"schema":"1.0","phase":1,"status":"building","position":"Step 3"}' > /tmp/test-state.json
# run state-read.sh against it and confirm output looks correct
```

This catches edge cases that unit tests might not cover (e.g., empty strings, missing optional fields, null values from jq).

---

## Step 8: Stage Only the Intended Files

I use `git add <specific files>` — NOT `git add -A` or `git add .`. This prevents accidentally staging:
- `.claude/settings.json` (untracked, likely private local config)
- `.omc/` directory (untracked, appears to be analysis artifacts)
- `skills-workspace/` (untracked, workspace files)

All three of those show as untracked in `git status` and must NOT be committed.

---

## Step 9: Commit With a Precise Message

Only after all of the above pass do I create the commit:

```
git commit -m "refactor: replace sed with jq in config/state read-write scripts"
```

I follow the conventional commits format this repo uses (`fix:`, `feat:`, `chore:`, `refactor:`).

---

## Summary: Do I Trust "Everything Looks Good"?

No. Not because I distrust the user, but because:

1. Authors have confirmation bias about their own changes.
2. The pre-commit hook will catch version/test failures anyway — I am just surfacing them earlier.
3. The specific risk here (sed-to-jq semantic equivalence) is subtle. jq's null-as-string behavior, the `0`-is-falsy gotcha, and missing error handling under `set -e` are all things that look fine visually but fail at runtime.
4. "Config system" touches state read/write — the most critical paths in this CLI. A silent correctness bug here would corrupt `.shipyard/STATE.json` for users.

The cost of verification is a few minutes. The cost of committing a broken refactor is a bug in a shipped release.
