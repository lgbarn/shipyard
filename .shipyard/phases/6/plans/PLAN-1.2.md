---
phase: developer-experience
plan: 2
wave: 1
dependencies: []
must_haves:
  - package.json version bumped to 2.0.0
  - package.json has engines field with node >= 16.0.0
  - package.json has systemDependencies field documenting bash/jq/git minimums
  - hooks/hooks.json has schemaVersion "2.0" as top-level field
  - npm test command works
files_touched:
  - package.json
  - hooks/hooks.json
tdd: false
---

# Plan 1.2: Package Version Bump and Schema Versioning

## Context

Shipyard is graduating to v2.0.0, reflecting the cumulative work from Phases 1-6. The `package.json` needs a version bump, an `engines` field for npm-standard node version, and a `systemDependencies` field for human-readable bash/jq/git minimums. The `hooks/hooks.json` needs a `schemaVersion: "2.0"` top-level field to enable future migration detection.

## Tasks

<task id="1" files="package.json" tdd="false">
  <action>
    Update `package.json` with these changes:

    1. Change `"version": "1.2.0"` to `"version": "2.0.0"`
    2. Add an `"engines"` field after the `"license"` field:
       ```json
       "engines": {
         "node": ">=16.0.0"
       }
       ```
    3. Add a `"systemDependencies"` field after `"engines"` (non-standard, documentation-only, ignored by npm):
       ```json
       "systemDependencies": {
         "bash": ">=4.0",
         "jq": ">=1.6",
         "git": ">=2.20"
       }
       ```
    4. Verify `"test": "bash test/run.sh"` script is still present (it already is; do not change it)
  </action>
  <verify>cd /Users/lgbarn/Personal/shipyard && grep -q '"version": "2.0.0"' package.json && node -e "const p = require('./package.json'); if (p.engines.node !== '>=16.0.0') process.exit(1); if (p.systemDependencies.bash !== '>=4.0') process.exit(1); if (p.scripts.test !== 'bash test/run.sh') process.exit(1);" && echo "PASS" || echo "FAIL"</verify>
  <done>package.json has version 2.0.0, engines.node >= 16.0.0, systemDependencies for bash/jq/git, and the existing test script is preserved.</done>
</task>

<task id="2" files="hooks/hooks.json" tdd="false">
  <action>
    Update `hooks/hooks.json` to add `"schemaVersion": "2.0"` as the first top-level field, before the existing `"hooks"` key:

    ```json
    {
      "schemaVersion": "2.0",
      "hooks": {
        "SessionStart": [
          {
            "matcher": "startup|resume|clear|compact",
            "hooks": [
              {
                "type": "command",
                "command": "${CLAUDE_PLUGIN_ROOT}/scripts/state-read.sh"
              }
            ]
          }
        ]
      }
    }
    ```

    The `hooks` object content must remain exactly unchanged. Only the new top-level `schemaVersion` field is added.
  </action>
  <verify>cd /Users/lgbarn/Personal/shipyard && jq -e '.schemaVersion == "2.0"' hooks/hooks.json > /dev/null && jq -e '.hooks.SessionStart[0].matcher == "startup|resume|clear|compact"' hooks/hooks.json > /dev/null && echo "PASS" || echo "FAIL"</verify>
  <done>hooks/hooks.json contains schemaVersion "2.0" and the hooks object is unchanged.</done>
</task>

<task id="3" files="package.json" tdd="false">
  <action>
    Run `npm test` from the repository root to confirm the test script still works after the version bump. This is a gate verification, not a code change.
  </action>
  <verify>cd /Users/lgbarn/Personal/shipyard && npm test 2>&1 | tail -5</verify>
  <done>npm test executes successfully (exit code 0) and all existing tests pass.</done>
</task>
