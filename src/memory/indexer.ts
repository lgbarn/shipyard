/**
 * Shipyard Memory - Indexer
 *
 * Processes conversation files and indexes exchanges with embeddings.
 */

import * as crypto from 'crypto';
import { CLAUDE_PROJECTS_DIR, isProjectExcluded, getStorageCapBytes } from './config';
import {
  insertExchange,
  upsertSession,
  getImportState,
  setImportState,
  pruneToCapacity,
  getDatabase,
} from './db';
import { parseConversationFile, findConversationFiles, decodeProjectPath } from './parser';
import { generateExchangeEmbedding } from './embeddings';
import { scrubSecrets } from './scrubber';
import type { Exchange, ParsedExchange } from './types';

interface IndexProgress {
  totalFiles: number;
  processedFiles: number;
  totalExchanges: number;
  indexedExchanges: number;
  errors: number;
}

/**
 * Generate a unique ID for an exchange
 */
function generateExchangeId(sourceFile: string, lineStart: number, lineEnd: number): string {
  const input = `${sourceFile}:${lineStart}-${lineEnd}`;
  return crypto.createHash('md5').update(input).digest('hex');
}

/**
 * Check if a file has already been indexed
 */
function isFileIndexed(filePath: string, modifiedAt: number): boolean {
  const db = getDatabase();
  const row = db
    .prepare(
      `
    SELECT MAX(indexed_at) as last_indexed
    FROM exchanges
    WHERE source_file = ?
  `
    )
    .get(filePath) as { last_indexed: number | null } | undefined;

  if (!row?.last_indexed) return false;

  // Re-index if file has been modified since last index
  return row.last_indexed >= modifiedAt;
}

/**
 * Index a single exchange
 */
const MIN_CONTENT_LENGTH = 50;

async function indexExchange(
  parsed: ParsedExchange,
  sourceFile: string,
  lineStart: number,
  lineEnd: number,
  projectPath: string
): Promise<void> {
  // Skip noisy/empty exchanges
  if (parsed.userMessage.length + parsed.assistantMessage.length < MIN_CONTENT_LENGTH) {
    return;
  }

  // Scrub secrets before indexing
  const scrubbedUser = scrubSecrets(parsed.userMessage);
  const scrubbedAssistant = scrubSecrets(parsed.assistantMessage);

  // Generate embedding
  const embedding = await generateExchangeEmbedding(
    scrubbedUser.text,
    scrubbedAssistant.text,
    parsed.toolNames
  );

  const exchange: Exchange = {
    id: generateExchangeId(sourceFile, lineStart, lineEnd),
    sessionId: parsed.sessionId,
    projectPath: projectPath,
    userMessage: scrubbedUser.text,
    assistantMessage: scrubbedAssistant.text,
    toolNames: parsed.toolNames,
    timestamp: parsed.timestamp,
    gitBranch: null, // Could be extracted if available
    sourceFile,
    lineStart,
    lineEnd,
    embedding,
    indexedAt: Date.now(),
  };

  insertExchange(exchange);
  upsertSession(exchange.sessionId, exchange.projectPath, exchange.timestamp);
}

/**
 * Index a single conversation file
 */
async function indexFile(
  filePath: string,
  projectPath: string,
  onProgress?: (indexed: number, total: number) => void
): Promise<number> {
  const exchanges = await parseConversationFile(filePath);

  let indexed = 0;
  let lineCounter = 0;

  for (const exchange of exchanges) {
    const lineStart = lineCounter;
    lineCounter++; // Simplified line tracking
    const lineEnd = lineCounter;

    try {
      await indexExchange(exchange, filePath, lineStart, lineEnd, projectPath);
      indexed++;

      if (onProgress) {
        onProgress(indexed, exchanges.length);
      }
    } catch (error) {
      console.error(`Error indexing exchange from ${filePath}:`, error);
    }
  }

  return indexed;
}

/**
 * Run the full indexer on all conversation files
 */
export async function runFullIndex(
  onProgress?: (progress: IndexProgress) => void
): Promise<IndexProgress> {
  const progress: IndexProgress = {
    totalFiles: 0,
    processedFiles: 0,
    totalExchanges: 0,
    indexedExchanges: 0,
    errors: 0,
  };

  // Find all conversation files
  const files = findConversationFiles(CLAUDE_PROJECTS_DIR);
  progress.totalFiles = files.length;

  if (onProgress) onProgress(progress);

  for (const file of files) {
    try {
      // Decode project path from Claude's directory structure
      const decodedProjectPath = decodeProjectPath(file.projectPath);

      // Check if project is excluded
      if (isProjectExcluded(decodedProjectPath)) {
        progress.processedFiles++;
        if (onProgress) onProgress(progress);
        continue;
      }

      // Check if already indexed
      if (isFileIndexed(file.path, file.modifiedAt)) {
        progress.processedFiles++;
        if (onProgress) onProgress(progress);
        continue;
      }

      // Index the file
      const indexed = await indexFile(file.path, decodedProjectPath, (_current, total) => {
        progress.totalExchanges = total;
        if (onProgress) onProgress(progress);
      });

      progress.indexedExchanges += indexed;
      progress.processedFiles++;

      if (onProgress) onProgress(progress);
    } catch (error) {
      console.error(`Error processing file ${file.path}:`, error);
      progress.errors++;
      progress.processedFiles++;

      if (onProgress) onProgress(progress);
    }
  }

  // Prune to stay within storage cap
  const capBytes = getStorageCapBytes();
  pruneToCapacity(capBytes);

  return progress;
}

/**
 * Run incremental index (only new/modified files)
 */
export async function runIncrementalIndex(
  onProgress?: (progress: IndexProgress) => void
): Promise<IndexProgress> {
  // Same as full index but relies on isFileIndexed check
  return runFullIndex(onProgress);
}

/**
 * Run initial import
 */
export async function runImport(
  force: boolean = false,
  onProgress?: (progress: IndexProgress) => void
): Promise<IndexProgress> {
  // Check if already imported (unless forcing)
  if (!force) {
    const imported = getImportState('import_completed');
    if (imported === 'true') {
      return {
        totalFiles: 0,
        processedFiles: 0,
        totalExchanges: 0,
        indexedExchanges: 0,
        errors: 0,
      };
    }
  }

  // Run full index
  const progress = await runFullIndex(onProgress);

  // Mark as imported
  setImportState('import_completed', 'true');
  setImportState('import_timestamp', Date.now().toString());

  return progress;
}

/**
 * Index exchanges from the current session
 * (Called by hook after session ends)
 */
export async function indexCurrentSession(
  sessionId: string,
  exchanges: ParsedExchange[],
  projectPath: string
): Promise<number> {
  // Check if project is excluded
  if (isProjectExcluded(projectPath)) {
    return 0;
  }

  let indexed = 0;

  for (let i = 0; i < exchanges.length; i++) {
    const exchange = exchanges[i];

    try {
      await indexExchange(
        exchange,
        `session:${sessionId}`,
        i,
        i + 1,
        projectPath
      );
      indexed++;
    } catch (error) {
      console.error(`Error indexing exchange from session ${sessionId}:`, error);
    }
  }

  // Prune to stay within storage cap
  const capBytes = getStorageCapBytes();
  pruneToCapacity(capBytes);

  return indexed;
}
