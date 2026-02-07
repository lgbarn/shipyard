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

describe('textSearch', () => {
  it('should return exactly 1 result when searching for a unique term', async () => {
    const { initDatabase, insertExchange, textSearch } = await import('../db');
    initDatabase();

    insertExchange(makeExchange({ id: 'ex1', userMessage: 'alpha query test' }));
    insertExchange(makeExchange({ id: 'ex2', userMessage: 'beta query test' }));
    insertExchange(makeExchange({ id: 'ex3', userMessage: 'gamma unrelated' }));

    const results = textSearch('alpha');
    expect(results).toHaveLength(1);
    expect(results[0].exchange.id).toBe('ex1');
    expect(results[0].score).toBe(0.5);
  });

  it('should filter by timestamp range', async () => {
    const { initDatabase, insertExchange, textSearch } = await import('../db');
    initDatabase();

    insertExchange(makeExchange({ id: 'ex1', timestamp: 1000, userMessage: 'query test' }));
    insertExchange(makeExchange({ id: 'ex2', timestamp: 2000, userMessage: 'query test' }));
    insertExchange(makeExchange({ id: 'ex3', timestamp: 3000, userMessage: 'query test' }));

    const results = textSearch('query', 10, { afterTimestamp: 1500, beforeTimestamp: 2500 });
    expect(results).toHaveLength(1);
    expect(results[0].exchange.id).toBe('ex2');
  });

  it('should filter by projectPath', async () => {
    const { initDatabase, insertExchange, textSearch } = await import('../db');
    initDatabase();

    insertExchange(makeExchange({ id: 'ex1', projectPath: '/project-a', userMessage: 'query test' }));
    insertExchange(makeExchange({ id: 'ex2', projectPath: '/project-b', userMessage: 'query test' }));
    insertExchange(makeExchange({ id: 'ex3', projectPath: '/project-a', userMessage: 'query test' }));

    const results = textSearch('query', 10, { projectPath: '/project-a' });
    expect(results).toHaveLength(2);
    expect(results.map(r => r.exchange.id).sort()).toEqual(['ex1', 'ex3']);
  });
});

describe('vectorSearch', () => {
  it.skipIf(!process.env.CI)('should return results sorted by score descending when vec is enabled', async () => {
    const { initDatabase, insertExchange, vectorSearch, isVecEnabled } = await import('../db');
    initDatabase();

    if (!isVecEnabled()) {
      return;
    }

    // Insert 5 exchanges with different embeddings
    insertExchange(makeExchange({ id: 'ex1', embedding: new Float32Array(384).fill(0.1) }));
    insertExchange(makeExchange({ id: 'ex2', embedding: new Float32Array(384).fill(0.2) }));
    insertExchange(makeExchange({ id: 'ex3', embedding: new Float32Array(384).fill(0.3) }));
    insertExchange(makeExchange({ id: 'ex4', embedding: new Float32Array(384).fill(0.4) }));
    insertExchange(makeExchange({ id: 'ex5', embedding: new Float32Array(384).fill(0.5) }));

    const queryEmbedding = new Float32Array(384).fill(0.5);
    const results = vectorSearch(queryEmbedding, 3);

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(3);
    // Closest match should rank first
    expect(results[0].exchange.id).toBe('ex5');
    // Results should be sorted by score descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it.skipIf(!process.env.CI)('should filter by projectPath when vec is enabled', async () => {
    const { initDatabase, insertExchange, vectorSearch, isVecEnabled } = await import('../db');
    initDatabase();

    if (!isVecEnabled()) {
      return;
    }

    insertExchange(makeExchange({ id: 'ex1', projectPath: '/proj-a', embedding: new Float32Array(384).fill(0.1) }));
    insertExchange(makeExchange({ id: 'ex2', projectPath: '/proj-b', embedding: new Float32Array(384).fill(0.2) }));
    insertExchange(makeExchange({ id: 'ex3', projectPath: '/proj-a', embedding: new Float32Array(384).fill(0.3) }));

    const queryEmbedding = new Float32Array(384).fill(0.2);
    const results = vectorSearch(queryEmbedding, 10, { projectPath: '/proj-a' });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.exchange.projectPath === '/proj-a')).toBe(true);
  });
});

describe('deleteExchangesBySession', () => {
  it('should delete all exchanges in a session and return the count', async () => {
    const { initDatabase, insertExchange, deleteExchangesBySession, getDatabase } = await import('../db');
    initDatabase();

    insertExchange(makeExchange({ id: 'ex1', sessionId: 'A' }));
    insertExchange(makeExchange({ id: 'ex2', sessionId: 'A' }));
    insertExchange(makeExchange({ id: 'ex3', sessionId: 'B' }));

    const deletedCount = deleteExchangesBySession('A');
    expect(deletedCount).toBe(2);

    const db = getDatabase();
    const remaining = db.prepare('SELECT * FROM exchanges WHERE session_id = ?').all('A');
    expect(remaining).toHaveLength(0);

    const sessionB = db.prepare('SELECT * FROM exchanges WHERE session_id = ?').all('B');
    expect(sessionB).toHaveLength(1);
  });
});

describe('deleteExchangesByDateRange', () => {
  it('should delete exchanges within the date range and return the count', async () => {
    const { initDatabase, insertExchange, deleteExchangesByDateRange, getDatabase } = await import('../db');
    initDatabase();

    insertExchange(makeExchange({ id: 'ex1', timestamp: 1000 }));
    insertExchange(makeExchange({ id: 'ex2', timestamp: 2000 }));
    insertExchange(makeExchange({ id: 'ex3', timestamp: 3000 }));

    const deletedCount = deleteExchangesByDateRange(1500, 2500);
    expect(deletedCount).toBe(1);

    const db = getDatabase();
    const remaining = db.prepare('SELECT id FROM exchanges ORDER BY timestamp').all() as Array<{ id: string }>;
    expect(remaining).toHaveLength(2);
    expect(remaining.map(r => r.id)).toEqual(['ex1', 'ex3']);
  });
});

describe('getStats', () => {
  it('should return correct stats for an empty database', async () => {
    const { initDatabase, getStats } = await import('../db');
    initDatabase();

    const stats = getStats();

    expect(stats.exchangeCount).toBe(0);
    expect(stats.oldestExchange).toBeNull();
    expect(stats.newestExchange).toBeNull();
    expect(stats.lastIndexedAt).toBeNull();
    expect(stats.projectCounts).toEqual([]);
    expect(stats.importCompleted).toBe(false);
    expect(stats.databaseSizeMb).toBeGreaterThan(0);
  });

  it('should return correct stats for a database with 3 exchanges', async () => {
    const { initDatabase, insertExchange, getStats } = await import('../db');
    initDatabase();

    insertExchange(makeExchange({ id: 'ex1', timestamp: 1000, projectPath: '/proj-a', indexedAt: 2000 }));
    insertExchange(makeExchange({ id: 'ex2', timestamp: 2000, projectPath: '/proj-a', indexedAt: 2500 }));
    insertExchange(makeExchange({ id: 'ex3', timestamp: 3000, projectPath: '/proj-b', indexedAt: 3000 }));

    const stats = getStats();

    expect(stats.exchangeCount).toBe(3);
    expect(stats.oldestExchange).toBe(1000);
    expect(stats.newestExchange).toBe(3000);
    expect(stats.lastIndexedAt).toBe(3000);
    expect(stats.projectCounts).toHaveLength(2);
    expect(stats.projectCounts.find(p => p.project === '/proj-a')?.count).toBe(2);
    expect(stats.projectCounts.find(p => p.project === '/proj-b')?.count).toBe(1);
  });
});

describe('pruneToCapacity', () => {
  it('should return 0 when database is under capacity', async () => {
    const { initDatabase, insertExchange, pruneToCapacity } = await import('../db');
    initDatabase();

    insertExchange(makeExchange({ id: 'ex1' }));
    insertExchange(makeExchange({ id: 'ex2' }));

    // Set capacity to a very large value
    const deletedCount = pruneToCapacity(1024 * 1024 * 1024);
    expect(deletedCount).toBe(0);
  });

  it('should delete oldest exchanges when over capacity', async () => {
    const { initDatabase, insertExchange, pruneToCapacity } = await import('../db');
    const db = initDatabase();

    // Insert 50 exchanges with substantial text to make the DB measurably large
    const longText = 'This is a long message that will take up space in the database. '.repeat(100);
    for (let i = 1; i <= 50; i++) {
      insertExchange(makeExchange({
        id: `ex${i}`,
        timestamp: i * 1000,
        userMessage: `Message ${i}: ${longText}`,
        assistantMessage: `Response ${i}: ${longText}`,
      }));
    }

    // Get the actual DB file size
    const statsBefore = fs.statSync(dbPath);
    const actualSize = statsBefore.size;

    // Set capacity to a small value (30% of actual size) to trigger significant pruning
    const smallCapacity = Math.floor(actualSize * 0.3);
    const deletedCount = pruneToCapacity(smallCapacity);

    expect(deletedCount).toBeGreaterThan(0);

    // Verify oldest exchanges are gone
    const remaining = db.prepare('SELECT id FROM exchanges ORDER BY timestamp').all() as Array<{ id: string }>;
    expect(remaining.length).toBeLessThan(50);

    // Verify that the newest exchange is still there
    const newest = remaining[remaining.length - 1];
    expect(newest.id).toBe('ex50');

    // Verify DB file size has decreased (or stayed the same in worst case)
    // Note: VACUUM may not always reduce file size if pages are reused
    const statsAfter = fs.statSync(dbPath);
    expect(statsAfter.size).toBeLessThanOrEqual(actualSize);
  });
});

describe('validateIds', () => {
  it('should return true for a valid array of 1-3 string IDs', async () => {
    const { validateIds } = await import('../db');
    expect(validateIds(['id-1', 'id-2', 'id-3'])).toBe(true);
  });

  it('should return false for an empty array', async () => {
    const { validateIds } = await import('../db');
    expect(validateIds([])).toBe(false);
  });

  it('should return false when maxLength is exceeded', async () => {
    const { validateIds } = await import('../db');
    expect(validateIds(['id-1', 'id-2', 'id-3'], 2)).toBe(false);
  });

  it('should return false when default maxLength (10000) is exceeded', async () => {
    const { validateIds } = await import('../db');
    const ids = Array.from({ length: 10001 }, (_, i) => `id-${i}`);
    expect(validateIds(ids)).toBe(false);
  });

  it('should return false when array contains a non-string element', async () => {
    const { validateIds } = await import('../db');
    // Cast to bypass TypeScript type checking
    expect(validateIds(['id-1', 42 as unknown as string, 'id-3'])).toBe(false);
  });

  it('should return false when array contains an empty string', async () => {
    const { validateIds } = await import('../db');
    expect(validateIds(['id-1', '', 'id-3'])).toBe(false);
  });

  it('should return false when array contains a string longer than 256 chars', async () => {
    const { validateIds } = await import('../db');
    const longId = 'x'.repeat(257);
    expect(validateIds(['id-1', longId, 'id-3'])).toBe(false);
  });
});

describe('safeParseToolNames', () => {
  it('should return [] for null input', async () => {
    const { safeParseToolNames } = await import('../db');
    expect(safeParseToolNames(null)).toEqual([]);
  });

  it('should return [] for undefined input', async () => {
    const { safeParseToolNames } = await import('../db');
    expect(safeParseToolNames(undefined)).toEqual([]);
  });

  it('should return [] for empty string input', async () => {
    const { safeParseToolNames } = await import('../db');
    expect(safeParseToolNames('')).toEqual([]);
  });

  it('should return parsed array for valid JSON array', async () => {
    const { safeParseToolNames } = await import('../db');
    expect(safeParseToolNames('["Read","Write"]')).toEqual(['Read', 'Write']);
  });

  it('should return [] and warn for valid JSON non-array string', async () => {
    const { safeParseToolNames } = await import('../db');
    const { logger } = await import('../logger');
    const result = safeParseToolNames('"just a string"', 'ex-1');
    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      'tool_names is not an array, using empty array',
      expect.objectContaining({ exchangeId: 'ex-1', type: 'string' })
    );
  });

  it('should return [] and warn for valid JSON object', async () => {
    const { safeParseToolNames } = await import('../db');
    const { logger } = await import('../logger');
    const result = safeParseToolNames('{}', 'ex-2');
    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      'tool_names is not an array, using empty array',
      expect.objectContaining({ exchangeId: 'ex-2', type: 'object' })
    );
  });

  it('should return [] and warn for valid JSON number', async () => {
    const { safeParseToolNames } = await import('../db');
    const { logger } = await import('../logger');
    const result = safeParseToolNames('42', 'ex-3');
    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      'tool_names is not an array, using empty array',
      expect.objectContaining({ exchangeId: 'ex-3', type: 'number' })
    );
  });

  it('should return [] and warn for invalid JSON', async () => {
    const { safeParseToolNames } = await import('../db');
    const { logger } = await import('../logger');
    const result = safeParseToolNames('{broken', 'ex-4');
    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      'Malformed tool_names JSON, using empty array',
      expect.objectContaining({ exchangeId: 'ex-4', raw: '{broken' })
    );
  });

  it('should filter non-string elements and warn', async () => {
    const { safeParseToolNames } = await import('../db');
    const { logger } = await import('../logger');
    const result = safeParseToolNames('[1, true, "valid"]', 'ex-5');
    expect(result).toEqual(['valid']);
    expect(logger.warn).toHaveBeenCalledWith(
      'tool_names contains non-string elements, filtering',
      expect.objectContaining({ exchangeId: 'ex-5', original: 3, filtered: 1 })
    );
  });
});
