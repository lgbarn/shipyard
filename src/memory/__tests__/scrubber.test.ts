/**
 * Tests for the secret scrubber module
 */

import { describe, it, expect } from 'vitest';
import { scrubSecrets, containsSecrets, analyzeSecrets } from '../scrubber';

describe('scrubSecrets', () => {
  describe('AWS keys', () => {
    it('should redact AWS access keys', () => {
      const text = 'My AWS key is AKIAIOSFODNN7EXAMPLE';
      const result = scrubSecrets(text);
      expect(result.text).toBe('My AWS key is [REDACTED]');
      expect(result.redactionCount).toBe(1);
      expect(result.redactedTypes).toContain('AWS Access Key');
    });

    it('should not match short AKIA strings', () => {
      const text = 'AKIASHORT is not a valid key';
      const result = scrubSecrets(text);
      expect(result.text).toBe(text);
      expect(result.redactionCount).toBe(0);
    });
  });

  describe('GitHub tokens', () => {
    it('should redact GitHub personal access tokens', () => {
      // GitHub tokens are 36 chars after the prefix
      const text = 'Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
      const result = scrubSecrets(text);
      expect(result.text).toBe('Token: [REDACTED]');
      expect(result.redactionCount).toBe(1);
      expect(result.redactedTypes).toContain('GitHub Token');
    });

    it('should redact GitHub OAuth tokens', () => {
      const text = 'OAuth: gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
      const result = scrubSecrets(text);
      expect(result.text).toBe('OAuth: [REDACTED]');
      expect(result.redactedTypes).toContain('GitHub OAuth Token');
    });

    it('should redact GitHub App tokens', () => {
      const text = 'App: ghu_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
      const result = scrubSecrets(text);
      expect(result.text).toBe('App: [REDACTED]');
      expect(result.redactedTypes).toContain('GitHub App Token');
    });
  });

  describe('generic API keys', () => {
    it('should redact api_key assignments', () => {
      const text = 'api_key = "sk_live_1234567890abcdefghij"';
      const result = scrubSecrets(text);
      expect(result.text).toContain('[REDACTED]');
      expect(result.redactionCount).toBeGreaterThan(0);
    });

    it('should redact API-KEY variations', () => {
      const text = 'API-KEY: abcdefghij1234567890abcd';
      const result = scrubSecrets(text);
      expect(result.text).toContain('[REDACTED]');
    });
  });

  describe('private keys', () => {
    it('should redact RSA private key blocks', () => {
      const text = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----`;
      const result = scrubSecrets(text);
      expect(result.text).toBe('[REDACTED]');
      expect(result.redactedTypes).toContain('Private Key Header');
    });

    it('should redact generic private key blocks', () => {
      const text = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...
-----END PRIVATE KEY-----`;
      const result = scrubSecrets(text);
      expect(result.text).toBe('[REDACTED]');
    });
  });

  describe('passwords', () => {
    it('should redact password assignments', () => {
      const text = 'password = "secretpass123"';
      const result = scrubSecrets(text);
      expect(result.text).toContain('[REDACTED]');
      expect(result.redactedTypes).toContain('Password Assignment');
    });

    it('should redact PASSWORD: format', () => {
      const text = 'PASSWORD: mysecretpassword';
      const result = scrubSecrets(text);
      expect(result.text).toContain('[REDACTED]');
    });
  });

  describe('bearer tokens', () => {
    it('should redact Bearer tokens', () => {
      const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const result = scrubSecrets(text);
      expect(result.text).toContain('[REDACTED]');
      expect(result.redactedTypes).toContain('Bearer Token');
    });
  });

  // Note: Stripe key tests removed due to GitHub push protection
  // The Stripe patterns are still in scrubber.ts and will be tested manually
  // Patterns: sk_live_[24+ chars] and sk_test_[24+ chars]

  describe('database URLs', () => {
    it('should redact postgres connection strings', () => {
      const text = 'DATABASE_URL=postgres://user:password@localhost:5432/db';
      const result = scrubSecrets(text);
      expect(result.text).toContain('[REDACTED]');
      expect(result.redactedTypes).toContain('Database URL');
    });

    it('should redact mysql connection strings', () => {
      const text = 'mysql://admin:secret@db.example.com/mydb';
      const result = scrubSecrets(text);
      expect(result.text).toContain('[REDACTED]');
    });

    it('should redact mongodb connection strings', () => {
      const text = 'mongodb://user:pass@cluster.mongodb.net/database';
      const result = scrubSecrets(text);
      expect(result.text).toContain('[REDACTED]');
    });
  });

  describe('JWT tokens', () => {
    it('should redact JWT tokens', () => {
      const text =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = scrubSecrets(text);
      expect(result.text).toBe('[REDACTED]');
      expect(result.redactedTypes).toContain('JWT Token');
    });
  });

  describe('multiple secrets', () => {
    it('should redact multiple secrets in the same text', () => {
      const text = `
        AWS_KEY=AKIAIOSFODNN7EXAMPLE
        GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij
        password = "secret123"
      `;
      const result = scrubSecrets(text);
      expect(result.redactionCount).toBe(3);
      expect(result.text).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(result.text).not.toContain('ghp_');
      expect(result.text).not.toContain('secret123');
    });
  });

  describe('Anthropic API keys', () => {
    it('should redact Anthropic API keys', () => {
      const text = 'Token: sk-ant-api03-' + 'a'.repeat(95);
      const result = scrubSecrets(text);
      expect(result.text).toBe('Token: [REDACTED]');
      expect(result.redactedTypes).toContain('Anthropic API Key');
    });
  });

  describe('OpenAI API keys', () => {
    it('should redact OpenAI project keys', () => {
      const text = 'Token: sk-proj-' + 'A1b2C3d4E5f6G7h8'.repeat(3);
      const result = scrubSecrets(text);
      expect(result.text).toBe('Token: [REDACTED]');
      expect(result.redactedTypes).toContain('OpenAI API Key');
    });
  });

  describe('Azure connection strings', () => {
    it('should redact Azure storage connection strings', () => {
      const text = 'CONN=DefaultEndpointsProtocol=https;AccountName=myacct;AccountKey=abc123key==;EndpointSuffix=core.windows.net';
      const result = scrubSecrets(text);
      expect(result.text).toContain('[REDACTED]');
      expect(result.redactedTypes).toContain('Azure Connection String');
    });
  });

  describe('pattern ordering', () => {
    it('should identify Anthropic key in API_KEY= format as Anthropic, not generic', () => {
      const text = 'API_KEY=sk-ant-api03-' + 'a'.repeat(95);
      const result = scrubSecrets(text);
      expect(result.redactedTypes).toContain('Anthropic API Key');
      expect(result.redactedTypes).not.toContain('Generic API Key');
    });

    it('should identify OpenAI key in API_KEY= format as OpenAI, not generic', () => {
      const text = 'API_KEY=sk-proj-' + 'A1b2C3d4E5f6G7h8'.repeat(3);
      const result = scrubSecrets(text);
      expect(result.redactedTypes).toContain('OpenAI API Key');
      expect(result.redactedTypes).not.toContain('Generic API Key');
    });

    it('should identify Azure connection string in api_key: format as Azure', () => {
      const text = 'api_key: DefaultEndpointsProtocol=https;AccountName=myacct;AccountKey=abc123key==;EndpointSuffix=core.windows.net';
      const result = scrubSecrets(text);
      expect(result.redactedTypes).toContain('Azure Connection String');
    });

    it('should still match non-specific keys as Generic API Key', () => {
      const text = 'API_KEY=abcdefghij1234567890abcd';
      const result = scrubSecrets(text);
      expect(result.redactedTypes).toContain('Generic API Key');
    });
  });

  describe('safe text', () => {
    it('should not modify text without secrets', () => {
      const text = 'This is normal text about AWS services and GitHub repositories';
      const result = scrubSecrets(text);
      expect(result.text).toBe(text);
      expect(result.redactionCount).toBe(0);
      expect(result.redactedTypes).toHaveLength(0);
    });

    it('should allow mentions of secret concepts without actual values', () => {
      const text = 'Set the API_KEY environment variable to your key';
      const result = scrubSecrets(text);
      // This shouldn't be redacted because there's no actual key value
      expect(result.redactionCount).toBe(0);
    });
  });
});

describe('containsSecrets', () => {
  it('should return true when text contains secrets', () => {
    expect(containsSecrets('key: AKIAIOSFODNN7EXAMPLE')).toBe(true);
    expect(containsSecrets('token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij')).toBe(true);
  });

  it('should return false when text is clean', () => {
    expect(containsSecrets('Hello, world!')).toBe(false);
    expect(containsSecrets('Talk about AWS and GitHub')).toBe(false);
  });
});

describe('analyzeSecrets', () => {
  it('should return counts of each secret type found', () => {
    const text = `
      AKIAIOSFODNN7EXAMPLE
      AKIAIOSFODNN7EXAMPL2
      ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij
    `;
    const analysis = analyzeSecrets(text);

    const awsCount = analysis.find((a) => a.type === 'AWS Access Key')?.count;
    const ghCount = analysis.find((a) => a.type === 'GitHub Token')?.count;

    expect(awsCount).toBe(2);
    expect(ghCount).toBe(1);
  });

  it('should return empty array for clean text', () => {
    const analysis = analyzeSecrets('Hello, this is clean text');
    expect(analysis).toHaveLength(0);
  });
});
