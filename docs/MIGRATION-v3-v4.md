# Migration Guide: v3.x to v4.0.0

This guide covers everything you need to know when upgrading Shipyard from v3.x to v4.0.0. If you are still on v2.x, follow the two-step path in the [Upgrade Path](#upgrade-path) section below.

---

## Breaking Changes

### 1. v2-to-v3 migration code removed (MAINT-001)

The `migrate_state_md()` function has been deleted. This function automatically converted legacy `STATE.md` files (v2.x format) to the current `STATE.json` format.

**Impact:** If your project still has a legacy `STATE.md` file, Shipyard v4.0 will silently delete it instead of migrating it.

**Action required:** If you are on v2.x, upgrade to v3.6.1 first and run at least one session so the auto-migration completes before upgrading to v4.0.

### 2. `sanitize_lesson()` removed (SEC-001)

The function that filtered lesson content before writing it to state files has been removed. Lesson content is now written as-is.

**Impact:** None for typical users. The `.shipyard/` directory is documented as trusted local content — it is gitignored by default and should not contain untrusted input.

**Action required:** None.

### 3. `SHIPYARD_LOCK_RETRY_DELAY` env var removed (REL-002)

The `SHIPYARD_LOCK_RETRY_DELAY` environment variable no longer exists. Setting it has no effect.

**Impact:** Lock retry timing is no longer user-configurable. Retry delay now uses exponential backoff: starting at 0.05 seconds, doubling each retry, capped at 1.0 second. This replaces the previous fixed delay.

**Action required:** Remove `SHIPYARD_LOCK_RETRY_DELAY` from any scripts, CI configs, or shell profiles where you have set it. Use `SHIPYARD_LOCK_MAX_RETRIES` if you need to adjust the total retry budget (default: 120).

---

## New Features and Changed Defaults

### Lock retry: exponential backoff and higher default (REL-002)

The lock acquisition retry loop now uses exponential backoff instead of a fixed delay. Delay starts at 0.05 seconds, doubles each retry, and caps at 1.0 second. This reduces thundering-herd contention in parallel-agent sessions.

The default retry limit increased from 60 to 120 retries. This means the maximum wait time before a lock timeout is approximately 90 seconds under worst-case conditions. You can still tune the limit via `SHIPYARD_LOCK_MAX_RETRIES` (range: 1–600).

### Secrets pattern detection (SEC-002)

State file writes now check content for common secrets patterns (API keys, tokens, private keys). If a match is found, a warning is printed to stderr. The write is not blocked — this is advisory only.

### `.shipyard/.gitignore` auto-created (SEC-002)

On the first state file write, Shipyard automatically creates `.shipyard/.gitignore` with a wildcard (`*`) if it does not already exist. This ensures all local state remains gitignored even if `.shipyard/` itself is accidentally staged.

### Log rotation for marketplace-sync.log (REL-005)

`marketplace-sync.log` is now rotated when it grows large. Old log content is preserved in a `.1` backup file.

### `STATE_SCHEMA_VERSION` constant (MAINT-002)

The schema version integer is now a named constant (`STATE_SCHEMA_VERSION=3`) in both `state-write.sh` and `state-read.sh`. This is an internal change with no user-facing impact.

### Debugger agent available in marketplace installs (MAINT-004)

The `shipyard-debugger` agent definition is now included in marketplace installs, not just source checkouts. The `debug` command is available immediately after a fresh install.

---

## Upgrade Path

### From v3.x to v4.0.0

1. **Check your current version:**
   ```bash
   jq -r '.version' package.json
   ```

2. **Upgrade to v4.0.0** using your normal install method (Claude Code marketplace or manual).

3. **Remove `SHIPYARD_LOCK_RETRY_DELAY`** from any environment configuration if you had it set. It is now a no-op.

4. **Verify** the new version is active:
   ```bash
   shipyard version
   ```

### From v2.x to v4.0.0 (two-step)

Direct upgrade from v2.x to v4.0.0 is not supported. The migration code that converts legacy `STATE.md` files was removed in v4.0.0.

1. **Upgrade to v3.6.1 first.**

2. **Run one Shipyard session** on each project that has an active `STATE.md`. The auto-migration will convert it to `STATE.json` and archive the old file.
   ```bash
   shipyard status   # triggers migration if STATE.md exists
   ```

3. **Confirm migration completed** — `STATE.json` should exist and `STATE.md` should be gone:
   ```bash
   ls .shipyard/STATE.json    # should exist
   ls .shipyard/STATE.md      # should be absent
   ```

4. **Follow the v3.x to v4.0.0 steps above.**

---

## FAQ

**Q: I set `SHIPYARD_LOCK_RETRY_DELAY` in my CI pipeline. Will anything break?**

Setting this variable is now silently ignored. Your CI will continue to work — the lock retry will use exponential backoff. You can safely remove the variable. If you need more retries, use `SHIPYARD_LOCK_MAX_RETRIES` instead.

**Q: My project has a `STATE.md` file from an old session. What happens when I upgrade to v4.0?**

Shipyard v4.0 will silently delete the `STATE.md` file. If you have important state in it (current phase and position), upgrade to v3.6.1 first, run `shipyard status` to trigger the migration, and then upgrade to v4.0.

**Q: The secrets warning fires on my state file but it is a false positive. Can I suppress it?**

The warning is printed to stderr and does not block execution. It cannot be suppressed via a flag in v4.0. If it is a persistent false positive, the safest action is to ensure the value flagged is not actually a secret. The `.shipyard/` directory is gitignored, so the content is local-only regardless.

**Q: I am on v3.5.x. Do I need to go to v3.6.1 before upgrading?**

Only if your project still has a `STATE.md` file from a v2.x session. If you have been running v3.x normally, your state is already in `STATE.json` format and you can upgrade directly from any v3.x release to v4.0.0.

**Q: Does v4.0.0 change the STATE.json schema?**

No. The schema version remains `3`. Existing `STATE.json` files are fully compatible with v4.0.0. See [docs/STATE-SCHEMA.md](STATE-SCHEMA.md) for the complete schema reference.

**Q: Are there any new required environment variables in v4.0.0?**

No new environment variables are required. The full list of configurable variables is documented in the [README Environment Variables section](../README.md#environment-variables).
