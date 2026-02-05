/**
 * Tests for repair.ts database repair functionality
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
