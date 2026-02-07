/**
 * Shipyard Memory - Secret Scrubber
 *
 * Detects and redacts sensitive information before indexing.
 */

export interface ScrubResult {
  text: string;
  redactionCount: number;
  redactedTypes: string[];
}

// Secret patterns to detect and redact
const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
  },
  {
    name: 'GitHub Token',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
  },
  {
    name: 'GitHub OAuth Token',
    pattern: /gho_[a-zA-Z0-9]{36}/g,
  },
  {
    name: 'GitHub App Token',
    pattern: /ghu_[a-zA-Z0-9]{36}/g,
  },
  {
    name: 'GitHub Refresh Token',
    pattern: /ghr_[a-zA-Z0-9]{36}/g,
  },
  // Specific API key patterns MUST appear before the Generic API Key pattern.
  // The generic pattern matches any key in API_KEY=value format and will consume
  // specific keys (Anthropic, OpenAI, Azure) before they get a chance to match.
  {
    name: 'Anthropic API Key',
    pattern: /sk-ant-api03-[a-zA-Z0-9_-]{90,}/g,
  },
  {
    name: 'OpenAI API Key',
    pattern: /sk-proj-[a-zA-Z0-9_-]{40,}/g,
  },
  {
    name: 'Azure Connection String',
    pattern: /DefaultEndpointsProtocol=https?;AccountName=[^;]+;AccountKey=[^;]+;EndpointSuffix=[^\s"']*/gi,
  },
  {
    name: 'Generic API Key',
    pattern: /[aA][pP][iI][-_]?[kK][eE][yY]\s*[=:]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/g,
  },
  {
    name: 'Private Key Header',
    pattern: /-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]+PRIVATE KEY-----/g,
  },
  {
    name: 'Password Assignment',
    pattern: /password\s*[=:]\s*['"]?[^\s'"]{8,}['"]?/gi,
  },
  {
    name: 'Bearer Token',
    pattern: /[Bb]earer\s+[a-zA-Z0-9_-]{20,}/g,
  },
  {
    name: 'Slack Token',
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g,
  },
  {
    name: 'Stripe Key',
    pattern: /sk_live_[a-zA-Z0-9]{24,}/g,
  },
  {
    name: 'Stripe Test Key',
    pattern: /sk_test_[a-zA-Z0-9]{24,}/g,
  },
  {
    name: 'NPM Token',
    pattern: /npm_[a-zA-Z0-9]{36}/g,
  },
  {
    name: 'Database URL',
    pattern: /(postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@[^\s]+/gi,
  },
  {
    name: 'JWT Token',
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
  },
];

/**
 * Scrub sensitive information from text
 */
export function scrubSecrets(text: string): ScrubResult {
  let scrubbed = text;
  let redactionCount = 0;
  const redactedTypes: string[] = [];

  for (const { name, pattern } of SECRET_PATTERNS) {
    const matches = scrubbed.match(pattern);
    if (matches) {
      redactionCount += matches.length;
      if (!redactedTypes.includes(name)) {
        redactedTypes.push(name);
      }
      scrubbed = scrubbed.replace(pattern, '[REDACTED]');
    }
  }

  return {
    text: scrubbed,
    redactionCount,
    redactedTypes,
  };
}

/**
 * Check if text contains any secrets (without modifying)
 */
export function containsSecrets(text: string): boolean {
  for (const { pattern } of SECRET_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Get a summary of what would be redacted
 */
export function analyzeSecrets(text: string): Array<{ type: string; count: number }> {
  const results: Array<{ type: string; count: number }> = [];

  for (const { name, pattern } of SECRET_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      results.push({ type: name, count: matches.length });
    }
  }

  return results;
}
