#!/usr/bin/env bats
load test_helper

MARKETPLACE_SYNC="${PROJECT_ROOT}/scripts/marketplace-sync.sh"

setup() {
    # Override HOME so the script uses our temp dirs for config and marketplace
    export ORIG_HOME="$HOME"
    export HOME="${BATS_TEST_TMPDIR}/fakehome"
    mkdir -p "$HOME"
}

teardown() {
    export HOME="$ORIG_HOME"
    unset ORIG_HOME
}

# Helper: create a fake marketplace git repo
setup_marketplace_repo() {
    local mkt_dir="${HOME}/.claude/plugins/marketplaces/shipyard"
    mkdir -p "$mkt_dir"
    cd "$mkt_dir"
    git init -q
    git config user.email "test@shipyard.dev"
    git config user.name "Shipyard Test"
    mkdir -p .claude-plugin
    echo '{"name":"test","version":"1.0.0"}' > .claude-plugin/plugin.json
    git add .
    git commit -q -m "initial"
    cd "$BATS_TEST_TMPDIR"
    echo "$mkt_dir"
}

# --- Missing marketplace directory ---

# bats test_tags=unit
@test "marketplace-sync: exits 0 when marketplace directory does not exist" {
    # HOME is set to fakehome, which has no .claude/plugins/... directory
    run bash "$MARKETPLACE_SYNC"
    assert_success
    assert_output ""
}

# --- Throttle: sync less than 1 hour ago ---

# bats test_tags=unit
@test "marketplace-sync: skips sync when timestamp is recent" {
    local config_dir="${HOME}/.config/shipyard"
    mkdir -p "$config_dir"

    # Set timestamp to "now" — well within 3600s cooldown
    date +%s > "${config_dir}/marketplace-sync.last"

    # Create a marketplace dir (but don't need a real repo since throttle exits first)
    mkdir -p "${HOME}/.claude/plugins/marketplaces/shipyard/.git"

    run bash "$MARKETPLACE_SYNC"
    assert_success
    assert_output ""
}

# --- Non-numeric timestamp ---

# bats test_tags=unit
@test "marketplace-sync: handles non-numeric timestamp gracefully" {
    local config_dir="${HOME}/.config/shipyard"
    mkdir -p "$config_dir"
    echo "not-a-number" > "${config_dir}/marketplace-sync.last"

    # Create marketplace dir so we get past the early exit
    mkdir -p "${HOME}/.claude/plugins/marketplaces/shipyard/.git"

    # Non-numeric timestamp is reset to 0, so sync proceeds (exits 0)
    run bash "$MARKETPLACE_SYNC"
    assert_success
}

# --- Successful sync updates timestamp ---

# bats test_tags=integration
@test "marketplace-sync: updates timestamp file on sync attempt" {
    local config_dir="${HOME}/.config/shipyard"
    mkdir -p "$config_dir"

    # Create a real marketplace repo
    local mkt_dir
    mkt_dir=$(setup_marketplace_repo)

    # Set up a remote so fetch has something to fetch from
    local remote_dir="${BATS_TEST_TMPDIR}/remote"
    git clone -q --bare "$mkt_dir" "$remote_dir"
    git -C "$mkt_dir" remote remove origin 2>/dev/null || true
    git -C "$mkt_dir" remote add origin "$remote_dir"

    # Ensure no recent timestamp (force sync)
    echo "0" > "${config_dir}/marketplace-sync.last"

    local before
    before=$(date +%s)

    run bash "$MARKETPLACE_SYNC"
    assert_success

    # Timestamp file should have been updated
    [ -f "${config_dir}/marketplace-sync.last" ]
    local ts
    ts=$(cat "${config_dir}/marketplace-sync.last")

    # Timestamp should be >= before (within a few seconds)
    [ "$ts" -ge "$before" ]
}

# --- Log rotation ---

# bats test_tags=unit
@test "marketplace-sync: log rotation trims file over 100KB" {
    mkdir -p "${HOME}/.config/shipyard"
    local logfile="${HOME}/.config/shipyard/marketplace-sync.log"

    # Create a log file larger than 100KB (~105KB = 1050 lines of ~100 chars each)
    for i in $(seq 1 1050); do
        printf '[2026-01-01T00:00:00Z] Line %04d padding to make this line about one hundred characters long xxxx\n' "$i"
    done > "$logfile"

    local size_before
    size_before=$(wc -c < "$logfile")
    # Confirm it is over 102400 bytes
    (( size_before > 102400 ))

    # Set up conditions so the script runs the log path (needs marketplace dir with .git)
    mkdir -p "${HOME}/.claude/plugins/marketplaces/shipyard/.git"

    # Remove cooldown timestamp so the script proceeds past throttle check
    rm -f "${HOME}/.config/shipyard/marketplace-sync.last"

    # The fetch will fail (no real remote), but log() will be called with the failure message
    # which triggers the rotation check
    run bash "$MARKETPLACE_SYNC"

    # After rotation, the log should be significantly smaller (500 lines + 1 new entry)
    local size_after
    size_after=$(wc -c < "$logfile")
    (( size_after < size_before ))

    # Should have approximately 501 lines (500 kept + 1 new log entry)
    local line_count
    line_count=$(wc -l < "$logfile")
    (( line_count <= 510 ))
}

# --- No .git directory means not a git repo → exits 0 ---

# bats test_tags=unit
@test "marketplace-sync: exits 0 when marketplace dir exists but has no .git" {
    mkdir -p "${HOME}/.claude/plugins/marketplaces/shipyard"
    # No .git inside — script should exit 0 silently

    run bash "$MARKETPLACE_SYNC"
    assert_success
    assert_output ""
}
