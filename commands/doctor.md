---
description: "Check Shipyard plugin health and dependencies"
disable-model-invocation: true
argument-hint: ""
---

# /shipyard:doctor — Plugin Health Check

You are executing the Shipyard doctor diagnostic. Follow these steps precisely.

<execution>

## Step 1: Check Dependencies

Run each check and record pass/fail:

```bash
# 1. jq installed
command -v jq >/dev/null 2>&1 && echo "PASS: jq found ($(jq --version))" || echo "FAIL: jq not found — install with: brew install jq (macOS) or apt install jq (Linux)"

# 2. git installed
command -v git >/dev/null 2>&1 && echo "PASS: git found ($(git --version))" || echo "FAIL: git not found"

# 3. gh CLI (optional)
command -v gh >/dev/null 2>&1 && echo "PASS: gh found ($(gh --version | head -1))" || echo "INFO: gh not found — optional, needed for PR workflows"
```

## Step 2: Check Plugin Structure

Verify the Shipyard plugin files are intact:

```bash
# Check plugin root has expected files
PLUGIN_ROOT="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")/.." && pwd)"
```

Verify these exist:
- `plugin.json` — Plugin manifest
- `hooks/` — Hook scripts directory
- `scripts/` — Script files
- `skills/` — Skill definitions
- `commands/` — Command definitions

Report any missing items.

## Step 3: Check Skills Discoverable

```bash
# Count discoverable skills
skill_count=$(find skills/ -name "SKILL.md" -maxdepth 2 2>/dev/null | wc -l | tr -d ' ')
echo "Skills discovered: ${skill_count}"
```

List all discovered skills by name.

## Step 4: Check Hooks Registered

Read `plugin.json` and verify hooks are defined:
- `SessionStart` hook → `scripts/state-read.sh`
- `PreToolUse` hooks (if any)
- `PostToolUse` hooks (if any)

Verify each hook script file exists and is executable.

## Step 5: Check Project State (if .shipyard/ exists)

If `.shipyard/` exists:
- Verify `.shipyard/` is NOT a symlink
- Check `STATE.json` exists and is valid JSON with required fields (`schema`, `phase`, `status`)
- Check `config.json` exists and is valid JSON
- Check `HISTORY.md` exists
- Report any missing or corrupt files

If `.shipyard/` does not exist:
> "No Shipyard project in current directory. Run `/shipyard:init` to set up."

</execution>

<output>

## Step 6: Summary Report

Display results:

```
Shipyard Doctor
═══════════════════════════════════════════

Dependencies:
  jq          {PASS|FAIL}
  git         {PASS|FAIL}
  gh          {PASS|INFO: optional}

Plugin Structure:
  plugin.json  {PASS|FAIL}
  hooks/       {PASS|FAIL}
  scripts/     {PASS|FAIL}
  skills/      {PASS|FAIL} ({N} skills)
  commands/    {PASS|FAIL} ({N} commands)

Hooks:
  SessionStart {PASS|FAIL}

Project State:
  .shipyard/   {PASS|NOT FOUND|CORRUPT}
  STATE.json   {PASS|MISSING|CORRUPT}
  config.json  {PASS|MISSING}

Result: {All checks passed | N issues found}
```

If any FAIL results, provide specific remediation steps.

</output>
