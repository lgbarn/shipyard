/**
 * Tests for migration runner functions: readMigrationFiles, getAppliedMigrations,
 * applyMigration, and runMigrations.
 *
 * Uses temp directories to avoid touching the real config directory.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';

let tmpDir: string;
let dbPath: string;

// Mock config to use temp directory
vi.mock('../config', async () => {
  const actual = await vi.importActual('../config');
  return {
    ...actual,
    get CONFIG_DIR() { return tmpDir; },
    get DATABASE_PATH() { return dbPath; },
    ensureConfigDir: () => {
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    },
  };
});

// Mock logger to suppress output during tests
vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-test-'));
  dbPath = path.join(tmpDir, 'memory.db');

  const { closeDatabase } = await import('../db');
  closeDatabase();
});

afterEach(async () => {
  const { closeDatabase } = await import('../db');
  closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('initDatabase with migrations', () => {
  it('should create schema_migrations table with 001 record on fresh database', async () => {
    const { initDatabase } = await import('../db');
    initDatabase();

    // Open database directly to inspect
    const inspectDb = new Database(dbPath);

    try {
      // Verify schema_migrations table has 001 record
      const migrations = inspectDb
        .prepare('SELECT * FROM schema_migrations')
        .all() as Array<{ version: number; filename: string; applied_at: number }>;

      expect(migrations).toHaveLength(1);
      expect(migrations[0].version).toBe(1);
      expect(migrations[0].filename).toBe('001_initial_schema.sql');
      expect(migrations[0].applied_at).toBeGreaterThan(0);

      // Verify exchanges table exists
      const exchangesTable = inspectDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='exchanges'")
        .get() as { name: string } | undefined;
      expect(exchangesTable).toBeDefined();
      expect(exchangesTable!.name).toBe('exchanges');

      // Verify sessions table exists
      const sessionsTable = inspectDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
        .get() as { name: string } | undefined;
      expect(sessionsTable).toBeDefined();
      expect(sessionsTable!.name).toBe('sessions');

      // Verify schema_version is NOT seeded (retired key)
      const schemaVersion = inspectDb
        .prepare("SELECT * FROM import_state WHERE key = 'schema_version'")
        .all();
      expect(schemaVersion).toHaveLength(0);

      // Verify import_completed IS seeded
      const importCompleted = inspectDb
        .prepare("SELECT * FROM import_state WHERE key = 'import_completed'")
        .get() as { key: string; value: string } | undefined;
      expect(importCompleted).toBeDefined();
      expect(importCompleted!.value).toBe('false');
    } finally {
      inspectDb.close();
    }
  });

  it('should be idempotent when run twice', async () => {
    const { initDatabase, closeDatabase } = await import('../db');

    // First initialization
    initDatabase();
    closeDatabase();

    // Second initialization
    initDatabase();

    // Open database directly to verify
    const inspectDb = new Database(dbPath);

    try {
      const count = inspectDb
        .prepare('SELECT COUNT(*) as count FROM schema_migrations')
        .get() as { count: number };

      expect(count.count).toBe(1);
    } finally {
      inspectDb.close();
    }
  });

  it('should upgrade existing database without schema_migrations table', async () => {
    // Create a pre-migration database manually using the old inline schema
    const preDb = new Database(dbPath);

    // Old inline schema from RESEARCH.md appendix
    const oldSchema = `
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
    `;

    try {
      // Enable WAL and load sqlite-vec extension (mimic old behavior)
      preDb.pragma('journal_mode = WAL');

      // Try to load sqlite-vec (may not be available in test environment)
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqliteVec = require('sqlite-vec');
        sqliteVec.load(preDb);
      } catch {
        // If sqlite-vec is not available, skip the virtual table creation
        // by creating a version of the schema without vec_exchanges
        const schemaWithoutVec = oldSchema.replace(
          /CREATE VIRTUAL TABLE.*?vec_exchanges.*?\);/s,
          '-- vec_exchanges skipped in test'
        );
        preDb.exec(schemaWithoutVec);
        preDb.close();
      }

      // If vec loaded successfully, run full schema
      if (!preDb.open) {
        // Already closed above
      } else {
        preDb.exec(oldSchema);
        preDb.close();
      }
    } catch (error) {
      // If virtual table creation fails, close and create schema without it
      preDb.close();
      const preDb2 = new Database(dbPath);
      const schemaWithoutVec = oldSchema.replace(
        /CREATE VIRTUAL TABLE.*?vec_exchanges.*?\);/s,
        '-- vec_exchanges skipped in test'
      );
      preDb2.exec(schemaWithoutVec);
      preDb2.close();
    }

    // Now call initDatabase() with the migration system
    const { initDatabase } = await import('../db');
    initDatabase();

    // Open database directly to verify upgrade
    const inspectDb = new Database(dbPath);

    try {
      // Verify schema_migrations table was created and 001 was recorded
      const migrations = inspectDb
        .prepare('SELECT * FROM schema_migrations')
        .all() as Array<{ version: number; filename: string; applied_at: number }>;

      expect(migrations).toHaveLength(1);
      expect(migrations[0].version).toBe(1);
      expect(migrations[0].filename).toBe('001_initial_schema.sql');

      // Verify exchanges table still exists (not damaged)
      const count = inspectDb
        .prepare('SELECT COUNT(*) as count FROM exchanges')
        .get() as { count: number };
      expect(count.count).toBe(0);

      // Verify old schema_version row is preserved (not deleted)
      const schemaVersion = inspectDb
        .prepare("SELECT * FROM import_state WHERE key = 'schema_version'")
        .get() as { key: string; value: string } | undefined;
      expect(schemaVersion).toBeDefined();
      expect(schemaVersion!.value).toBe('1');
    } finally {
      inspectDb.close();
    }
  });
});

describe('migration failure and rollback', () => {
  it('should rollback a broken migration and not record it', async () => {
    // Create temp migrations directory
    const testMigrationsDir = path.join(tmpDir, 'test-migrations');
    fs.mkdirSync(testMigrationsDir, { recursive: true });

    // Copy 001_initial_schema.sql to temp dir
    const realMigrationsDir = path.join(__dirname, '..', 'migrations');
    const source001 = path.join(realMigrationsDir, '001_initial_schema.sql');
    const dest001 = path.join(testMigrationsDir, '001_initial_schema.sql');
    fs.copyFileSync(source001, dest001);

    // Create 002_bad.sql with invalid SQL
    const bad002 = path.join(testMigrationsDir, '002_bad.sql');
    fs.writeFileSync(bad002, 'CREATE TABLE good_table (id INTEGER);\nINVALID SQL STATEMENT HERE;');

    // Create database and bootstrap schema_migrations table
    const testDb = new Database(dbPath);
    testDb.pragma('journal_mode = WAL');

    // Load sqlite-vec extension (required for vec_exchanges virtual table)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqliteVec = require('sqlite-vec');
      sqliteVec.load(testDb);
    } catch {
      // sqlite-vec not available - skip this test
      testDb.close();
      return;
    }

    testDb.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL
      );
    `);

    // Import runMigrations
    const { runMigrations } = await import('../migrate');

    // Call runMigrations with the test migrations directory
    // Expect it to apply 001 successfully, then fail on 002
    expect(() => {
      runMigrations(testDb, testMigrationsDir);
    }).toThrow(/002_bad\.sql failed/);

    try {
      // Verify only 001 was applied (002 was rolled back)
      const migrations = testDb
        .prepare('SELECT * FROM schema_migrations')
        .all() as Array<{ version: number; filename: string; applied_at: number }>;

      expect(migrations).toHaveLength(1);
      expect(migrations[0].version).toBe(1);

      // Verify good_table does NOT exist (rolled back)
      const goodTable = testDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='good_table'")
        .get() as { name: string } | undefined;
      expect(goodTable).toBeUndefined();
    } finally {
      testDb.close();
    }
  });

  it('should not re-apply already applied migrations when new ones are added', async () => {
    // Create temp migrations directory
    const testMigrationsDir = path.join(tmpDir, 'test-migrations');
    fs.mkdirSync(testMigrationsDir, { recursive: true });

    // Copy 001_initial_schema.sql to temp dir
    const realMigrationsDir = path.join(__dirname, '..', 'migrations');
    const source001 = path.join(realMigrationsDir, '001_initial_schema.sql');
    const dest001 = path.join(testMigrationsDir, '001_initial_schema.sql');
    fs.copyFileSync(source001, dest001);

    // Create database and bootstrap schema_migrations table
    const testDb = new Database(dbPath);
    testDb.pragma('journal_mode = WAL');

    // Load sqlite-vec extension (required for vec_exchanges virtual table)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqliteVec = require('sqlite-vec');
      sqliteVec.load(testDb);
    } catch {
      // sqlite-vec not available - skip this test
      testDb.close();
      return;
    }

    testDb.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL
      );
    `);

    // Import runMigrations
    const { runMigrations } = await import('../migrate');

    // Apply 001
    runMigrations(testDb, testMigrationsDir);

    // Create 002_add_tags.sql with valid SQL
    const tags002 = path.join(testMigrationsDir, '002_add_tags.sql');
    fs.writeFileSync(tags002, 'CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY, name TEXT NOT NULL);');

    // Run migrations again
    runMigrations(testDb, testMigrationsDir);

    try {
      // Verify both migrations are recorded
      const migrations = testDb
        .prepare('SELECT * FROM schema_migrations ORDER BY version')
        .all() as Array<{ version: number; filename: string; applied_at: number }>;

      expect(migrations).toHaveLength(2);
      expect(migrations[0].version).toBe(1);
      expect(migrations[0].filename).toBe('001_initial_schema.sql');
      expect(migrations[1].version).toBe(2);
      expect(migrations[1].filename).toBe('002_add_tags.sql');

      // Verify tags table exists
      const tagsTable = testDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tags'")
        .get() as { name: string } | undefined;
      expect(tagsTable).toBeDefined();
      expect(tagsTable!.name).toBe('tags');
    } finally {
      testDb.close();
    }
  });
});
