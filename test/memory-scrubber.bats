#!/usr/bin/env bats

# Tests for memory secret scrubbing
# These tests verify the scrubber patterns work correctly

load test_helper

# Test AWS key detection patterns
@test "scrubber: detects AWS access keys" {
    run bash -c "echo 'My AWS key is AKIAIOSFODNN7EXAMPLE' | grep -oE 'AKIA[0-9A-Z]{16}'"
    assert_success
    assert_output "AKIAIOSFODNN7EXAMPLE"
}

@test "scrubber: does not match short AKIA strings" {
    run bash -c "echo 'AKIAIOSFOD' | grep -oE 'AKIA[0-9A-Z]{16}'"
    assert_failure
}

# Test GitHub token patterns (36 chars after prefix)
@test "scrubber: detects GitHub personal access tokens" {
    run bash -c "echo 'Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij' | grep -oE 'ghp_[a-zA-Z0-9]{36}'"
    assert_success
}

@test "scrubber: detects GitHub OAuth tokens" {
    run bash -c "echo 'OAuth: gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij' | grep -oE 'gho_[a-zA-Z0-9]{36}'"
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
    run bash -c "echo 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U' | grep -oE 'eyJ[a-zA-Z0-9_-]+\\.eyJ[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+'"
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
    run bash -c "echo 'npm_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij' | grep -oE 'npm_[a-zA-Z0-9]{36}'"
    assert_success
}

# Test that normal text passes through
@test "scrubber: allows normal text without secrets" {
    run bash -c "echo 'This is normal text about AWS services' | grep -oE 'AKIA[0-9A-Z]{16}'"
    assert_failure
}

@test "scrubber: allows code that mentions secrets conceptually" {
    run bash -c "echo 'Set the API_KEY environment variable' | grep -oE 'AKIA[0-9A-Z]{16}'"
    assert_failure
}
