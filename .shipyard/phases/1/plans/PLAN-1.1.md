---
phase: security-hardening
plan: "1.1"
wave: 1
dependencies: []
must_haves:
  - .gitignore covers OS files, editor files, node_modules, secrets, .shipyard dev state
  - checkpoint.sh DAYS validated as integer
  - checkpoint.sh LABEL sanitized (no shell metacharacters in git tag)
  - checkpoint.sh word-splitting on git tag -l output fixed
  - shellcheck zero warnings on checkpoint.sh
files_touched:
  - .gitignore
  - scripts/checkpoint.sh
tdd: false
---

# PLAN-1.1: .gitignore + checkpoint.sh hardening

## Context

`checkpoint.sh` is the smallest script (41 lines) with 3 issues. The `.gitignore` is a
standalone new file. Grouping them keeps this plan small and fast.

---

<task id="1" files=".gitignore" tdd="false">
  <action>
  Create `.gitignore` at the repository root with the following content:

  ```
  # OS
  .DS_Store
  Thumbs.db

  # Editors
  *.swp
  *.swo
  *~
  .idea/
  .vscode/
  *.sublime-project
  *.sublime-workspace

  # Dependencies
  node_modules/

  # Shipyard dev state (committed selectively, not wholesale)
  .shipyard/

  # Secrets
  .env
  .env.*
  credentials.json
  *.pem
  *.key
  ```
  </action>
  <verify>test -f .gitignore && grep -q '.DS_Store' .gitignore && grep -q '.shipyard/' .gitignore</verify>
  <done>.gitignore exists and covers all required categories.</done>
</task>

<task id="2" files="scripts/checkpoint.sh" tdd="false">
  <action>
  Apply three fixes to `scripts/checkpoint.sh`:

  **Fix 1 -- Validate DAYS as integer (line 17)**

  After line 17 (`DAYS="${2:-30}"`), insert validation:

  ```bash
  if ! [[ "$DAYS" =~ ^[0-9]+$ ]]; then
      echo "Error: --prune argument must be a positive integer, got '${DAYS}'" >&2
      exit 1
  fi
  ```

  **Fix 2 -- Sanitize LABEL for git tag (line 31)**

  Replace line 31:
  ```bash
  LABEL="${1:-auto}"
  ```
  With:
  ```bash
  LABEL=$(printf '%s' "${1:-auto}" | tr -cd 'a-zA-Z0-9._-')
  LABEL="${LABEL#-}"  # strip leading hyphen to prevent git flag injection
  if [ -z "$LABEL" ]; then
      echo "Error: label must contain at least one alphanumeric character, dot, underscore, or hyphen" >&2
      exit 1
  fi
  if [ "${#LABEL}" -gt 64 ]; then
      LABEL="${LABEL:0:64}"
  fi
  ```

  **Fix 3 -- Fix word-splitting on git tag -l (line 20, SC2012/SC2013)**

  Replace line 20:
  ```bash
  for tag in $(git tag -l "shipyard-checkpoint-*" 2>/dev/null); do
  ```
  With:
  ```bash
  while IFS= read -r tag; do
      [ -z "$tag" ] && continue
  ```

  And replace the closing `done` on line 26 with:
  ```bash
  done < <(git tag -l "shipyard-checkpoint-*" 2>/dev/null)
  ```

  This replaces the for-loop-over-command-output pattern with a while-read loop
  fed by process substitution, which correctly handles tags with unusual characters.
  </action>
  <verify>shellcheck --severity=warning scripts/checkpoint.sh</verify>
  <done>shellcheck exits 0. DAYS rejects non-integers. LABEL strips unsafe characters. Tag iteration uses while-read.</done>
</task>

<task id="3" files="scripts/checkpoint.sh" tdd="false">
  <action>
  Manually test the fixes by running:

  ```bash
  # Should fail with error message
  bash scripts/checkpoint.sh --prune "5; rm -rf /"

  # Should strip special chars, resulting in label "testlabel"
  bash scripts/checkpoint.sh 'test<label>'

  # Should work normally
  bash scripts/checkpoint.sh "valid-label_1.0"
  ```

  Verify each command produces expected output. Clean up any test tags with
  `git tag -d` afterward.
  </action>
  <verify>shellcheck --severity=warning scripts/checkpoint.sh && bash scripts/checkpoint.sh --prune abc 2>&1 | grep -q "positive integer"</verify>
  <done>All manual tests pass. shellcheck clean. Injection vectors neutralized.</done>
</task>
