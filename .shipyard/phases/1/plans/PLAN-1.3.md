---
phase: security-hardening
plan: "1.3"
wave: 1
dependencies: []
must_haves:
  - grep -oP replaced with POSIX sed on lines 24-25
  - $phase validated as integer before arithmetic and find usage
  - ls-in-for-loop replaced with glob or find on lines 69, 74
  - context_tier validated against allowlist
  - BRE non-standard alternation fixed on line 116
  - shellcheck zero warnings on state-read.sh
files_touched:
  - scripts/state-read.sh
tdd: false
---

# PLAN-1.3: state-read.sh hardening (POSIX compat + input validation)

## Context

`state-read.sh` has the most issues (7 findings). The most impactful is `grep -oP`
(PCRE) which fails on macOS since macOS grep does not support `-P`. The `$phase`
variable flows into `find -name` (glob injection) and arithmetic (crash). The
`ls`-in-for-loop pattern triggers shellcheck SC2012.

---

<task id="1" files="scripts/state-read.sh" tdd="false">
  <action>
  **Fix grep -oP to POSIX-compatible sed (lines 24-25, issue #2)**

  Replace lines 24-25:
  ```bash
    status=$(echo "$state_md" | grep -oP '(?<=\*\*Status:\*\* ).*' 2>/dev/null || echo "")
    phase=$(echo "$state_md" | grep -oP '(?<=\*\*Current Phase:\*\* )\d+' 2>/dev/null || echo "")
  ```
  With:
  ```bash
    status=$(echo "$state_md" | sed -n 's/^.*\*\*Status:\*\* \(.*\)$/\1/p' | head -1)
    phase=$(echo "$state_md" | sed -n 's/^.*\*\*Current Phase:\*\* \([0-9][0-9]*\).*$/\1/p' | head -1)
  ```

  The `sed -n 's/.../\1/p'` pattern is POSIX-compliant and works identically on
  macOS and Linux. `head -1` ensures a single value if multiple matches exist.

  **Validate context_tier against allowlist (line 30, issue #11)**

  After line 30 (the jq extraction of `context_tier`), insert:
  ```bash
      case "$context_tier" in
          auto|minimal|planning|execution|brownfield|full) ;;
          *) context_tier="auto" ;;
      esac
  ```

  **Validate $phase as integer after extraction (issue #4, #5)**

  After line 25 (the new sed-based phase extraction), insert:
  ```bash
    if [ -n "$phase" ] && ! [[ "$phase" =~ ^[0-9]+$ ]]; then
        phase=""
    fi
  ```

  This prevents `$phase` from carrying glob characters into `find -name` (line 65)
  or causing arithmetic errors on line 115.
  </action>
  <verify>! grep -q 'grep -oP' scripts/state-read.sh && shellcheck --severity=warning scripts/state-read.sh 2>&1 | head -30</verify>
  <done>No grep -oP in file. Phase is validated as integer-only. context_tier falls back to "auto" on unrecognized values.</done>
</task>

<task id="2" files="scripts/state-read.sh" tdd="false">
  <action>
  **Replace ls-in-for-loop with glob patterns (lines 69, 74, issues #10)**

  Replace line 69:
  ```bash
                for plan_file in $(ls "${phase_dir}/plans/"PLAN-*.md 2>/dev/null | head -3); do
  ```
  With:
  ```bash
                plan_count=0
                for plan_file in "${phase_dir}/plans/"PLAN-*.md; do
                    [ -e "$plan_file" ] || continue
                    [ "$plan_count" -ge 3 ] && break
                    plan_count=$((plan_count + 1))
  ```

  Remove the existing closing `done` for this loop and replace with just `done`
  (the loop body remains the same, but the iteration source changes).

  Replace line 74:
  ```bash
                for summary_file in $(ls "${phase_dir}/results/"SUMMARY-*.md 2>/dev/null | tail -3); do
  ```

  This one needs the last 3 files, so use a different approach. Replace with:
  ```bash
                summary_files=()
                for f in "${phase_dir}/results/"SUMMARY-*.md; do
                    [ -e "$f" ] && summary_files+=("$f")
                done
                # Take last 3 entries (glob sorts lexicographically)
                total=${#summary_files[@]}
                start=$(( total > 3 ? total - 3 : 0 ))
                for summary_file in "${summary_files[@]:$start}"; do
  ```

  The existing loop body (lines 75-76) and closing `done` remain unchanged.
  </action>
  <verify>! grep -q '$(ls ' scripts/state-read.sh && shellcheck --severity=warning scripts/state-read.sh 2>&1 | head -30</verify>
  <done>No ls-in-command-substitution remains. Glob patterns used for file iteration. shellcheck clean on SC2012.</done>
</task>

<task id="3" files="scripts/state-read.sh" tdd="false">
  <action>
  **Fix BRE non-standard alternation on line 116 (issue #12)**

  Replace line 116:
  ```bash
            if grep -q "Phase ${next_phase}\|Phase 0${next_phase}" ".shipyard/ROADMAP.md" 2>/dev/null; then
  ```
  With:
  ```bash
            if grep -qE "Phase ${next_phase}|Phase 0${next_phase}" ".shipyard/ROADMAP.md" 2>/dev/null; then
  ```

  The `-E` flag enables ERE (extended regular expressions) where `|` is the
  standard alternation operator. BRE `\|` is a GNU extension not supported on
  all platforms.

  **Validate $phase before arithmetic on line 115 (already protected by task 1)**

  After the integer validation added in task 1, line 115 is safe. However, add a
  guard for defense in depth. Replace line 115:
  ```bash
            next_phase=$((${phase:-0} + 1))
  ```
  With:
  ```bash
            next_phase=$(( ${phase:-0} + 1 ))
  ```

  This is cosmetic (spacing), but confirm `phase` is already validated upstream.
  The real protection is the regex guard from task 1 ensuring `$phase` is always
  empty or a pure integer.

  **Final shellcheck pass:**
  ```bash
  shellcheck --severity=warning scripts/state-read.sh
  ```

  Address any remaining warnings. Common ones to watch for:
  - SC2086 (double-quote variables) -- quote any unquoted expansions flagged
  - SC2034 (unused variables) -- remove or suppress if intentional
  </action>
  <verify>shellcheck --severity=warning scripts/state-read.sh && shellcheck --severity=warning scripts/state-write.sh && shellcheck --severity=warning scripts/checkpoint.sh</verify>
  <done>All three scripts pass shellcheck with zero warnings. grep -oP eliminated. BRE alternation fixed. All user inputs validated.</done>
</task>
