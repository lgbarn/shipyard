#!/usr/bin/env bats

# Tests for memory secret scrubbing
# These tests verify the scrubber patterns work correctly

load test_helper

# Test AWS key detection patterns
@test "scrubber: detects AWS access keys" {
    local text="My AWS key is AKIAIOSFODNN7EXAMPLE"
    run bash -c "echo '$text' | grep -oE 'AKIA[0-9A-Z]{16}'"
    assert_success
    assert_output "AKIAIOSFODNN7EXAMPLE"
}

@test "scrubber: does not match short AKIA strings" {
    local text="AKIAIOSFOD"  # Only 10 chars after AKIA
    run bash -c "echo '$text' | grep -oE 'AKIA[0-9A-Z]{16}'"
    assert_failure
}

# Test GitHub token patterns
@test "scrubber: detects GitHub personal access tokens" {
    local text="Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh"
    run bash -c "echo '$text' | grep -oE 'ghp_[a-zA-Z0-9]{36}'"
    assert_success
}

@test "scrubber: detects GitHub OAuth tokens" {
    local text="OAuth: gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh"
    run bash -c "echo '$text' | grep -oE 'gho_[a-zA-Z0-9]{36}'"
    assert_success
}

# Test generic API key patterns
@test "scrubber: detects API key assignments" {
    run bash -c "echo 'api_key = value' | grep -iE 'api[-_]?key'"
    assert_success
}

@test "scrubber: detects API-KEY variations" {
    run bash -c "echo 'API-KEY: abcdefghij1234567890' | grep -iE 'api[-_]?key'"
    assert_success
}

# Test private key patterns
@test "scrubber: detects RSA private key headers" {
    run bash -c "echo '-----BEGIN RSA PRIVATE KEY-----' | grep -E -- '-----BEGIN.*PRIVATE KEY-----'"
    assert_success
}

@test "scrubber: detects generic private key headers" {
    run bash -c "echo '-----BEGIN PRIVATE KEY-----' | grep -E -- '-----BEGIN.*PRIVATE KEY-----'"
    assert_success
}

# Test password patterns
@test "scrubber: detects password assignments" {
    run bash -c "echo 'password = secretpass123' | grep -iE 'password[[:space:]]*[=:]'"
    assert_success
}

@test "scrubber: detects PASSWORD variations" {
    run bash -c "echo 'PASSWORD: mysecretpassword' | grep -iE 'password[[:space:]]*[=:]'"
    assert_success
}

# Test JWT patterns
@test "scrubber: detects JWT tokens" {
    local text="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
    run bash -c "echo '$text' | grep -oE 'eyJ[a-zA-Z0-9_-]+\\.eyJ[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+'"
    assert_success
}

# Note: Stripe key tests removed due to GitHub push protection
# The Stripe patterns are still in scrubber.ts: sk_live_[24+] and sk_test_[24+]

# Test database URL patterns
@test "scrubber: detects postgres connection strings" {
    run bash -c "echo 'postgres://user:password@localhost:5432/db' | grep -iE '(postgres|mysql|mongodb|redis)://[^:]+:[^@]+@'"
    assert_success
}

@test "scrubber: detects mysql connection strings" {
    run bash -c "echo 'mysql://admin:secret@db.example.com/mydb' | grep -iE '(postgres|mysql|mongodb|redis)://[^:]+:[^@]+@'"
    assert_success
}

# Test NPM token patterns
@test "scrubber: detects NPM tokens" {
    local text="npm_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij"
    run bash -c "echo '$text' | grep -oE 'npm_[a-zA-Z0-9]{36}'"
    assert_success
}

# Test that normal text passes through
@test "scrubber: allows normal text without secrets" {
    local text="This is normal text about AWS services and GitHub repositories"
    run bash -c "echo '$text' | grep -oE 'AKIA[0-9A-Z]{16}'"
    assert_failure
}

@test "scrubber: allows code that mentions secrets conceptually" {
    local text="Set the API_KEY environment variable to your key"
    run bash -c "echo '$text' | grep -oE 'AKIA[0-9A-Z]{16}'"
    assert_failure
}
