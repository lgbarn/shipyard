#!/usr/bin/env bats
load test_helper

BUILD_CODEX="${PROJECT_ROOT}/scripts/build-codex.sh"
CHECK_SYNC="${PROJECT_ROOT}/scripts/check-codex-sync.sh"

# bats test_tags=unit
@test "build-codex: generates a valid Codex plugin manifest" {
    run bash "$BUILD_CODEX" "${BATS_TEST_TMPDIR}"
    assert_success

    local manifest="${BATS_TEST_TMPDIR}/plugins/shipyard/.codex-plugin/plugin.json"
    [ -f "$manifest" ]
    run jq -e '.skills == "./skills/" and .interface.displayName == "Shipyard"' "$manifest"
    assert_success
}

# bats test_tags=unit
@test "build-codex: codex plugin version matches package.json" {
    bash "$BUILD_CODEX" "${BATS_TEST_TMPDIR}"
    local pkg gen
    pkg=$(jq -r '.version' "${PROJECT_ROOT}/package.json")
    gen=$(jq -r '.version' "${BATS_TEST_TMPDIR}/plugins/shipyard/.codex-plugin/plugin.json")
    [ "$pkg" = "$gen" ]
}

# bats test_tags=unit
@test "build-codex: marketplace path resolves to the plugin dir" {
    bash "$BUILD_CODEX" "${BATS_TEST_TMPDIR}"
    local path
    path=$(jq -r '.plugins[0].source.path' "${BATS_TEST_TMPDIR}/.agents/plugins/marketplace.json")
    [ -d "${BATS_TEST_TMPDIR}/${path}" ]
    [ -f "${BATS_TEST_TMPDIR}/${path}/.codex-plugin/plugin.json" ]
}

# bats test_tags=unit
@test "build-codex: copies the using-shipyard skill byte-for-byte" {
    bash "$BUILD_CODEX" "${BATS_TEST_TMPDIR}"
    run diff "${PROJECT_ROOT}/skills/using-shipyard/SKILL.md" \
        "${BATS_TEST_TMPDIR}/plugins/shipyard/skills/using-shipyard/SKILL.md"
    assert_success
}

# bats test_tags=unit
@test "build-codex: emits every canonical skill, byte-for-byte" {
    bash "$BUILD_CODEX" "${BATS_TEST_TMPDIR}"

    local src_count gen_count
    src_count=$(find "${PROJECT_ROOT}/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l)
    gen_count=$(find "${BATS_TEST_TMPDIR}/plugins/shipyard/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l)
    [ "$src_count" -eq "$gen_count" ]
    [ "$gen_count" -gt 1 ]

    # every canonical skill is present and identical in the generated tree
    for src in "${PROJECT_ROOT}"/skills/*/SKILL.md; do
        local name
        name="$(basename "$(dirname "$src")")"
        diff "$src" "${BATS_TEST_TMPDIR}/plugins/shipyard/skills/${name}/SKILL.md"
    done
}

# bats test_tags=unit
@test "build-codex: committed Codex tree is in sync with generator output" {
    run bash "$CHECK_SYNC"
    assert_success
    assert_output --partial "in sync"
}
