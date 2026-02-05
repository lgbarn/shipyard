"use strict";
/**
 * Shipyard Memory - Database Operations
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVecEnabled = isVecEnabled;
exports.initDatabase = initDatabase;
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
exports.insertExchange = insertExchange;
exports.upsertSession = upsertSession;
exports.deleteExchangesBySession = deleteExchangesBySession;
exports.deleteExchangesByDateRange = deleteExchangesByDateRange;
exports.vectorSearch = vectorSearch;
exports.textSearch = textSearch;
exports.getStats = getStats;
exports.setImportState = setImportState;
exports.getImportState = getImportState;
exports.pruneToCapacity = pruneToCapacity;
exports.backupDatabase = backupDatabase;
exports.createTimestampedBackup = createTimestampedBackup;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("./config");
const logger_1 = require("./logger");
const migrate_1 = require("./migrate");
// Import sqlite-vec for loading the extension
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sqliteVec = require('sqlite-vec');
let db = null;
let vecEnabled = false;
/**
 * Check if vector search is available (sqlite-vec loaded successfully)
 */
function isVecEnabled() {
    return vecEnabled;
}
/**
 * Initialize the database with schema
 */
function initDatabase() {
    if (db)
        return db;
    (0, config_1.ensureConfigDir)();
    db = new better_sqlite3_1.default(config_1.DATABASE_PATH);
    // Set restrictive permissions to prevent world-readable access on shared systems
    try {
        fs.chmodSync(config_1.DATABASE_PATH, 0o600);
    }
    catch {
        // May fail on some filesystems; non-fatal
    }
    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    // Load sqlite-vec extension using the package's helper
    try {
        sqliteVec.load(db);
        vecEnabled = true;
    }
    catch {
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
    (0, migrate_1.runMigrations)(db);
    return db;
}
/**
 * Get database instance
 */
function getDatabase() {
    if (!db) {
        return initDatabase();
    }
    return db;
}
/**
 * Close database connection
 */
function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}
/**
 * Insert an exchange into the database
 */
function insertExchange(exchange) {
    const database = getDatabase();
    const stmt = database.prepare(`
    INSERT OR REPLACE INTO exchanges (
      id, session_id, project_path, user_message, assistant_message,
      tool_names, timestamp, git_branch, source_file, line_start,
      line_end, embedding, indexed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(exchange.id, exchange.sessionId, exchange.projectPath, exchange.userMessage, exchange.assistantMessage, JSON.stringify(exchange.toolNames), exchange.timestamp, exchange.gitBranch, exchange.sourceFile, exchange.lineStart, exchange.lineEnd, exchange.embedding ? Buffer.from(exchange.embedding.buffer) : null, exchange.indexedAt);
    // Also insert into vector table if embedding exists
    if (exchange.embedding) {
        try {
            const vecStmt = database.prepare(`
        INSERT OR REPLACE INTO vec_exchanges (id, embedding) VALUES (?, ?)
      `);
            vecStmt.run(exchange.id, Buffer.from(exchange.embedding.buffer));
        }
        catch {
            // Vector table may not exist if extension not loaded
        }
    }
}
/**
 * Upsert a session record
 */
function upsertSession(sessionId, projectPath, timestamp) {
    const database = getDatabase();
    database
        .prepare(`
    INSERT INTO sessions (id, project_path, started_at, exchange_count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      exchange_count = exchange_count + 1
  `)
        .run(sessionId, projectPath, timestamp);
}
/**
 * Delete exchanges by session ID
 */
function deleteExchangesBySession(sessionId) {
    const database = getDatabase();
    // Delete from vector table first
    try {
        database
            .prepare(`
      DELETE FROM vec_exchanges WHERE id IN (
        SELECT id FROM exchanges WHERE session_id = ?
      )
    `)
            .run(sessionId);
    }
    catch {
        // Vector table may not exist
    }
    const result = database.prepare('DELETE FROM exchanges WHERE session_id = ?').run(sessionId);
    return result.changes;
}
/**
 * Delete exchanges by date range
 */
function deleteExchangesByDateRange(afterTimestamp, beforeTimestamp) {
    const database = getDatabase();
    // Delete from vector table first
    try {
        database
            .prepare(`
      DELETE FROM vec_exchanges WHERE id IN (
        SELECT id FROM exchanges WHERE timestamp >= ? AND timestamp < ?
      )
    `)
            .run(afterTimestamp, beforeTimestamp);
    }
    catch {
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
function vectorSearch(embedding, limit = 10, filters) {
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
        const knnResults = database.prepare(knnQuery).all(Buffer.from(embedding.buffer), limit * 3 // Fetch extra to allow for filtering
        );
        if (knnResults.length === 0) {
            return [];
        }
        // Get the full exchange data for matched IDs
        const ids = knnResults.map(r => r.id);
        const distanceMap = new Map(knnResults.map(r => [r.id, r.distance]));
        // Validate IDs before building dynamic placeholders
        if (ids.length === 0 || ids.length > 10000)
            return [];
        if (!ids.every(id => typeof id === 'string' && id.length > 0 && id.length <= 256))
            return [];
        // Build filter conditions for the exchanges query
        const conditions = [`id IN (${ids.map(() => '?').join(',')})`];
        const params = [...ids];
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
        const rows = database.prepare(exchangeQuery).all(...params);
        // Convert L2 distance to cosine similarity for normalized vectors:
        // cos_similarity = 1 - (L2_distance² / 2)
        const distanceToScore = (d) => 1 - (d * d) / 2;
        // Convert to results with scores, sorted by similarity
        const results = rows
            .map((row) => ({
            exchange: rowToExchange(row),
            score: distanceToScore(distanceMap.get(row.id) || 0),
        }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        return results;
    }
    catch (error) {
        // Fall back to text search if vector search fails
        logger_1.logger.warn('Vector search failed', { error: String(error) });
        return [];
    }
}
/**
 * Text-based search (fallback)
 */
function textSearch(query, limit = 10, filters) {
    const database = getDatabase();
    const conditions = ['(user_message LIKE ? OR assistant_message LIKE ?)'];
    const params = [`%${query}%`, `%${query}%`];
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
    const rows = database.prepare(sql).all(...params);
    return rows.map((row) => ({
        exchange: rowToExchange(row),
        score: 0.5, // Arbitrary score for text matches
    }));
}
/**
 * Get memory statistics
 */
function getStats() {
    const database = getDatabase();
    // Get database file size
    const dbStats = fs.statSync(config_1.DATABASE_PATH);
    const databaseSizeMb = dbStats.size / (1024 * 1024);
    // Get exchange count
    const countRow = database.prepare('SELECT COUNT(*) as count FROM exchanges').get();
    // Get date range
    const rangeRow = database
        .prepare('SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM exchanges')
        .get();
    // Get project counts
    const projectRows = database
        .prepare(`
    SELECT project_path as project, COUNT(*) as count
    FROM exchanges
    WHERE project_path IS NOT NULL
    GROUP BY project_path
    ORDER BY count DESC
    LIMIT 10
  `)
        .all();
    // Get import state
    const importRow = database
        .prepare("SELECT value FROM import_state WHERE key = 'import_completed'")
        .get();
    // Get last indexed time
    const lastIndexedRow = database
        .prepare('SELECT MAX(indexed_at) as last_indexed FROM exchanges')
        .get();
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
function setImportState(key, value) {
    const database = getDatabase();
    database.prepare('INSERT OR REPLACE INTO import_state (key, value) VALUES (?, ?)').run(key, value);
}
/**
 * Get import state
 */
function getImportState(key) {
    const database = getDatabase();
    const row = database.prepare('SELECT value FROM import_state WHERE key = ?').get(key);
    return row?.value ?? null;
}
/**
 * Convert database row to Exchange object
 */
function rowToExchange(row) {
    return {
        id: row.id,
        sessionId: row.session_id,
        projectPath: row.project_path,
        userMessage: row.user_message,
        assistantMessage: row.assistant_message,
        toolNames: JSON.parse(row.tool_names || '[]'),
        timestamp: row.timestamp,
        gitBranch: row.git_branch,
        sourceFile: row.source_file,
        lineStart: row.line_start,
        lineEnd: row.line_end,
        indexedAt: row.indexed_at,
    };
}
/**
 * Prune old exchanges to stay within storage cap
 */
function pruneToCapacity(capBytes) {
    const database = getDatabase();
    // Get current size
    const stats = fs.statSync(config_1.DATABASE_PATH);
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
        .prepare(`
    SELECT id FROM exchanges
    ORDER BY timestamp ASC
    LIMIT ?
  `)
        .all(rowsToDelete);
    if (oldestRows.length === 0) {
        return 0;
    }
    const ids = oldestRows.map((r) => r.id);
    // Validate IDs before building dynamic placeholders
    if (ids.length === 0)
        return 0;
    if (!ids.every(id => typeof id === 'string' && id.length > 0 && id.length <= 256))
        return 0;
    const placeholders = ids.map(() => '?').join(',');
    // Delete from vector table
    try {
        database.prepare(`DELETE FROM vec_exchanges WHERE id IN (${placeholders})`).run(...ids);
    }
    catch {
        // Vector table may not exist
    }
    // Delete from exchanges
    const result = database.prepare(`DELETE FROM exchanges WHERE id IN (${placeholders})`).run(...ids);
    if (result.changes > 0) {
        const totalCount = database.prepare('SELECT COUNT(*) as count FROM exchanges').get().count;
        const pctUsed = ((stats.size - (result.changes * (stats.size / (totalCount + result.changes)))) / capBytes * 100).toFixed(1);
        logger_1.logger.warn('Storage cap exceeded, pruned old exchanges', {
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
async function backupDatabase(destinationPath, onProgress) {
    const database = getDatabase();
    // Checkpoint WAL to ensure backup includes all recent writes
    database.pragma('wal_checkpoint(TRUNCATE)');
    await database.backup(destinationPath, {
        progress: ({ totalPages, remainingPages }) => {
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
async function createTimestampedBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(config_1.CONFIG_DIR, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `memory.backup.${timestamp}.db`);
    logger_1.logger.info('Creating database backup', { destination: backupPath });
    await backupDatabase(backupPath, (totalPages, remainingPages) => {
        if (remainingPages === 0) {
            logger_1.logger.info('Backup complete', { totalPages });
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
        logger_1.logger.info('Rotated old backup', { deleted: oldPath });
    }
    return backupPath;
}
//# sourceMappingURL=db.js.map