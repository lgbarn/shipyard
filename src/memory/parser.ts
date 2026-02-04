/**
 * Shipyard Memory - Conversation Parser
 *
 * Extracts user/assistant exchanges from Claude Code JSONL conversation files.
 */

import * as fs from 'fs';
import * as readline from 'readline';
import type { ParsedExchange, ConversationFile } from './types';

interface JsonlMessage {
  type?: string;
  role?: string;
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string }>;
  };
  content?: string | Array<{ type: string; text?: string; name?: string }>;
  parent?: string;
  uuid?: string;
  timestamp?: string;
  sessionId?: string;
  toolResults?: Array<{
    tool_use_id?: string;
    content?: string;
  }>;
}

/**
 * Extract text content from various message formats
 */
function extractTextContent(
  content: string | Array<{ type: string; text?: string }> | undefined
): string {
  if (!content) return '';

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text)
      .join('\n');
  }

  return '';
}

/**
 * Extract tool names from a message
 */
function extractToolNames(content: string | Array<{ type: string; name?: string }> | undefined): string[] {
  if (!content || typeof content === 'string') return [];

  if (Array.isArray(content)) {
    return content
      .filter((c) => c.type === 'tool_use' && c.name)
      .map((c) => c.name as string);
  }

  return [];
}

/**
 * Parse a single JSONL file and extract exchanges
 */
export async function parseConversationFile(filePath: string): Promise<ParsedExchange[]> {
  const exchanges: ParsedExchange[] = [];

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  let currentUserMessage: string | null = null;
  let currentToolNames: string[] = [];
  let currentTimestamp = Date.now();
  let currentSessionId = '';
  let currentParentUuid: string | undefined;

  for await (const line of rl) {
    lineNumber++;

    if (!line.trim()) continue;

    try {
      const parsed: JsonlMessage = JSON.parse(line);

      // Extract session ID
      if (parsed.sessionId) {
        currentSessionId = parsed.sessionId;
      }

      // Extract timestamp
      if (parsed.timestamp) {
        currentTimestamp = new Date(parsed.timestamp).getTime();
      }

      // Extract UUID for parent tracking
      if (parsed.uuid) {
        currentParentUuid = parsed.uuid;
      }

      // Determine role and content
      let role: string | undefined;
      let content: string | Array<{ type: string; text?: string }> | undefined;

      if (parsed.type === 'user' || parsed.role === 'user') {
        role = 'user';
        content = parsed.message?.content || parsed.content;
      } else if (parsed.type === 'assistant' || parsed.role === 'assistant') {
        role = 'assistant';
        content = parsed.message?.content || parsed.content;
      } else if (parsed.message?.role === 'user') {
        role = 'user';
        content = parsed.message.content;
      } else if (parsed.message?.role === 'assistant') {
        role = 'assistant';
        content = parsed.message.content;
      }

      if (role === 'user') {
        // Start of a new exchange
        currentUserMessage = extractTextContent(content);
        currentToolNames = [];
      } else if (role === 'assistant' && currentUserMessage !== null) {
        // Complete the exchange
        const assistantMessage = extractTextContent(content);
        const toolNames = extractToolNames(content as Array<{ type: string; name?: string }>);

        // Merge tool names
        currentToolNames = [...new Set([...currentToolNames, ...toolNames])];

        if (currentUserMessage.trim() && assistantMessage.trim()) {
          exchanges.push({
            userMessage: currentUserMessage,
            assistantMessage,
            toolNames: currentToolNames,
            timestamp: currentTimestamp,
            sessionId: currentSessionId || filePath,
            parentUuid: currentParentUuid,
          });
        }

        currentUserMessage = null;
        currentToolNames = [];
      }
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  return exchanges;
}

/**
 * Find all conversation files in a directory
 */
export function findConversationFiles(rootDir: string): ConversationFile[] {
  const files: ConversationFile[] = [];

  if (!fs.existsSync(rootDir)) {
    return files;
  }

  function walkDir(dir: string, projectPath: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`;

        if (entry.isDirectory()) {
          // For the top level, each directory is a project
          const newProjectPath = projectPath || fullPath;
          walkDir(fullPath, newProjectPath);
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          const stats = fs.statSync(fullPath);
          files.push({
            path: fullPath,
            projectPath: projectPath || dir,
            modifiedAt: stats.mtimeMs,
          });
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walkDir(rootDir, '');
  return files;
}

/**
 * Extract project path from Claude's directory structure
 *
 * Claude stores conversations in ~/.claude/projects/-path-to-project/
 * where the path is URL-encoded with hyphens
 */
export function decodeProjectPath(encodedPath: string): string {
  // Remove the ~/.claude/projects/ prefix and decode
  const parts = encodedPath.split('/');

  // Find the project directory part (after 'projects')
  const projectsIndex = parts.indexOf('projects');
  if (projectsIndex === -1 || projectsIndex >= parts.length - 1) {
    return encodedPath;
  }

  const projectDir = parts[projectsIndex + 1];

  // Decode: -Users-name-project becomes /Users/name/project
  if (projectDir.startsWith('-')) {
    return projectDir.replace(/-/g, '/');
  }

  return encodedPath;
}
