# Approach: Debugging "jq: error: null is not iterable" in /shipyard:build

## Starting Posture: Investigate First, Fix Last

I do not immediately propose a fix. "null is not iterable" is a symptom, not a root cause. The same error message can come from completely different code paths depending on which jq expression encounters a null. Proposing a fix before knowing which expression and which field is null would be a guess dressed up as a solution.

The user's note that "clearing the cache and reinstalling" had no effect is a meaningful clue: the problem is not environmental (wrong jq version, corrupt plugin install). It is reproducible and deterministic. That narrows the search to logic, not infrastructure.

---

## Step 1: Reproduce the Error and Read the Full Message

Before reading any code, I need the exact error output, not a paraphrase. The user said:

> jq: error: null is not iterable

But jq errors include the expression that failed. The full message looks like:

```
jq: error (at <stdin>:1): null (null) is not iterable
```

or, for a piped filter:

```
jq: error (at .shipyard/STATE.json:0): null (null) is not iterable
```

This tells me which file was being processed and (sometimes) which filter step. I ask the user to run the command again and capture the full stderr, or I reproduce it myself in a fresh project by:

1. Creating a bare directory with no `.shipyard/` content
2. Running the equivalent shell call that `/shipyard:build` triggers at Step 1 (reading STATE.json for the current phase)
3. Capturing the full stderr output

If the user cannot provide the full trace, I attempt to trigger it myself.

---

## Step 2: Identify Which Code Path the Build Command Calls That Uses jq

The `/shipyard:build` command (in `commands/build.md`) is a prose instruction file — it is not itself a bash script. It tells Claude to invoke bash scripts. The scripts that use jq in this workflow are:

- **`scripts/state-read.sh`** — called at the start of every session via the SessionStart hook, and explicitly instructed in build Step 1 ("read `.shipyard/STATE.json` for the current phase")
- **`scripts/state-write.sh`** — called at Step 3 to update STATE.json
- **`scripts/checkpoint.sh`** — called at Step 3a; does not use jq
- **`hooks/stop.sh`** — uses jq but only on session end

The error is reported when running on a "fresh project," which means `.shipyard/` either does not exist yet or was just created by `/shipyard:init`. The build command's Step 2 says "Verify `.shipyard/` exists. If not, tell the user to run `/shipyard:init` first." So either init was run and produced incomplete state, or state-read.sh is the source of the error.

My primary suspect is `scripts/state-read.sh` because:
1. It is the first script Claude executes (SessionStart hook or step 1 of build)
2. It contains multiple jq expressions
3. It runs against STATE.json whose contents on a fresh project may be missing expected fields

---

## Step 3: Trace the Data Flow Through jq Expressions in state-read.sh

I read `scripts/state-read.sh` systematically. The jq expressions in order of execution are:

**Line 183 — JSON structure validation:**
```bash
jq -e 'has("schema") and has("phase") and has("status")' .shipyard/STATE.json
```
`has()` never iterates, so this cannot produce "null is not iterable."

**Line 204 — Field extraction via @tsv:**
```bash
_tsv=$(jq -r '[.schema, .phase, .status, (.position // ""), (.blocker // "")] | @tsv' .shipyard/STATE.json 2>/dev/null)
```
Array construction with `[]` is not iteration. The `//` fallbacks handle null. This is safe unless STATE.json itself is malformed in a way that makes `.schema`, `.phase`, or `.status` an unexpected type — but that produces a type error, not "null is not iterable."

**Line 222 — config.json read:**
```bash
context_tier=$(jq -r '.context_tier // "auto"' ".shipyard/config.json" 2>/dev/null || echo "auto")
```
Uses `//`, safe against null.

**Line 339 — codebase_docs_path read:**
```bash
codebase_docs_path=$(jq -r '.codebase_docs_path // ".shipyard/codebase"' ".shipyard/config.json" 2>/dev/null || echo ".shipyard/codebase")
```
Also safe.

None of these produce "null is not iterable" directly. The "null is not iterable" error from jq is specifically triggered by expressions like `.field[]` or `.[]\` or `to_entries[]` or `keys[]` applied to a null value.

---

## Step 4: Widen the Search — What Else Does the Build Workflow Invoke That Calls jq?

`scripts/state-read.sh` does not contain any `[]` iteration. So if the error is in state-read.sh, it would have to come from something being piped to jq with an iteration expression. The error must be coming from somewhere else.

I check `scripts/state-write.sh`. The relevant jq call at line 291:
```bash
NEW_CONTENT=$(jq -n \
    --argjson schema 3 \
    --argjson phase "${PHASE:-0}" \
    ...
```
Uses `--argjson` with `0` as default. If `PHASE` is empty string, `--argjson phase ""` would fail because `""` is not valid JSON. That would produce a different error though ("Invalid numeric literal").

The build command Step 3 calls `state-write.sh` with `--phase`, `--position`, and `--status` flags. If those variables were unset or null-derived from a broken STATE.json read, the write step could fail.

---

## Step 5: Hypothesis Formation — Check git log for Recent Changes

The error reproduces on a fresh project but presumably worked before (otherwise it would be a known open bug). "Fresh project" plus "reproducible" suggests a regression.

I run:
```bash
git log --oneline -20 scripts/state-read.sh scripts/state-write.sh hooks/ commands/build.md
```

and:
```bash
git diff HEAD~5 -- scripts/state-read.sh scripts/state-write.sh
```

I am looking for any recently added jq expression that uses iteration (`[]`, `to_entries`, `keys`, `map`, `select`) against a field that could be null on a fresh project where STATE.json has just been created by init with only the mandatory fields (`schema`, `phase`, `status`, `position`, `updated_at`, `blocker: null`).

A fresh project STATE.json from `/shipyard:init` looks like:
```json
{"schema":3,"phase":1,"position":"Initialization complete, ready for planning","status":"ready","updated_at":"...","blocker":null}
```

Any jq expression that tries to iterate over a field that does not exist in this structure — for example, a hypothetical `.plans[]` or `.model_routing | keys[]` or `.phases[]` — would produce "null is not iterable."

---

## Step 6: Check config.json on a Fresh Project

The build command Step 1 reads `.shipyard/config.json` for gate preferences and model routing. A fresh project's config.json from init contains `model_routing` as a nested object. If any code attempts to iterate over `model_routing` values using `[]` on a fresh project where config.json exists but a specific nested key is absent, that would be the source.

I examine any code that reads `model_routing` from config.json with an iteration expression. For example:
```bash
jq -r '.model_routing | to_entries[] | ...' .shipyard/config.json
```
If `model_routing` is absent from config.json (e.g., the user skipped that question during init, or init wrote an incomplete config), `.model_routing` returns `null`, and `null | to_entries[]` throws "null is not iterable."

---

## Explicit Hypothesis (Before Any Fix)

**Most likely root cause:** A jq expression somewhere in the build invocation path iterates (`.field[]`, `to_entries[]`, `keys[]`, or similar) over a config.json or STATE.json field that does not exist on a fresh project, returning null before the iteration.

**Second most likely:** A recent change to state-read.sh, state-write.sh, or a hook introduced an iteration expression without a null-guard (`//` fallback or `if . != null then`), and it only manifests on fresh projects because established projects have the field populated from prior runs.

**Verification plan for the hypothesis:**
1. Run `jq -r '.model_routing | to_entries[]' .shipyard/config.json` on a fresh project's config.json — if it throws "null is not iterable," this is the site.
2. Run `git diff HEAD~5 -- scripts/` and look for any newly introduced `[]` iteration without null-guard.
3. Add `--exit-status` and remove `2>/dev/null` suppression temporarily to get the unfiltered error with line context.

Only after confirming the exact expression and the exact null field do I propose a fix — which would be adding a `// []` or `// {}` fallback, or an `if . != null then ... else [] end` guard, at the confirmed site.
