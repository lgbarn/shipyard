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
/**
 * Scrub sensitive information from text
 */
export declare function scrubSecrets(text: string): ScrubResult;
/**
 * Check if text contains any secrets (without modifying)
 */
export declare function containsSecrets(text: string): boolean;
/**
 * Get a summary of what would be redacted
 */
export declare function analyzeSecrets(text: string): Array<{
    type: string;
    count: number;
}>;
//# sourceMappingURL=scrubber.d.ts.map