/**
 * Shipyard Memory - Database Operations
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { DATABASE_PATH, ensureConfigDir } from './config';
import type { Exchange, MemoryStats, SearchResult } from './types';

// Import sqlite-vec for loading the extension
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sqliteVec = require('sqlite-vec');

let db: Database.Database | null = null;

/**
 * Initialize the database with schema
 */
export function initDatabase(): Database.Database {
  if (db) return db;

  ensureConfigDir();

  db = new Database(DATABASE_PATH);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Load sqlite-vec extension using the package's helper
  try {
    sqliteVec.load(db);
  } catch {
    console.warn('Warning: sqlite-vec extension not loaded. Vector search will be unavailable.');
  }

  // Create schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
  } else {
    // Inline schema for bundled distribution
    createSchemaInline(db);
  }

  return db;
}

function createSchemaInline(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS exchanges (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      project_path TEXT,
      user_message TEXT NOT NULL,
      assistant_message TEXT NOT NULL,
      tool_names TEXT,
      timestamp INTEGER NOT NULL,
      git_branch TEXT,
      source_file TEXT,
      line_start INTEGER,
      line_end INTEGER,
      embedding BLOB,
      indexed_at INTEGER NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS vec_exchanges USING vec0(
      id TEXT PRIMARY KEY,
      embedding FLOAT[384]
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_path TEXT,
      started_at INTEGER NOT NULL,
      exchange_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS import_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_exchanges_timestamp ON exchanges(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_exchanges_session ON exchanges(session_id);
    CREATE INDEX IF NOT EXISTS idx_exchanges_project ON exchanges(project_path);
    CREATE INDEX IF NOT EXISTS idx_exchanges_git_branch ON exchanges(git_branch);

    INSERT OR IGNORE INTO import_state (key, value) VALUES ('schema_version', '1');
    INSERT OR IGNORE INTO import_state (key, value) VALUES ('import_completed', 'false');
  `);
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

    // Convert to results with scores, sorted by distance
    const results = rows
      .map((row) => ({
        exchange: rowToExchange(row),
        score: 1 - (distanceMap.get(row.id as string) || 0), // Convert distance to similarity score
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  } catch (error) {
    // Fall back to text search if vector search fails
    console.warn('Vector search failed:', error);
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
 * Convert database row to Exchange object
 */
function rowToExchange(row: Record<string, unknown>): Exchange {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    projectPath: row.project_path as string | null,
    userMessage: row.user_message as string,
    assistantMessage: row.assistant_message as string,
    toolNames: JSON.parse((row.tool_names as string) || '[]'),
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
  const placeholders = ids.map(() => '?').join(',');

  // Delete from vector table
  try {
    database.prepare(`DELETE FROM vec_exchanges WHERE id IN (${placeholders})`).run(...ids);
  } catch {
    // Vector table may not exist
  }

  // Delete from exchanges
  const result = database.prepare(`DELETE FROM exchanges WHERE id IN (${placeholders})`).run(...ids);

  // Vacuum to reclaim space
  database.exec('VACUUM');

  return result.changes;
}
