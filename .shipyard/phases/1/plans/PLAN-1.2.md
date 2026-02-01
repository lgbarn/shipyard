---
phase: security-hardening
plan: "1.2"
wave: 1
dependencies: []
must_haves:
  - printf '%b' replaced with printf '%s' using explicit $'\n' for newlines
  - --phase validated as integer
  - --status validated against known enum
  - echo on line 62 replaced with printf '%s' for raw content
  - shellcheck zero warnings on state-write.sh
files_touched:
  - scripts/state-write.sh
tdd: false
---

# PLAN-1.2: state-write.sh hardening (critical printf %b fix)

## Context

`state-write.sh` contains the most critical vulnerability: line 104 uses `printf '%b'`
with user-controlled content, which interprets backslash escape sequences. An attacker
could inject `\x` sequences through `--position` or `--blocker` arguments. This plan
also adds missing input validation for `--phase` and `--status`.

---

<task id="1" files="scripts/state-write.sh" tdd="false">
  <action>
  Add input validation immediately after the argument parsing while-loop (after line 58,
  before the raw content check).

  **Validate --phase as integer (issue #6)**

  Insert after line 58:
  ```bash
  # Validate inputs
  if [ -n "$PHASE" ] && ! [[ "$PHASE" =~ ^[0-9]+$ ]]; then
      echo "Error: --phase must be a positive integer, got '${PHASE}'" >&2
      exit 1
  fi
  ```

  **Validate --status against allowlist (issue #7)**

  Insert immediately after the phase validation:
  ```bash
  if [ -n "$STATUS" ]; then
      case "$STATUS" in
          ready|planned|planning|building|in_progress|complete|complete_with_gaps|shipped|blocked|paused)
              ;;
          *)
              echo "Error: --status must be one of: ready, planned, planning, building, in_progress, complete, complete_with_gaps, shipped, blocked, paused. Got '${STATUS}'" >&2
              exit 1
              ;;
      esac
  fi
  ```
  </action>
  <verify>shellcheck --severity=warning scripts/state-write.sh 2>&1 | head -20</verify>
  <done>--phase rejects non-integers. --status rejects values outside the allowlist.</done>
</task>

<task id="2" files="scripts/state-write.sh" tdd="false">
  <action>
  **Fix the critical printf '%b' format string injection (line 104, issue #1)**

  The current code on lines 77-104 builds `NEW_STATE` using `\n` literals inside
  double-quoted strings, then uses `printf '%b'` to interpret them. This also
  interprets any backslash sequences in user-supplied values like `$POSITION` or
  `$BLOCKER`.

  Replace the entire state-building block (lines 77-104) with a version that uses
  `printf '%s\n'` and explicit newlines. Replace lines 77 through 104 with:

  ```bash
      {
          printf '%s\n' "# Shipyard State" ""
          printf '%s\n' "**Last Updated:** ${TIMESTAMP}" ""

          if [ -n "$PHASE" ]; then
              printf '%s\n' "**Current Phase:** ${PHASE}"
          fi
          if [ -n "$POSITION" ]; then
              printf '%s\n' "**Current Position:** ${POSITION}"
          fi
          if [ -n "$STATUS" ]; then
              printf '%s\n' "**Status:** ${STATUS}"
          fi
          if [ -n "$BLOCKER" ]; then
              printf '%s\n' "" "## Blockers" "" "- ${BLOCKER}"
          fi

          # Preserve history section if it exists
          if echo "$EXISTING" | grep -q "## History"; then
              echo "$EXISTING" | sed -n '/## History/,$p'
          else
              printf '%s\n' "" "## History" ""
          fi

          # Append current action to history
          printf '%s\n' "- [${TIMESTAMP}] Phase ${PHASE:-?}: ${POSITION:-updated} (${STATUS:-unknown})"
      } > "$STATE_FILE"
  ```

  This eliminates the `printf '%b'` call entirely. Each line is written with
  `printf '%s\n'` which treats content as a literal string.
  </action>
  <verify>shellcheck --severity=warning scripts/state-write.sh</verify>
  <done>printf '%b' no longer appears in the file. All user-supplied values are written through '%s' format. shellcheck exits 0.</done>
</task>

<task id="3" files="scripts/state-write.sh" tdd="false">
  <action>
  **Fix echo for raw content (line 62, issue #9)**

  Replace line 62:
  ```bash
      echo "$RAW_CONTENT" > "$STATE_FILE"
  ```
  With:
  ```bash
      printf '%s\n' "$RAW_CONTENT" > "$STATE_FILE"
  ```

  This prevents `echo` from interpreting flags like `-n` or `-e` if
  `RAW_CONTENT` happens to start with a dash.

  **Final verification: run shellcheck and test injection scenario**

  ```bash
  shellcheck --severity=warning scripts/state-write.sh
  ```

  Test that backslash sequences in user input are preserved literally:
  ```bash
  mkdir -p .shipyard
  bash scripts/state-write.sh --phase 1 --position 'test\ninjection\x41' --status ready
  grep -c 'test\\ninjection\\x41' .shipyard/STATE.md  # should output 1
  ```
  </action>
  <verify>shellcheck --severity=warning scripts/state-write.sh && ! grep -q "printf '%b'" scripts/state-write.sh</verify>
  <done>No printf '%b' or bare echo for user content. shellcheck clean. Backslash sequences in input are preserved literally in output.</done>
</task>
