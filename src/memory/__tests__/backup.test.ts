/**
 * Tests for backup functions: backupDatabase, createTimestampedBackup, and rotation logic.
 *
 * Uses temp directories to avoid touching the real config directory.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let tmpDir: string;
let backupsDir: string;
let sourceDbPath: string;

// Mock config to use temp directory -- vi.mock is hoisted by Vitest
vi.mock('../config', async () => {
  const actual = await vi.importActual('../config');
  return {
    ...actual,
    get CONFIG_DIR() { return tmpDir; },
    get DATABASE_PATH() { return sourceDbPath; },
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
  backupsDir = path.join(tmpDir, 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });
  sourceDbPath = path.join(tmpDir, 'memory.db');

  // Create a real file-based SQLite DB (required by better-sqlite3 backup())
  const Database = (await import('better-sqlite3')).default;
  const sourceDb = new Database(sourceDbPath);
  sourceDb.exec('CREATE TABLE IF NOT EXISTS test (id INTEGER)');
  sourceDb.exec('INSERT INTO test VALUES (1)');
  sourceDb.close();

  // Reset the db module's internal state so initDatabase() will use the mocked DATABASE_PATH
  const { closeDatabase } = await import('../db');
  closeDatabase();
});

afterEach(async () => {
  const { closeDatabase } = await import('../db');
  closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('backupDatabase', () => {
  it('should create a backup file at the destination path', async () => {
    const { initDatabase, backupDatabase } = await import('../db');
    initDatabase();

    const destPath = path.join(tmpDir, 'test-backup.db');
    await backupDatabase(destPath);

    expect(fs.existsSync(destPath)).toBe(true);
    const stats = fs.statSync(destPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  it('should set restrictive permissions (0o600) on backup file', async () => {
    const { initDatabase, backupDatabase } = await import('../db');
    initDatabase();

    const destPath = path.join(tmpDir, 'test-backup-perms.db');
    await backupDatabase(destPath);

    const stats = fs.statSync(destPath);
    const permissions = stats.mode & 0o777;
    expect(permissions).toBe(0o600);
  });
});

describe('createTimestampedBackup', () => {
  it('should create a backup file with timestamped name', async () => {
    const { initDatabase, createTimestampedBackup } = await import('../db');
    initDatabase();

    const backupPath = await createTimestampedBackup();

    expect(fs.existsSync(backupPath)).toBe(true);
    const filename = path.basename(backupPath);
    expect(filename).toMatch(/^memory\.backup\..+\.db$/);
  });

  it('should retain only 5 newest backups after rotation', async () => {
    const { initDatabase, createTimestampedBackup } = await import('../db');
    initDatabase();

    // Seed 7 existing backup files in the backups directory
    const seedDates = [
      '2025-01-01T00-00-00-000Z',
      '2025-01-02T00-00-00-000Z',
      '2025-01-03T00-00-00-000Z',
      '2025-01-04T00-00-00-000Z',
      '2025-01-05T00-00-00-000Z',
      '2025-01-06T00-00-00-000Z',
      '2025-01-07T00-00-00-000Z',
    ];

    for (const date of seedDates) {
      const filePath = path.join(backupsDir, `memory.backup.${date}.db`);
      fs.writeFileSync(filePath, 'dummy-backup-content');
    }

    // Verify 7 files exist before the call
    const beforeFiles = fs.readdirSync(backupsDir).filter(
      f => f.startsWith('memory.backup.') && f.endsWith('.db')
    );
    expect(beforeFiles).toHaveLength(7);

    // Create an 8th backup via createTimestampedBackup (which also rotates)
    await createTimestampedBackup();

    // After rotation, exactly 5 .db files should remain
    const afterFiles = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('memory.backup.') && f.endsWith('.db'))
      .sort();
    expect(afterFiles).toHaveLength(5);

    // The 3 oldest files (dates 01 through 03) should have been deleted
    for (const date of seedDates.slice(0, 3)) {
      const filePath = path.join(backupsDir, `memory.backup.${date}.db`);
      expect(fs.existsSync(filePath)).toBe(false);
    }

    // The 4 newest seeded files (dates 04 through 07) should still exist
    for (const date of seedDates.slice(3)) {
      const filePath = path.join(backupsDir, `memory.backup.${date}.db`);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });
});
