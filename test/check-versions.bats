#!/usr/bin/env bats
load test_helper

CHECK_VERSIONS="${PROJECT_ROOT}/scripts/check-versions.sh"

# Helper: create a fake project root with version files all at the same version
setup_version_fixture() {
    local version="${1:-1.2.3}"
    local root="${BATS_TEST_TMPDIR}/fake-project"

    mkdir -p "${root}/scripts"
    mkdir -p "${root}/.claude-plugin"

    # Symlink the real script so SCRIPT_DIR resolves to our fake root/scripts
    cp "$CHECK_VERSIONS" "${root}/scripts/check-versions.sh"

    # package.json
    cat > "${root}/package.json" <<EOF
{"name":"test","version":"${version}"}
EOF

    # package-lock.json (has version at root AND packages[""].version)
    cat > "${root}/package-lock.json" <<EOF
{"name":"test","version":"${version}","lockfileVersion":3,"packages":{"":{"name":"test","version":"${version}"}}}
EOF

    # plugin.json
    cat > "${root}/.claude-plugin/plugin.json" <<EOF
{"name":"test","version":"${version}"}
EOF

    # marketplace.json
    cat > "${root}/.claude-plugin/marketplace.json" <<EOF
{"plugins":[{"name":"test","version":"${version}"}]}
EOF

    echo "$root"
}

# --- All versions match ---

# bats test_tags=unit
@test "check-versions: exits 0 when all versions match" {
    local root
    root=$(setup_version_fixture "4.5.6")
    run bash "${root}/scripts/check-versions.sh"
    assert_success
    assert_output --partial "All versions in sync: 4.5.6"
}

# --- package-lock.json root version mismatch ---

# bats test_tags=unit
@test "check-versions: detects package-lock.json root version mismatch" {
    local root
    root=$(setup_version_fixture "2.0.0")

    # Change the lock root version
    cat > "${root}/package-lock.json" <<'EOF'
{"name":"test","version":"9.9.9","lockfileVersion":3,"packages":{"":{"name":"test","version":"2.0.0"}}}
EOF

    run bash "${root}/scripts/check-versions.sh"
    assert_failure
    assert_output --partial "package-lock.json root version (9.9.9) != package.json (2.0.0)"
}

# --- package-lock.json packages version mismatch ---

# bats test_tags=unit
@test "check-versions: detects package-lock.json packages version mismatch" {
    local root
    root=$(setup_version_fixture "2.0.0")

    cat > "${root}/package-lock.json" <<'EOF'
{"name":"test","version":"2.0.0","lockfileVersion":3,"packages":{"":{"name":"test","version":"8.8.8"}}}
EOF

    run bash "${root}/scripts/check-versions.sh"
    assert_failure
    assert_output --partial "package-lock.json packages version (8.8.8) != package.json (2.0.0)"
}

# --- plugin.json mismatch ---

# bats test_tags=unit
@test "check-versions: detects plugin.json version mismatch" {
    local root
    root=$(setup_version_fixture "3.0.0")

    cat > "${root}/.claude-plugin/plugin.json" <<'EOF'
{"name":"test","version":"1.0.0"}
EOF

    run bash "${root}/scripts/check-versions.sh"
    assert_failure
    assert_output --partial "plugin.json version (1.0.0) != package.json (3.0.0)"
}

# --- marketplace.json mismatch ---

# bats test_tags=unit
@test "check-versions: detects marketplace.json version mismatch" {
    local root
    root=$(setup_version_fixture "3.0.0")

    cat > "${root}/.claude-plugin/marketplace.json" <<'EOF'
{"plugins":[{"name":"test","version":"7.7.7"}]}
EOF

    run bash "${root}/scripts/check-versions.sh"
    assert_failure
    assert_output --partial "marketplace.json version (7.7.7) != package.json (3.0.0)"
}

# --- Multiple mismatches ---

# bats test_tags=unit
@test "check-versions: reports count of multiple mismatches" {
    local root
    root=$(setup_version_fixture "1.0.0")

    # Break plugin.json and marketplace.json
    cat > "${root}/.claude-plugin/plugin.json" <<'EOF'
{"name":"test","version":"2.0.0"}
EOF
    cat > "${root}/.claude-plugin/marketplace.json" <<'EOF'
{"plugins":[{"name":"test","version":"3.0.0"}]}
EOF

    run bash "${root}/scripts/check-versions.sh"
    assert_failure
    assert_output --partial "Found 2 version mismatch(es)"
}

# --- Missing required file ---

# bats test_tags=unit
@test "check-versions: fails when package.json is missing" {
    local root
    root=$(setup_version_fixture "1.0.0")
    rm "${root}/package.json"

    run bash "${root}/scripts/check-versions.sh"
    assert_failure
}

# bats test_tags=unit
@test "check-versions: fails when plugin.json is missing" {
    local root
    root=$(setup_version_fixture "1.0.0")
    rm "${root}/.claude-plugin/plugin.json"

    run bash "${root}/scripts/check-versions.sh"
    assert_failure
}
