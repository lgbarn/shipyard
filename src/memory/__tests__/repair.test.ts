/**
 * Tests for repair.ts database repair functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Exchange, RepairReport } from '../types';

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

// Mock embeddings to avoid ML model loading
vi.mock('../embeddings', () => ({
  generateExchangeEmbedding: vi.fn(async () => new Float32Array(384).fill(0.5)),
}));

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-test-'));
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

describe('runRepair - clean database', () => {
  it('dry run on clean database reports zero issues and makes no modifications', async () => {
    const { initDatabase } = await import('../db');
    initDatabase();

    const { runRepair } = await import('../repair');
    const report = await runRepair(true);

    expect(report.dryRun).toBe(true);
    expect(report.totalIssues).toBe(0);
    expect(report.checks.length).toBe(7);

    // Find specific checks by name
    const structuralCheck = report.checks.find(c => c.name === 'Structural integrity');
    expect(structuralCheck).toBeDefined();
    expect(structuralCheck!.status).toBe('ok');

    const referentialCheck = report.checks.find(c => c.name === 'Referential integrity');
    expect(referentialCheck).toBeDefined();
    expect(referentialCheck!.status).toBe('ok');

    const indexCheck = report.checks.find(c => c.name === 'Index rebuild');
    expect(indexCheck).toBeDefined();
    expect(indexCheck!.status).toBe('skipped');

    const optimizeCheck = report.checks.find(c => c.name === 'Database optimization');
    expect(optimizeCheck).toBeDefined();
    expect(optimizeCheck!.status).toBe('skipped');

    expect(report.databaseSizeBefore).toBeGreaterThan(0);
    expect(report.databaseSizeAfter).toBeGreaterThan(0);
  });
});

describe('runRepair - stale source references', () => {
  it('reports stale source file references as warnings', async () => {
    const { initDatabase, insertExchange } = await import('../db');
    initDatabase();

    // Insert exchange with nonexistent file path
    insertExchange(makeExchange({ id: 'ex1', sourceFile: '/nonexistent/path/file.jsonl' }));
    // Insert exchange with session reference (should not be checked)
    insertExchange(makeExchange({ id: 'ex2', sourceFile: 'session:test-session-1' }));

    const { runRepair } = await import('../repair');
    const report = await runRepair(true);

    const staleCheck = report.checks.find(c => c.name === 'Stale source references');
    expect(staleCheck).toBeDefined();
    expect(staleCheck!.status).toBe('warning');
    expect(staleCheck!.count).toBe(1);
  });

  it('reports ok when all source files exist', async () => {
    const { initDatabase, insertExchange } = await import('../db');
    initDatabase();

    // Create a real temp file
    const tempFile = path.join(tmpDir, 'real-file.jsonl');
    fs.writeFileSync(tempFile, '');

    // Insert exchange with existing file
    insertExchange(makeExchange({ id: 'ex1', sourceFile: tempFile }));

    const { runRepair } = await import('../repair');
    const report = await runRepair(true);

    const staleCheck = report.checks.find(c => c.name === 'Stale source references');
    expect(staleCheck).toBeDefined();
    expect(staleCheck!.status).toBe('ok');
    expect(staleCheck!.count).toBe(0);
  });
});

describe('runRepair - fix mode basics', () => {
  it('fix mode runs REINDEX and VACUUM', async () => {
    const { initDatabase, insertExchange } = await import('../db');
    initDatabase();

    // Insert a few exchanges
    insertExchange(makeExchange({ id: 'ex1' }));
    insertExchange(makeExchange({ id: 'ex2' }));

    const { runRepair } = await import('../repair');
    const report = await runRepair(false);

    expect(report.dryRun).toBe(false);

    const indexCheck = report.checks.find(c => c.name === 'Index rebuild');
    expect(indexCheck).toBeDefined();
    expect(indexCheck!.status).toBe('fixed');
    expect(indexCheck!.details).toContain('rebuilt');

    const optimizeCheck = report.checks.find(c => c.name === 'Database optimization');
    expect(optimizeCheck).toBeDefined();
    expect(optimizeCheck!.status).toBe('fixed');
    expect(optimizeCheck!.details).toContain('VACUUM');
  });
});

describe('runRepair - structural integrity failure', () => {
  it('structural integrity check runs first and passes for valid database', async () => {
    const { initDatabase } = await import('../db');
    initDatabase();

    const { runRepair } = await import('../repair');
    const report = await runRepair(true);

    // Structural integrity is the first check
    expect(report.checks[0].name).toBe('Structural integrity');
    expect(report.checks[0].status).toBe('ok');
    expect(report.checks.length).toBe(7);
  });
});

describe('runRepair - orphaned vector entries', () => {
  it.skipIf(!process.env.CI)('dry run reports orphaned vec_exchanges entries without deleting them', async () => {
    const { initDatabase, getDatabase, isVecEnabled, insertExchange } = await import('../db');
    initDatabase();

    if (!isVecEnabled()) return;

    // Insert a normal exchange with embedding
    insertExchange(makeExchange({ id: 'ex1', embedding: new Float32Array(384).fill(0.1) }));

    // Seed an orphaned vector entry directly
    const db = getDatabase();
    db.prepare('INSERT INTO vec_exchanges (id, embedding) VALUES (?, ?)')
      .run('orphan-1', Buffer.from(new Float32Array(384).fill(0.2).buffer));

    const { runRepair } = await import('../repair');
    const report = await runRepair(true);

    const orphanCheck = report.checks.find(c => c.name === 'Orphaned vector entries');
    expect(orphanCheck).toBeDefined();
    expect(orphanCheck!.status).toBe('warning');
    expect(orphanCheck!.count).toBe(1);

    // Verify orphan still exists (dry run doesn't delete)
    const orphan = db.prepare('SELECT id FROM vec_exchanges WHERE id = ?').get('orphan-1');
    expect(orphan).toBeDefined();
  });

  it.skipIf(!process.env.CI)('fix mode deletes orphaned vec_exchanges entries and reports count', async () => {
    const { initDatabase, getDatabase, isVecEnabled, insertExchange } = await import('../db');
    initDatabase();

    if (!isVecEnabled()) return;

    // Insert a normal exchange with embedding
    insertExchange(makeExchange({ id: 'ex1', embedding: new Float32Array(384).fill(0.1) }));

    // Seed an orphaned vector entry
    const db = getDatabase();
    db.prepare('INSERT INTO vec_exchanges (id, embedding) VALUES (?, ?)')
      .run('orphan-1', Buffer.from(new Float32Array(384).fill(0.2).buffer));

    const { runRepair } = await import('../repair');
    const report = await runRepair(false);

    const orphanCheck = report.checks.find(c => c.name === 'Orphaned vector entries');
    expect(orphanCheck).toBeDefined();
    expect(orphanCheck!.status).toBe('fixed');
    expect(orphanCheck!.count).toBe(1);

    // Verify orphan is gone
    const orphan = db.prepare('SELECT id FROM vec_exchanges WHERE id = ?').get('orphan-1');
    expect(orphan).toBeUndefined();

    // Verify normal vec entry still exists
    const normal = db.prepare('SELECT id FROM vec_exchanges WHERE id = ?').get('ex1');
    expect(normal).toBeDefined();
  });

  it.skipIf(!process.env.CI)('reports ok when no orphaned vectors exist', async () => {
    const { initDatabase, isVecEnabled, insertExchange } = await import('../db');
    initDatabase();

    if (!isVecEnabled()) return;

    // Insert exchange with embedding (creates matched entries in both tables)
    insertExchange(makeExchange({ id: 'ex1', embedding: new Float32Array(384).fill(0.1) }));

    const { runRepair } = await import('../repair');
    const report = await runRepair(true);

    const orphanCheck = report.checks.find(c => c.name === 'Orphaned vector entries');
    expect(orphanCheck).toBeDefined();
    expect(orphanCheck!.status).toBe('ok');
    expect(orphanCheck!.count).toBe(0);
  });
});

describe('runRepair - missing embeddings', () => {
  it.skipIf(!process.env.CI)('dry run reports count of exchanges missing embeddings', async () => {
    const { initDatabase, getDatabase, isVecEnabled, insertExchange } = await import('../db');
    initDatabase();

    if (!isVecEnabled()) return;

    // Insert exchange without embedding
    insertExchange(makeExchange({ id: 'no-emb-1' }));

    // Explicitly null out embedding
    const db = getDatabase();
    db.prepare('UPDATE exchanges SET embedding = NULL WHERE id = ?').run('no-emb-1');

    // Insert a second exchange WITH embedding for contrast
    insertExchange(makeExchange({ id: 'ex2', embedding: new Float32Array(384).fill(0.1) }));

    const { runRepair } = await import('../repair');
    const report = await runRepair(true);

    const missingCheck = report.checks.find(c => c.name === 'Missing embeddings');
    expect(missingCheck).toBeDefined();
    expect(missingCheck!.status).toBe('warning');
    expect(missingCheck!.count).toBe(1);
  });

  it.skipIf(!process.env.CI)('fix mode regenerates missing embeddings using mocked generateExchangeEmbedding', async () => {
    const { initDatabase, getDatabase, isVecEnabled, insertExchange } = await import('../db');
    initDatabase();

    if (!isVecEnabled()) return;

    // Insert exchange without embedding
    insertExchange(makeExchange({ id: 'no-emb-1' }));

    // Explicitly null out embedding
    const db = getDatabase();
    db.prepare('UPDATE exchanges SET embedding = NULL WHERE id = ?').run('no-emb-1');

    // Insert a second exchange WITH embedding for contrast
    insertExchange(makeExchange({ id: 'ex2', embedding: new Float32Array(384).fill(0.1) }));

    const { runRepair } = await import('../repair');
    const report = await runRepair(false);

    const missingCheck = report.checks.find(c => c.name === 'Missing embeddings');
    expect(missingCheck).toBeDefined();
    expect(missingCheck!.status).toBe('fixed');
    expect(missingCheck!.count).toBe(1);

    // Verify the exchange now has an embedding
    const row = db.prepare('SELECT embedding FROM exchanges WHERE id = ?').get('no-emb-1') as { embedding: Buffer | null };
    expect(row.embedding).not.toBeNull();

    // Verify generateExchangeEmbedding was called
    const { generateExchangeEmbedding } = await import('../embeddings');
    expect(generateExchangeEmbedding).toHaveBeenCalled();

    // Verify vec_exchanges entry was created for the regenerated exchange
    const vecEntry = db.prepare('SELECT id FROM vec_exchanges WHERE id = ?').get('no-emb-1');
    expect(vecEntry).toBeDefined();
  });
});

describe('runRepair - vec extension unavailable', () => {
  it('skips orphaned vectors and missing embeddings checks when vec is disabled', async () => {
    const { initDatabase, isVecEnabled } = await import('../db');
    initDatabase();

    // Only run this test when vec is NOT enabled (local dev without sqlite-vec)
    if (isVecEnabled()) return;

    const { runRepair } = await import('../repair');
    const report = await runRepair(true);

    const orphanCheck = report.checks.find(c => c.name === 'Orphaned vector entries');
    expect(orphanCheck).toBeDefined();
    expect(orphanCheck!.status).toBe('skipped');
    expect(orphanCheck!.details).toContain('Vector extension not loaded');

    const missingCheck = report.checks.find(c => c.name === 'Missing embeddings');
    expect(missingCheck).toBeDefined();
    expect(missingCheck!.status).toBe('skipped');
    expect(missingCheck!.details).toContain('Vector extension not loaded');
  });
});

describe('formatRepairReport', () => {
  it('produces valid markdown with check table and size section', async () => {
    const { formatRepairReport } = await import('../repair');

    const report: RepairReport = {
      checks: [
        { name: 'Structural integrity', status: 'ok', details: 'Database structure is valid' },
        { name: 'Orphaned vector entries', status: 'fixed', details: 'Deleted 3 orphaned vector(s)', count: 3 },
        { name: 'Database optimization', status: 'fixed', details: 'VACUUM completed', count: 1024 },
      ],
      dryRun: false,
      totalIssues: 3,
      timestamp: Date.now(),
      databaseSizeBefore: 102400,
      databaseSizeAfter: 98304,
    };

    const markdown = formatRepairReport(report);

    expect(markdown).toContain('# Repair Report');
    expect(markdown).toContain('Fix');
    expect(markdown).not.toContain('Dry run');
    expect(markdown).toContain('Structural integrity');
    expect(markdown).toContain('ok');
    expect(markdown).toContain('Orphaned vector entries');
    expect(markdown).toContain('fixed');
    expect(markdown).toContain('3');
    expect(markdown).toContain('Database Size');
  });

  it('produces markdown for dry run report without size section when sizes undefined', async () => {
    const { formatRepairReport } = await import('../repair');

    const report: RepairReport = {
      checks: [
        { name: 'Structural integrity', status: 'ok', details: 'Database structure is valid' },
      ],
      dryRun: true,
      totalIssues: 0,
      timestamp: Date.now(),
    };

    const markdown = formatRepairReport(report);

    expect(markdown).toContain('# Repair Report');
    expect(markdown).toContain('Dry run');
    expect(markdown).not.toContain('Fix');
    expect(markdown).not.toContain('Database Size');
  });
});
