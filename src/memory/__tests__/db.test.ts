/**
 * Tests for db.ts database operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Exchange } from '../types';

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
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-test-'));
  dbPath = path.join(tmpDir, 'memory.db');

  const { closeDatabase } = await import('../db');
  closeDatabase();
});

afterEach(async () => {
  const { closeDatabase } = await import('../db');
  closeDatabase();
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Factory function to create a complete Exchange object with sensible defaults
 */
function makeExchange(overrides?: Partial<Exchange>): Exchange {
  return {
    id: 'test-exchange-1',
    sessionId: 'test-session-1',
    projectPath: '/test/project',
    userMessage: 'Test user message',
    assistantMessage: 'Test assistant message',
    toolNames: ['Read', 'Write'],
    timestamp: 1000,
    gitBranch: 'main',
    sourceFile: '/test/project/session.jsonl',
    lineStart: 1,
    lineEnd: 10,
    indexedAt: 2000,
    ...overrides,
  };
}

describe('insertExchange', () => {
  it('should insert an exchange without embedding and round-trip all 13 fields correctly', async () => {
    const { initDatabase, insertExchange, getDatabase } = await import('../db');
    initDatabase();

    const exchange = makeExchange();
    insertExchange(exchange);

    const db = getDatabase();
    const row = db.prepare('SELECT * FROM exchanges WHERE id = ?').get(exchange.id) as Record<string, unknown>;

    expect(row).toBeDefined();
    expect(row.id).toBe(exchange.id);
    expect(row.session_id).toBe(exchange.sessionId);
    expect(row.project_path).toBe(exchange.projectPath);
    expect(row.user_message).toBe(exchange.userMessage);
    expect(row.assistant_message).toBe(exchange.assistantMessage);
    expect(row.tool_names).toBe(JSON.stringify(exchange.toolNames));
    expect(row.timestamp).toBe(exchange.timestamp);
    expect(row.git_branch).toBe(exchange.gitBranch);
    expect(row.source_file).toBe(exchange.sourceFile);
    expect(row.line_start).toBe(exchange.lineStart);
    expect(row.line_end).toBe(exchange.lineEnd);
    expect(row.embedding).toBeNull();
    expect(row.indexed_at).toBe(exchange.indexedAt);
  });

  it('should insert an exchange with embedding and populate vec_exchanges if vec is enabled', async () => {
    const { initDatabase, insertExchange, getDatabase, isVecEnabled } = await import('../db');
    initDatabase();

    const embedding = new Float32Array(384).fill(0.1);
    const exchange = makeExchange({ id: 'test-exchange-2', embedding });
    insertExchange(exchange);

    const db = getDatabase();
    const row = db.prepare('SELECT * FROM exchanges WHERE id = ?').get(exchange.id) as Record<string, unknown>;

    expect(row).toBeDefined();
    expect(row.embedding).not.toBeNull();
    expect(row.embedding).toBeInstanceOf(Buffer);

    if (isVecEnabled()) {
      const vecRow = db.prepare('SELECT id FROM vec_exchanges WHERE id = ?').get(exchange.id) as { id: string } | undefined;
      expect(vecRow).toBeDefined();
      expect(vecRow!.id).toBe(exchange.id);
    }
  });
});

describe('upsertSession', () => {
  it('should insert a session record with exchange_count=1', async () => {
    const { initDatabase, upsertSession, getDatabase } = await import('../db');
    initDatabase();

    upsertSession('s1', '/project', 1000);

    const db = getDatabase();
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get('s1') as Record<string, unknown>;

    expect(row).toBeDefined();
    expect(row.id).toBe('s1');
    expect(row.project_path).toBe('/project');
    expect(row.started_at).toBe(1000);
    expect(row.exchange_count).toBe(1);
  });

  it('should increment exchange_count when called twice for the same session', async () => {
    const { initDatabase, upsertSession, getDatabase } = await import('../db');
    initDatabase();

    upsertSession('s1', '/project', 1000);
    upsertSession('s1', '/project', 1000);

    const db = getDatabase();
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get('s1') as Record<string, unknown>;

    expect(row).toBeDefined();
    expect(row.exchange_count).toBe(2);
  });
});

describe('getImportState / setImportState', () => {
  it('should return null for a nonexistent key', async () => {
    const { initDatabase, getImportState } = await import('../db');
    initDatabase();

    const value = getImportState('nonexistent');
    expect(value).toBeNull();
  });

  it('should set and retrieve an import state value', async () => {
    const { initDatabase, setImportState, getImportState } = await import('../db');
    initDatabase();

    setImportState('key1', 'val1');
    const value = getImportState('key1');
    expect(value).toBe('val1');
  });

  it('should update an existing import state value (upsert behavior)', async () => {
    const { initDatabase, setImportState, getImportState } = await import('../db');
    initDatabase();

    setImportState('key1', 'val1');
    setImportState('key1', 'val2');
    const value = getImportState('key1');
    expect(value).toBe('val2');
  });
});
