"use strict";
/**
 * Tests for the secret scrubber module
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const scrubber_1 = require("../scrubber");
(0, vitest_1.describe)('scrubSecrets', () => {
    (0, vitest_1.describe)('AWS keys', () => {
        (0, vitest_1.it)('should redact AWS access keys', () => {
            const text = 'My AWS key is AKIAIOSFODNN7EXAMPLE';
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toBe('My AWS key is [REDACTED]');
            (0, vitest_1.expect)(result.redactionCount).toBe(1);
            (0, vitest_1.expect)(result.redactedTypes).toContain('AWS Access Key');
        });
        (0, vitest_1.it)('should not match short AKIA strings', () => {
            const text = 'AKIASHORT is not a valid key';
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toBe(text);
            (0, vitest_1.expect)(result.redactionCount).toBe(0);
        });
    });
    (0, vitest_1.describe)('GitHub tokens', () => {
        (0, vitest_1.it)('should redact GitHub personal access tokens', () => {
            // GitHub tokens are 36 chars after the prefix
            const text = 'Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toBe('Token: [REDACTED]');
            (0, vitest_1.expect)(result.redactionCount).toBe(1);
            (0, vitest_1.expect)(result.redactedTypes).toContain('GitHub Token');
        });
        (0, vitest_1.it)('should redact GitHub OAuth tokens', () => {
            const text = 'OAuth: gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toBe('OAuth: [REDACTED]');
            (0, vitest_1.expect)(result.redactedTypes).toContain('GitHub OAuth Token');
        });
        (0, vitest_1.it)('should redact GitHub App tokens', () => {
            const text = 'App: ghu_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toBe('App: [REDACTED]');
            (0, vitest_1.expect)(result.redactedTypes).toContain('GitHub App Token');
        });
    });
    (0, vitest_1.describe)('generic API keys', () => {
        (0, vitest_1.it)('should redact api_key assignments', () => {
            const text = 'api_key = "sk_live_1234567890abcdefghij"';
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toContain('[REDACTED]');
            (0, vitest_1.expect)(result.redactionCount).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('should redact API-KEY variations', () => {
            const text = 'API-KEY: abcdefghij1234567890abcd';
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toContain('[REDACTED]');
        });
    });
    (0, vitest_1.describe)('private keys', () => {
        (0, vitest_1.it)('should redact RSA private key blocks', () => {
            const text = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----`;
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toBe('[REDACTED]');
            (0, vitest_1.expect)(result.redactedTypes).toContain('Private Key Header');
        });
        (0, vitest_1.it)('should redact generic private key blocks', () => {
            const text = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...
-----END PRIVATE KEY-----`;
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toBe('[REDACTED]');
        });
    });
    (0, vitest_1.describe)('passwords', () => {
        (0, vitest_1.it)('should redact password assignments', () => {
            const text = 'password = "secretpass123"';
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toContain('[REDACTED]');
            (0, vitest_1.expect)(result.redactedTypes).toContain('Password Assignment');
        });
        (0, vitest_1.it)('should redact PASSWORD: format', () => {
            const text = 'PASSWORD: mysecretpassword';
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toContain('[REDACTED]');
        });
    });
    (0, vitest_1.describe)('bearer tokens', () => {
        (0, vitest_1.it)('should redact Bearer tokens', () => {
            const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toContain('[REDACTED]');
            (0, vitest_1.expect)(result.redactedTypes).toContain('Bearer Token');
        });
    });
    // Note: Stripe key tests removed due to GitHub push protection
    // The Stripe patterns are still in scrubber.ts and will be tested manually
    // Patterns: sk_live_[24+ chars] and sk_test_[24+ chars]
    (0, vitest_1.describe)('database URLs', () => {
        (0, vitest_1.it)('should redact postgres connection strings', () => {
            const text = 'DATABASE_URL=postgres://user:password@localhost:5432/db';
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toContain('[REDACTED]');
            (0, vitest_1.expect)(result.redactedTypes).toContain('Database URL');
        });
        (0, vitest_1.it)('should redact mysql connection strings', () => {
            const text = 'mysql://admin:secret@db.example.com/mydb';
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toContain('[REDACTED]');
        });
        (0, vitest_1.it)('should redact mongodb connection strings', () => {
            const text = 'mongodb://user:pass@cluster.mongodb.net/database';
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toContain('[REDACTED]');
        });
    });
    (0, vitest_1.describe)('JWT tokens', () => {
        (0, vitest_1.it)('should redact JWT tokens', () => {
            const text = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toBe('[REDACTED]');
            (0, vitest_1.expect)(result.redactedTypes).toContain('JWT Token');
        });
    });
    (0, vitest_1.describe)('multiple secrets', () => {
        (0, vitest_1.it)('should redact multiple secrets in the same text', () => {
            const text = `
        AWS_KEY=AKIAIOSFODNN7EXAMPLE
        GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij
        password = "secret123"
      `;
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.redactionCount).toBe(3);
            (0, vitest_1.expect)(result.text).not.toContain('AKIAIOSFODNN7EXAMPLE');
            (0, vitest_1.expect)(result.text).not.toContain('ghp_');
            (0, vitest_1.expect)(result.text).not.toContain('secret123');
        });
    });
    (0, vitest_1.describe)('safe text', () => {
        (0, vitest_1.it)('should not modify text without secrets', () => {
            const text = 'This is normal text about AWS services and GitHub repositories';
            const result = (0, scrubber_1.scrubSecrets)(text);
            (0, vitest_1.expect)(result.text).toBe(text);
            (0, vitest_1.expect)(result.redactionCount).toBe(0);
            (0, vitest_1.expect)(result.redactedTypes).toHaveLength(0);
        });
        (0, vitest_1.it)('should allow mentions of secret concepts without actual values', () => {
            const text = 'Set the API_KEY environment variable to your key';
            const result = (0, scrubber_1.scrubSecrets)(text);
            // This shouldn't be redacted because there's no actual key value
            (0, vitest_1.expect)(result.redactionCount).toBe(0);
        });
    });
});
(0, vitest_1.describe)('containsSecrets', () => {
    (0, vitest_1.it)('should return true when text contains secrets', () => {
        (0, vitest_1.expect)((0, scrubber_1.containsSecrets)('key: AKIAIOSFODNN7EXAMPLE')).toBe(true);
        (0, vitest_1.expect)((0, scrubber_1.containsSecrets)('token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij')).toBe(true);
    });
    (0, vitest_1.it)('should return false when text is clean', () => {
        (0, vitest_1.expect)((0, scrubber_1.containsSecrets)('Hello, world!')).toBe(false);
        (0, vitest_1.expect)((0, scrubber_1.containsSecrets)('Talk about AWS and GitHub')).toBe(false);
    });
});
(0, vitest_1.describe)('analyzeSecrets', () => {
    (0, vitest_1.it)('should return counts of each secret type found', () => {
        const text = `
      AKIAIOSFODNN7EXAMPLE
      AKIAIOSFODNN7EXAMPL2
      ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij
    `;
        const analysis = (0, scrubber_1.analyzeSecrets)(text);
        const awsCount = analysis.find((a) => a.type === 'AWS Access Key')?.count;
        const ghCount = analysis.find((a) => a.type === 'GitHub Token')?.count;
        (0, vitest_1.expect)(awsCount).toBe(2);
        (0, vitest_1.expect)(ghCount).toBe(1);
    });
    (0, vitest_1.it)('should return empty array for clean text', () => {
        const analysis = (0, scrubber_1.analyzeSecrets)('Hello, this is clean text');
        (0, vitest_1.expect)(analysis).toHaveLength(0);
    });
});
//# sourceMappingURL=scrubber.test.js.map