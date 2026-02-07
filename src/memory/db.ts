/**
 * Shipyard Memory - Database Operations
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { DATABASE_PATH, CONFIG_DIR, ensureConfigDir } from './config';
import type { Exchange, MemoryStats, SearchResult } from './types';
import { logger } from './logger';
import { runMigrations } from './migrate';

// Import sqlite-vec for loading the extension
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sqliteVec = require('sqlite-vec');

let db: Database.Database | null = null;
let vecEnabled = false;

/**
 * Check if vector search is available (sqlite-vec loaded successfully)
 */
export function isVecEnabled(): boolean {
  return vecEnabled;
}

/**
 * Initialize the database with schema
 */
export function initDatabase(): Database.Database {
  if (db) return db;

  ensureConfigDir();

  db = new Database(DATABASE_PATH);

  // Set restrictive permissions to prevent world-readable access on shared systems
  try {
    fs.chmodSync(DATABASE_PATH, 0o600);
  } catch {
    // May fail on some filesystems; non-fatal
  }

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Load sqlite-vec extension using the package's helper
  try {
    sqliteVec.load(db);
    vecEnabled = true;
  } catch {
    vecEnabled = false;
  }

  // Bootstrap schema_migrations table (must exist before migration runner)
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    );
  `);

  // Run sequential migrations
  runMigrations(db);

  return db;
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Insert an exchange into the database
 */
export function insertExchange(exchange: Exchange): void {
  const database = getDatabase();

  const stmt = database.prepare(`
    INSERT OR REPLACE INTO exchanges (
      id, session_id, project_path, user_message, assistant_message,
      tool_names, timestamp, git_branch, source_file, line_start,
      line_end, embedding, indexed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    exchange.id,
    exchange.sessionId,
    exchange.projectPath,
    exchange.userMessage,
    exchange.assistantMessage,
    JSON.stringify(exchange.toolNames),
    exchange.timestamp,
    exchange.gitBranch,
    exchange.sourceFile,
    exchange.lineStart,
    exchange.lineEnd,
    exchange.embedding ? Buffer.from(exchange.embedding.buffer) : null,
    exchange.indexedAt
  );

  // Also insert into vector table if embedding exists
  if (exchange.embedding) {
    try {
      const vecStmt = database.prepare(`
        INSERT OR REPLACE INTO vec_exchanges (id, embedding) VALUES (?, ?)
      `);
      vecStmt.run(exchange.id, Buffer.from(exchange.embedding.buffer));
    } catch {
      // Vector table may not exist if extension not loaded
    }
  }
}

/**
 * Upsert a session record
 */
export function upsertSession(sessionId: string, projectPath: string | null, timestamp: number): void {
  const database = getDatabase();
  database
    .prepare(
      `
    INSERT INTO sessions (id, project_path, started_at, exchange_count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      exchange_count = exchange_count + 1
  `
    )
    .run(sessionId, projectPath, timestamp);
}

/**
 * Delete exchanges by session ID
 */
export function deleteExchangesBySession(sessionId: string): number {
  const database = getDatabase();

  // Delete from vector table first
  try {
    database
      .prepare(
        `
      DELETE FROM vec_exchanges WHERE id IN (
        SELECT id FROM exchanges WHERE session_id = ?
      )
    `
      )
      .run(sessionId);
  } catch {
    // Vector table may not exist
  }

  const result = database.prepare('DELETE FROM exchanges WHERE session_id = ?').run(sessionId);

  return result.changes;
}

/**
 * Delete exchanges by date range
 */
export function deleteExchangesByDateRange(afterTimestamp: number, beforeTimestamp: number): number {
  const database = getDatabase();

  // Delete from vector table first
  try {
    database
      .prepare(
        `
      DELETE FROM vec_exchanges WHERE id IN (
        SELECT id FROM exchanges WHERE timestamp >= ? AND timestamp < ?
      )
    `
      )
      .run(afterTimestamp, beforeTimestamp);
  } catch {
    // Vector table may not exist
  }

  const result = database
    .prepare('DELETE FROM exchanges WHERE timestamp >= ? AND timestamp < ?')
    .run(afterTimestamp, beforeTimestamp);

  return result.changes;
}

/**
 * Vector similarity search
 */
export function vectorSearch(
  embedding: Float32Array,
  limit: number = 10,
  filters?: {
    afterTimestamp?: number;
    beforeTimestamp?: number;
    projectPath?: string;
  }
): SearchResult[] {
  const database = getDatabase();

  try {
    // First, perform KNN search on vec_exchanges to get candidate IDs
    const knnQuery = `
      SELECT id, distance
      FROM vec_exchanges
      WHERE embedding MATCH ?
      ORDER BY distance
      LIMIT ?
    `;

    const knnResults = database.prepare(knnQuery).all(
      Buffer.from(embedding.buffer),
      limit * 3 // Fetch extra to allow for filtering
    ) as Array<{ id: string; distance: number }>;

    if (knnResults.length === 0) {
      return [];
    }

    // Get the full exchange data for matched IDs
    const ids = knnResults.map(r => r.id);
    const distanceMap = new Map(knnResults.map(r => [r.id, r.distance]));

    // Validate IDs before building dynamic placeholders
    if (!validateIds(ids)) return [];

    // Build filter conditions for the exchanges query
    const conditions: string[] = [`id IN (${ids.map(() => '?').join(',')})`];
    const params: (string | number)[] = [...ids];

    if (filters?.afterTimestamp) {
      conditions.push('timestamp >= ?');
      params.push(filters.afterTimestamp);
    }
    if (filters?.beforeTimestamp) {
      conditions.push('timestamp < ?');
      params.push(filters.beforeTimestamp);
    }
    if (filters?.projectPath) {
      conditions.push('project_path = ?');
      params.push(filters.projectPath);
    }

    const exchangeQuery = `
      SELECT * FROM exchanges
      WHERE ${conditions.join(' AND ')}
    `;

    const rows = database.prepare(exchangeQuery).all(...params) as Array<Record<string, unknown>>;

    // Convert L2 distance to cosine similarity for normalized vectors:
    // cos_similarity = 1 - (L2_distance² / 2)
    const distanceToScore = (d: number) => 1 - (d * d) / 2;

    // Convert to results with scores, sorted by similarity
    const results = rows
      .map((row) => ({
        exchange: rowToExchange(row),
        score: distanceToScore(distanceMap.get(row.id as string) || 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  } catch (error) {
    // Fall back to text search if vector search fails
    logger.warn('Vector search failed', { error: String(error) });
    return [];
  }
}

/**
 * Text-based search (fallback)
 */
export function textSearch(
  query: string,
  limit: number = 10,
  filters?: {
    afterTimestamp?: number;
    beforeTimestamp?: number;
    projectPath?: string;
  }
): SearchResult[] {
  const database = getDatabase();

  const conditions: string[] = ['(user_message LIKE ? OR assistant_message LIKE ?)'];
  const params: (string | number)[] = [`%${query}%`, `%${query}%`];

  if (filters?.afterTimestamp) {
    conditions.push('timestamp >= ?');
    params.push(filters.afterTimestamp);
  }
  if (filters?.beforeTimestamp) {
    conditions.push('timestamp < ?');
    params.push(filters.beforeTimestamp);
  }
  if (filters?.projectPath) {
    conditions.push('project_path = ?');
    params.push(filters.projectPath);
  }

  params.push(limit);

  const sql = `
    SELECT * FROM exchanges
    WHERE ${conditions.join(' AND ')}
    ORDER BY timestamp DESC
    LIMIT ?
  `;

  const rows = database.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    exchange: rowToExchange(row),
    score: 0.5, // Arbitrary score for text matches
  }));
}

/**
 * Get memory statistics
 */
export function getStats(): Omit<MemoryStats, 'enabled' | 'storageCapMb'> {
  const database = getDatabase();

  // Get database file size
  const dbStats = fs.statSync(DATABASE_PATH);
  const databaseSizeMb = dbStats.size / (1024 * 1024);

  // Get exchange count
  const countRow = database.prepare('SELECT COUNT(*) as count FROM exchanges').get() as {
    count: number;
  };

  // Get date range
  const rangeRow = database
    .prepare('SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM exchanges')
    .get() as { oldest: number | null; newest: number | null };

  // Get project counts
  const projectRows = database
    .prepare(
      `
    SELECT project_path as project, COUNT(*) as count
    FROM exchanges
    WHERE project_path IS NOT NULL
    GROUP BY project_path
    ORDER BY count DESC
    LIMIT 10
  `
    )
    .all() as Array<{ project: string; count: number }>;

  // Get import state
  const importRow = database
    .prepare("SELECT value FROM import_state WHERE key = 'import_completed'")
    .get() as { value: string } | undefined;

  // Get last indexed time
  const lastIndexedRow = database
    .prepare('SELECT MAX(indexed_at) as last_indexed FROM exchanges')
    .get() as { last_indexed: number | null };

  return {
    databaseSizeMb,
    exchangeCount: countRow.count,
    oldestExchange: rangeRow.oldest,
    newestExchange: rangeRow.newest,
    lastIndexedAt: lastIndexedRow.last_indexed,
    projectCounts: projectRows,
    importCompleted: importRow?.value === 'true',
  };
}

/**
 * Set import state
 */
export function setImportState(key: string, value: string): void {
  const database = getDatabase();
  database.prepare('INSERT OR REPLACE INTO import_state (key, value) VALUES (?, ?)').run(key, value);
}

/**
 * Get import state
 */
export function getImportState(key: string): string | null {
  const database = getDatabase();
  const row = database.prepare('SELECT value FROM import_state WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

/**
 * Validate an array of IDs before building dynamic SQL placeholders.
 * @internal Exported for testing only
 */
export function validateIds(ids: string[], maxLength: number = 10000): boolean {
  if (ids.length === 0 || ids.length > maxLength) return false;
  if (!ids.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 256)) return false;
  return true;
}

/**
 * Safely parse tool_names JSON string to a string[] array.
 * Returns empty array for null/undefined/empty/malformed input.
 */
export function safeParseToolNames(raw: string | null | undefined, exchangeId?: string): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn('Malformed tool_names JSON, using empty array', { exchangeId, raw });
    return [];
  }
  if (!Array.isArray(parsed)) {
    logger.warn('tool_names is not an array, using empty array', { exchangeId, type: typeof parsed });
    return [];
  }
  const valid = parsed.filter((v): v is string => typeof v === 'string');
  if (valid.length !== parsed.length) {
    logger.warn('tool_names contains non-string elements, filtering', {
      exchangeId,
      original: parsed.length,
      filtered: valid.length,
    });
  }
  return valid;
}

/**
 * Convert database row to Exchange object
 */
function rowToExchange(row: Record<string, unknown>): Exchange {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    projectPath: row.project_path as string | null,
    userMessage: row.user_message as string,
    assistantMessage: row.assistant_message as string,
    toolNames: safeParseToolNames(row.tool_names as string, row.id as string),
    timestamp: row.timestamp as number,
    gitBranch: row.git_branch as string | null,
    sourceFile: row.source_file as string,
    lineStart: row.line_start as number,
    lineEnd: row.line_end as number,
    indexedAt: row.indexed_at as number,
  };
}

/**
 * Prune old exchanges to stay within storage cap
 */
export function pruneToCapacity(capBytes: number): number {
  const database = getDatabase();

  // Get current size
  const stats = fs.statSync(DATABASE_PATH);
  if (stats.size <= capBytes) {
    return 0;
  }

  // Calculate how much to delete (aim for 90% of cap after pruning)
  const targetSize = capBytes * 0.9;
  const toDelete = stats.size - targetSize;

  // Estimate rows to delete (rough approximation)
  const avgRowSize = stats.size / (getStats().exchangeCount || 1);
  const rowsToDelete = Math.ceil(toDelete / avgRowSize);

  // Get IDs of oldest exchanges to delete
  const oldestRows = database
    .prepare(
      `
    SELECT id FROM exchanges
    ORDER BY timestamp ASC
    LIMIT ?
  `
    )
    .all(rowsToDelete) as Array<{ id: string }>;

  if (oldestRows.length === 0) {
    return 0;
  }

  const ids = oldestRows.map((r) => r.id);

  // Validate IDs before building dynamic placeholders
  if (!validateIds(ids, Infinity)) return 0;

  const placeholders = ids.map(() => '?').join(',');

  // Delete from vector table
  try {
    database.prepare(`DELETE FROM vec_exchanges WHERE id IN (${placeholders})`).run(...ids);
  } catch {
    // Vector table may not exist
  }

  // Delete from exchanges
  const result = database.prepare(`DELETE FROM exchanges WHERE id IN (${placeholders})`).run(...ids);

  if (result.changes > 0) {
    const totalCount = (database.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number }).count;
    const pctUsed = ((stats.size - (result.changes * (stats.size / (totalCount + result.changes)))) / capBytes * 100).toFixed(1);
    logger.warn('Storage cap exceeded, pruned old exchanges', {
      deleted: result.changes,
      remaining: totalCount,
      capBytes,
      pctCapUsed: pctUsed,
    });
  }

  // Vacuum to reclaim space
  database.exec('VACUUM');

  return result.changes;
}

/**
 * Backup database to a specified file path.
 * Performs a WAL checkpoint before backup to ensure all recent writes are captured.
 */
export async function backupDatabase(
  destinationPath: string,
  onProgress?: (totalPages: number, remainingPages: number) => void
): Promise<void> {
  const database = getDatabase();

  // Checkpoint WAL to ensure backup includes all recent writes
  database.pragma('wal_checkpoint(TRUNCATE)');

  await database.backup(destinationPath, {
    progress: ({ totalPages, remainingPages }: { totalPages: number; remainingPages: number }) => {
      if (onProgress) {
        onProgress(totalPages, remainingPages);
      }
      return 100; // Pages per backup step cycle
    },
  });

  // Set restrictive permissions on backup file (match source DB at 0600)
  fs.chmodSync(destinationPath, 0o600);
}

/**
 * Create a timestamped backup and rotate old backups (keep last 5).
 * Returns the path to the created backup file.
 */
export async function createTimestampedBackup(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(CONFIG_DIR, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `memory.backup.${timestamp}.db`);

  logger.info('Creating database backup', { destination: backupPath });

  await backupDatabase(backupPath, (totalPages, remainingPages) => {
    if (remainingPages === 0) {
      logger.info('Backup complete', { totalPages });
    }
  });

  // Rotate: keep only the 5 most recent backups
  const allFiles = await fs.promises.readdir(backupDir);
  const backups = allFiles
    .filter(f => f.startsWith('memory.backup.') && f.endsWith('.db'))
    .sort()
    .reverse();

  for (const old of backups.slice(5)) {
    const oldPath = path.join(backupDir, old);
    await fs.promises.unlink(oldPath);
    logger.info('Rotated old backup', { deleted: oldPath });
  }

  return backupPath;
}
