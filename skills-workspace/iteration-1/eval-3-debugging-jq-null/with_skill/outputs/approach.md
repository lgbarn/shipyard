# Debugging Approach: jq null is not iterable in /shipyard:build

## Skill Activated: shipyard-debugging

The shipyard-debugging skill immediately overrides the impulse to propose a fix. The error
message contains meaningful information that must be fully understood before any change is
attempted. The Iron Law applies: no fixes without root cause investigation first.

---

## Phase 1: Root Cause Investigation

### Step 1: Read the Error Carefully

The error is `jq: error: null is not iterable`. This is a specific jq error with a known meaning:
a jq expression is trying to iterate over (`.[]`) or pipe through a filter that expects an array
or object, but the actual value at that path is `null`. The error is not from bash, not from the
command runner, and not from a plugin loading failure. It is from jq itself during data processing.

The user says this happens "on a fresh project" — meaning `.shipyard/` was just created by
`/shipyard:init`. This is a critical constraint: fresh projects have a specific, minimal state.

I do NOT immediately propose a fix. I have only the symptom. I do not yet know:
- Which jq expression triggers the error
- Which file is being processed
- What the actual null value is (missing field? missing file? null field value?)
- At what step in the build workflow does it fail

### Step 2: Reproduce Consistently

Reproduce the exact failure before touching anything:

```bash
# On a fresh project that has run /shipyard:init but NOT /shipyard:plan:
/shipyard:build
```

Confirm: does it fail every time on a fresh project? Does it fail only on fresh projects, or also
on projects with plan files? This scopes whether the bug is in initialization path vs. execution
path.

### Step 3: Check Recent Changes

Run:
```bash
git log --oneline -10
git diff HEAD~1 HEAD -- scripts/ commands/ hooks/
```

Check whether any recent commit changed jq expressions in state-read.sh, state-write.sh,
build.md, or hooks. Since the user reports "clearing cache and reinstalling" did not help, the
bug is almost certainly in the code logic, not the installation.

### Step 4: Gather Evidence at Each Component Boundary

The `/shipyard:build` command has multiple components that each use jq. Before guessing which
one fails, add instrumentation at each boundary to find WHERE it breaks.

The build command (`commands/build.md`) executes these steps in order:

1. **Step 1: Parse Arguments** — reads `.shipyard/STATE.json` for current phase
2. **Step 1: Read config.json** — reads `.shipyard/config.json` for gate preferences
3. **Step 2: Validate State** — reads STATE.json, ROADMAP.md, plan files from `.shipyard/phases/{N}/plans/`
4. **Step 2: Checks which plans have SUMMARY.md** — iterates over results directory
5. **Step 3: Update State** — calls `scripts/state-write.sh`
6. **Step 3a: Create Checkpoint** — calls `scripts/checkpoint.sh`
7. **Step 4: Execute by Wave** — groups plans by wave number; iterates plan files

Diagnostic instrumentation to add (temporarily, read-only):

```bash
# After Step 1: Does STATE.json exist and parse correctly?
echo "=== STATE.json contents ===" >&2
cat .shipyard/STATE.json >&2

# Does jq parse the phase field without error?
echo "=== phase from STATE.json ===" >&2
jq -r '.phase' .shipyard/STATE.json >&2

# Does config.json exist?
echo "=== config.json gate fields ===" >&2
jq -r '{security_audit, simplification_review, iac_validation, documentation_generation}' .shipyard/config.json >&2

# Does phases directory exist? What's in it?
echo "=== phases directory ===" >&2
ls -la .shipyard/phases/ >&2 || echo "phases/ does not exist" >&2

# If phases exists, what does the plan list look like?
echo "=== plan files found ===" >&2
ls .shipyard/phases/1/plans/ >&2 || echo "no plans directory for phase 1" >&2
```

Run the command once with this instrumentation in place. The output reveals which boundary fails.

### Step 5: Trace the Data Flow Backward

Once the instrumentation identifies the failing component, trace backward.

**Most likely candidates for "null is not iterable" on a fresh project:**

**Candidate A: Plan file iteration when no plans exist**

The build command (Step 4: Execute by Wave) groups plans by wave number and iterates them. On a
fresh project where `/shipyard:plan` has not been run, `.shipyard/phases/1/plans/` either does
not exist or contains no PLAN-*.md files. If the jq expression that reads or groups plans
receives an empty or absent value, it could produce null and then attempt to iterate it.

In `commands/build.md`, Step 2 checks "which plans have already been completed" — this involves
reading plan files from `.shipyard/phases/{N}/plans/`. If the directory is absent on a fresh
project, a jq expression receiving its output (e.g., trying to parse filenames or wave numbers
from plan filenames) could get null.

**Candidate B: STATE.json missing the `phase` field or phase is null**

On a fresh project, `STATE.json` may have `"phase": 0` or `"phase": null` (if init did not set
it). The build command reads STATE.json to determine the current phase. If phase is null, any
subsequent jq expression using `.phase` as an array index or filter input would fail with "null
is not iterable."

**Candidate C: config.json missing expected fields**

Step 1 reads config.json for `security_audit`, `simplification_review`, `iac_validation`,
`documentation_generation`. If the build command passes config.json content through a jq filter
that expects these fields as an array or object to iterate, and one is absent (null), it fails.
However, the config.json structure in PROTOCOLS.md shows these are scalar booleans, not arrays —
less likely to cause "not iterable."

**Candidate D: model_routing field absent**

The Model Routing Protocol reads `model_routing` from config.json. If the jq expression reads
`.model_routing` and then tries to iterate its keys or values when model_routing is absent
(null in jq), this would fail.

---

## Phase 2: Pattern Analysis

Once instrumentation confirms which boundary fails:

- Find working jq expressions in the same codebase that handle potentially-absent fields. For
  example, `state-read.sh` uses `(.position // "")` and `(.blocker // "")` defensively. Check
  whether the failing expression uses the same defensive pattern or whether it omits the `//`
  fallback.

- Compare the failing path against working paths. If state-read.sh handles null safely but
  the build command does not, the difference is the defensive null handling.

- Read the full jq expression around the error. The error message "null is not iterable" means
  a `.[]` or `keys[]` or `to_entries[]` is being applied to null. Find that expression.

---

## Phase 3: Hypothesis and Testing

After evidence gathering, form a single hypothesis. For example:

**Hypothesis (to be confirmed by instrumentation):** "The build command reads `.shipyard/phases/1/plans/`
which does not exist on a fresh project. The jq expression that processes plan file output
receives an empty string or null and then applies `.[]` to group plans by wave number, causing
'null is not iterable.'"

**Minimal test:** Create the expression in isolation:
```bash
echo 'null' | jq '.[]'
# Output: jq: error (at <stdin>:0): null (null) is not iterable
# Confirms the mechanism
```

Then test with the exact state of a fresh project to confirm whether the expression is reached
and what input it receives.

One hypothesis at a time. Do not combine "fix the null" with "also add better error message" —
those are two separate changes.

---

## Phase 4: Implementation (deferred until Phase 3 confirms)

Only after the hypothesis is confirmed:

1. Write a failing BATS test that reproduces the error on a fresh project (no plan files)
2. Apply the single minimal fix (e.g., add a `// []` fallback, or add a guard that checks
   whether plans exist before attempting to group them, or add a Step 2 guard that exits early
   with a user-friendly message if no plan files are found)
3. Verify: the failing test now passes, existing 108 tests still pass, and manually running
   `/shipyard:build` on a fresh project gives a clear message ("No plans found. Run
   /shipyard:plan first.") rather than a jq error

---

## What I Did NOT Do

- Did not immediately propose "add `// []` after every jq expression that could return null"
- Did not guess which step fails without instrumenting
- Did not propose multiple simultaneous fixes
- Did not treat the symptom ("wrap the build command in error handling") as the solution
- Did not skip writing a failing test before implementing the fix

The user has already tried clearing cache and reinstalling, which means the problem is
deterministic and in the code. Systematic investigation is faster than continued guessing.
