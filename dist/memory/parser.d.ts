/**
 * Shipyard Memory - Conversation Parser
 *
 * Extracts user/assistant exchanges from Claude Code JSONL conversation files.
 */
import type { ParsedExchange, ConversationFile } from './types';
/**
 * Parse a single JSONL file and extract exchanges
 */
export declare function parseConversationFile(filePath: string): Promise<ParsedExchange[]>;
/**
 * Find all conversation files in a directory
 */
export declare function findConversationFiles(rootDir: string): ConversationFile[];
/**
 * Extract project path from Claude's directory structure
 *
 * Claude stores conversations in ~/.claude/projects/-path-to-project/
 * where the path is URL-encoded with hyphens
 */
export declare function decodeProjectPath(encodedPath: string): string;
//# sourceMappingURL=parser.d.ts.map