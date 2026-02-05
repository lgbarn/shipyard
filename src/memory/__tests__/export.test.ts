/**
 * Tests for export.ts database export functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { Exchange } from '../types'

let tmpDir: string
let dbPath: string

// Mock config to use temp directory
vi.mock('../config', async () => {
  const actual = await vi.importActual('../config')
  return {
    ...actual,
    get CONFIG_DIR() { return tmpDir },
    get DATABASE_PATH() { return dbPath },
    ensureConfigDir: () => {
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    },
  }
})

// Mock logger to suppress output during tests
vi.mock('../logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-test-'))
  dbPath = path.join(tmpDir, 'memory.db')
  const { closeDatabase } = await import('../db')
  closeDatabase()
})

afterEach(async () => {
  const { closeDatabase } = await import('../db')
  closeDatabase()
  vi.restoreAllMocks()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

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
  }
}

/**
 * Helper to insert a session row directly into the database
 */
async function seedSession(id: string, projectPath: string | null, startedAt: number, exchangeCount: number): Promise<void> {
  const { getDatabase } = await import('../db')
  const db = getDatabase()
  db.prepare('INSERT OR REPLACE INTO sessions (id, project_path, started_at, exchange_count) VALUES (?, ?, ?, ?)')
    .run(id, projectPath, startedAt, exchangeCount)
}

describe('runExport - empty database', () => {
  it('produces valid JSON with zero counts for empty database', async () => {
    const { initDatabase } = await import('../db')
    initDatabase()

    const { runExport } = await import('../export')
    const exportPath = path.join(tmpDir, 'empty-export.json')
    const result = await runExport(exportPath)

    // Read and parse exported file
    const content = fs.readFileSync(exportPath, 'utf-8')
    const parsed = JSON.parse(content) // Must not throw (success criterion 1)

    // Verify metadata structure
    expect(parsed.metadata).toBeDefined()
    expect(parsed.metadata.exchange_count).toBe(0)
    expect(parsed.metadata.session_count).toBe(0)

    // Verify empty arrays
    expect(Array.isArray(parsed.sessions)).toBe(true)
    expect(parsed.sessions).toHaveLength(0)
    expect(Array.isArray(parsed.exchanges)).toBe(true)
    expect(parsed.exchanges).toHaveLength(0)

    // Verify result object
    expect(result.exchangeCount).toBe(0)
    expect(result.sessionCount).toBe(0)
    expect(result.fileSizeBytes).toBeGreaterThan(0) // Even empty export has metadata
  })
})

describe('runExport - metadata completeness', () => {
  it('metadata includes all 6 required fields with correct types', async () => {
    const { initDatabase, insertExchange } = await import('../db')
    initDatabase()

    // Seed 2 exchanges and 1 session
    insertExchange(makeExchange({ id: 'ex1', sessionId: 'sess-1' }))
    insertExchange(makeExchange({ id: 'ex2', sessionId: 'sess-1' }))
    await seedSession('sess-1', '/test/project', 1000, 2)

    const { runExport } = await import('../export')
    const exportPath = path.join(tmpDir, 'meta-test.json')
    await runExport(exportPath)

    // Parse exported file
    const content = fs.readFileSync(exportPath, 'utf-8')
    const parsed = JSON.parse(content)

    // Verify all 6 required metadata fields (success criterion 2)
    expect(parsed.metadata.version).toBe('1.0.0') // Export format version
    expect(typeof parsed.metadata.schema_version).toBe('number')
    expect(parsed.metadata.schema_version).toBeGreaterThanOrEqual(1) // At least migration 001 applied
    expect(typeof parsed.metadata.exported_at).toBe('string')
    expect(new Date(parsed.metadata.exported_at).toISOString()).toBe(parsed.metadata.exported_at) // Valid ISO 8601
    expect(typeof parsed.metadata.database_path).toBe('string')
    expect(parsed.metadata.database_path).toContain('memory.db') // Contains db filename
    expect(parsed.metadata.exchange_count).toBe(2)
    expect(parsed.metadata.session_count).toBe(1)
  })

  it('exchange count in metadata matches actual exchanges array length', async () => {
    const { initDatabase, insertExchange } = await import('../db')
    initDatabase()

    // Insert 3 exchanges with unique IDs
    insertExchange(makeExchange({ id: 'ex1', sessionId: 'sess-1' }))
    insertExchange(makeExchange({ id: 'ex2', sessionId: 'sess-1' }))
    insertExchange(makeExchange({ id: 'ex3', sessionId: 'sess-1' }))
    await seedSession('sess-1', '/test/project', 1000, 3)

    const { runExport } = await import('../export')
    const exportPath = path.join(tmpDir, 'count-test.json')
    await runExport(exportPath)

    const content = fs.readFileSync(exportPath, 'utf-8')
    const parsed = JSON.parse(content)

    // Success criterion 3: counts must match
    expect(parsed.metadata.exchange_count).toBe(parsed.exchanges.length)
    expect(parsed.metadata.exchange_count).toBe(3)
  })

  it('session count in metadata matches actual sessions array length', async () => {
    const { initDatabase, insertExchange } = await import('../db')
    initDatabase()

    // Insert exchanges across 2 sessions
    insertExchange(makeExchange({ id: 'ex1', sessionId: 'sess-1' }))
    insertExchange(makeExchange({ id: 'ex2', sessionId: 'sess-2' }))
    await seedSession('sess-1', '/test/project', 1000, 1)
    await seedSession('sess-2', '/test/project', 2000, 1)

    const { runExport } = await import('../export')
    const exportPath = path.join(tmpDir, 'session-count-test.json')
    await runExport(exportPath)

    const content = fs.readFileSync(exportPath, 'utf-8')
    const parsed = JSON.parse(content)

    // Success criterion 4: session counts must match
    expect(parsed.metadata.session_count).toBe(parsed.sessions.length)
    expect(parsed.metadata.session_count).toBe(2)
  })
})

describe('runExport - exchange field handling', () => {
  it('no exchange in export contains an embedding field', async () => {
    const { initDatabase, insertExchange } = await import('../db')
    initDatabase()

    // Insert exchange WITH an embedding
    insertExchange(makeExchange({ id: 'ex1', embedding: new Float32Array(384).fill(0.5) }))

    const { runExport } = await import('../export')
    const exportPath = path.join(tmpDir, 'no-embedding-test.json')
    await runExport(exportPath)

    const content = fs.readFileSync(exportPath, 'utf-8')
    const parsed = JSON.parse(content)

    // Success criterion 5: no embedding field should be present
    for (const exchange of parsed.exchanges) {
      expect(exchange).not.toHaveProperty('embedding')
      // Verify expected fields are present
      expect(exchange).toHaveProperty('id')
      expect(exchange).toHaveProperty('session_id') // Snake_case from DB
      expect(exchange).toHaveProperty('user_message')
      expect(exchange).toHaveProperty('assistant_message')
      expect(exchange).toHaveProperty('tool_names')
      expect(exchange).toHaveProperty('timestamp')
      expect(exchange).toHaveProperty('indexed_at')
    }
  })

  it('tool_names exported as parsed array not JSON string', async () => {
    const { initDatabase, insertExchange } = await import('../db')
    initDatabase()

    // Insert exchange with multiple tool names
    insertExchange(makeExchange({ id: 'ex1', toolNames: ['Read', 'Write', 'Bash'] }))

    const { runExport } = await import('../export')
    const exportPath = path.join(tmpDir, 'tool-names-test.json')
    await runExport(exportPath)

    const content = fs.readFileSync(exportPath, 'utf-8')
    const parsed = JSON.parse(content)

    // Verify tool_names is an array, not a JSON string
    expect(Array.isArray(parsed.exchanges[0].tool_names)).toBe(true)
    expect(parsed.exchanges[0].tool_names).toEqual(['Read', 'Write', 'Bash'])
    expect(typeof parsed.exchanges[0].tool_names).not.toBe('string')
  })

  it('handles special characters in messages without breaking JSON', async () => {
    const { initDatabase, insertExchange } = await import('../db')
    initDatabase()

    // Insert exchange with special characters
    insertExchange(makeExchange({
      id: 'special-chars',
      userMessage: 'Message with "quotes" and\nnewlines and\ttabs and unicode: \u00e9\u00e8\u00ea',
      assistantMessage: 'Response with backslashes \\\\ and null bytes and <html> tags & ampersands',
    }))

    const { runExport } = await import('../export')
    const exportPath = path.join(tmpDir, 'special-chars-test.json')
    await runExport(exportPath)

    const content = fs.readFileSync(exportPath, 'utf-8')
    const parsed = JSON.parse(content) // Must not throw

    // Verify messages round-trip correctly
    expect(parsed.exchanges[0].user_message).toContain('"quotes"')
    expect(parsed.exchanges[0].user_message).toContain('\n')
    expect(parsed.exchanges[0].assistant_message).toContain('\\\\')
  })

  it('handles null project_path and git_branch gracefully', async () => {
    const { initDatabase, insertExchange } = await import('../db')
    initDatabase()

    // Insert exchange with null fields
    insertExchange(makeExchange({ id: 'ex1', projectPath: null, gitBranch: null }))

    const { runExport } = await import('../export')
    const exportPath = path.join(tmpDir, 'null-fields-test.json')
    await runExport(exportPath)

    const content = fs.readFileSync(exportPath, 'utf-8')
    const parsed = JSON.parse(content)

    // Verify null values are preserved
    expect(parsed.exchanges[0].project_path).toBeNull()
    expect(parsed.exchanges[0].git_branch).toBeNull()
  })
})
