/**
 * Tests for export.ts database export functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { PassThrough } from 'stream'
import type { Exchange, ExportResult } from '../types'

let tmpDir: string
let dbPath: string

// Mock fs module to allow createWriteStream to be overridden per-test
// All other fs functions pass through to real implementations
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs')
  return {
    ...actual,
    createWriteStream: vi.fn((...args: Parameters<typeof fs.createWriteStream>) => actual.createWriteStream(...args)),
  }
})

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
    const exportsDir = path.join(tmpDir, 'exports')
    fs.mkdirSync(exportsDir, { recursive: true })
    const exportPath = path.join(exportsDir, 'empty-export.json')
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
    const exportsDir = path.join(tmpDir, 'exports')
    fs.mkdirSync(exportsDir, { recursive: true })
    const exportPath = path.join(exportsDir, 'meta-test.json')
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
    const exportsDir = path.join(tmpDir, 'exports')
    fs.mkdirSync(exportsDir, { recursive: true })
    const exportPath = path.join(exportsDir, 'count-test.json')
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
    const exportsDir = path.join(tmpDir, 'exports')
    fs.mkdirSync(exportsDir, { recursive: true })
    const exportPath = path.join(exportsDir, 'session-count-test.json')
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
    const exportsDir = path.join(tmpDir, 'exports')
    fs.mkdirSync(exportsDir, { recursive: true })
    const exportPath = path.join(exportsDir, 'no-embedding-test.json')
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
    const exportsDir = path.join(tmpDir, 'exports')
    fs.mkdirSync(exportsDir, { recursive: true })
    const exportPath = path.join(exportsDir, 'tool-names-test.json')
    await runExport(exportPath)

    const content = fs.readFileSync(exportPath, 'utf-8')
    const parsed = JSON.parse(content)

    // Verify tool_names is an array, not a JSON string
    expect(Array.isArray(parsed.exchanges[0].tool_names)).toBe(true)
    expect(parsed.exchanges[0].tool_names).toEqual(['Read', 'Write', 'Bash'])
    expect(typeof parsed.exchanges[0].tool_names).not.toBe('string')
  })

  it('handles malformed tool_names JSON gracefully', async () => {
    const { initDatabase, getDatabase } = await import('../db')
    const { logger } = await import('../logger')
    initDatabase()

    // Insert exchange with malformed tool_names directly via SQL
    const db = getDatabase()
    db.prepare(`
      INSERT INTO exchanges (id, session_id, project_path, user_message, assistant_message,
        tool_names, timestamp, git_branch, source_file, line_start, line_end, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('malformed-ex', 'sess-1', '/test/project', 'user msg', 'assistant msg',
      '{invalid json', 1000, 'main', '/test/session.jsonl', 1, 10, 2000)

    const { runExport } = await import('../export')
    const exportsDir = path.join(tmpDir, 'exports')
    fs.mkdirSync(exportsDir, { recursive: true })
    const exportPath = path.join(exportsDir, 'malformed-tool-names-test.json')
    const result = await runExport(exportPath)

    // Export should complete successfully
    expect(result.exchangeCount).toBe(1)

    // Parse and verify tool_names becomes empty array
    const content = fs.readFileSync(exportPath, 'utf-8')
    const parsed = JSON.parse(content)
    expect(parsed.exchanges[0].tool_names).toEqual([])

    // Verify logger.warn was called with malformed JSON details
    expect(logger.warn).toHaveBeenCalledWith(
      'Malformed tool_names JSON, using empty array',
      expect.objectContaining({ exchangeId: 'malformed-ex', raw: '{invalid json' })
    )
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
    const exportsDir = path.join(tmpDir, 'exports')
    fs.mkdirSync(exportsDir, { recursive: true })
    const exportPath = path.join(exportsDir, 'special-chars-test.json')
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
    const exportsDir = path.join(tmpDir, 'exports')
    fs.mkdirSync(exportsDir, { recursive: true })
    const exportPath = path.join(exportsDir, 'null-fields-test.json')
    await runExport(exportPath)

    const content = fs.readFileSync(exportPath, 'utf-8')
    const parsed = JSON.parse(content)

    // Verify null values are preserved
    expect(parsed.exchanges[0].project_path).toBeNull()
    expect(parsed.exchanges[0].git_branch).toBeNull()
  })
})

describe('runExport - file permissions and path', () => {
  it('output file has 0o600 permissions', async () => {
    const { initDatabase } = await import('../db')
    initDatabase()

    const { runExport } = await import('../export')
    const exportsDir = path.join(tmpDir, 'exports')
    fs.mkdirSync(exportsDir, { recursive: true })
    const exportPath = path.join(exportsDir, 'perm-test.json')
    await runExport(exportPath)

    const stats = fs.statSync(exportPath)
    expect(stats.mode & 0o777).toBe(0o600) // Success criterion 7
  })

  it('default path is CONFIG_DIR/exports/memory-export-{timestamp}.json', async () => {
    const { initDatabase } = await import('../db')
    initDatabase()

    const { runExport } = await import('../export')
    const result = await runExport() // No outputPath argument

    // Verify path structure
    expect(result.outputPath).toContain(tmpDir) // CONFIG_DIR is mocked to tmpDir
    expect(result.outputPath).toContain('exports') // Subdirectory
    expect(result.outputPath).toContain('memory-export-') // Prefix
    expect(result.outputPath.endsWith('.json')).toBe(true) // Extension
    expect(path.basename(result.outputPath)).toMatch(/^memory-export-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/) // Success criterion 8

    // Verify file actually exists
    expect(fs.existsSync(result.outputPath)).toBe(true)
  })

  it('rejects output path outside exports directory', async () => {
    const { initDatabase } = await import('../db')
    initDatabase()

    const { runExport } = await import('../export')
    const outsidePath = path.join(tmpDir, 'outside-export.json')

    await expect(runExport(outsidePath)).rejects.toThrow('Export path must be within')
  })

  it('rejects path traversal attempts', async () => {
    const { initDatabase } = await import('../db')
    initDatabase()

    const { runExport } = await import('../export')
    const traversalPath = path.join(tmpDir, 'exports', '..', '..', 'etc', 'passwd')

    await expect(runExport(traversalPath)).rejects.toThrow('Export path must be within')
  })

  it('custom output path creates file at specified location', async () => {
    const { initDatabase, insertExchange } = await import('../db')
    initDatabase()

    // Insert 1 exchange
    insertExchange(makeExchange({ id: 'ex1' }))

    const { runExport } = await import('../export')
    const exportsDir = path.join(tmpDir, 'exports')
    const customDir = path.join(exportsDir, 'custom')
    fs.mkdirSync(customDir, { recursive: true })
    const customPath = path.join(customDir, 'my-export.json')

    const result = await runExport(customPath)

    expect(result.outputPath).toBe(customPath)
    expect(fs.existsSync(customPath)).toBe(true)

    // Parse and verify it's valid JSON with correct data
    const content = fs.readFileSync(customPath, 'utf-8')
    const parsed = JSON.parse(content)
    expect(parsed.metadata.exchange_count).toBe(1)
  })
})

describe('runExport - session export', () => {
  it('sessions exported with all fields as-is', async () => {
    const { initDatabase } = await import('../db')
    initDatabase()

    // Seed 2 sessions directly
    await seedSession('sess-1', '/project/alpha', 1000, 5)
    await seedSession('sess-2', null, 2000, 3)

    const { runExport } = await import('../export')
    const exportsDir = path.join(tmpDir, 'exports')
    fs.mkdirSync(exportsDir, { recursive: true })
    const exportPath = path.join(exportsDir, 'sessions-test.json')
    await runExport(exportPath)

    const content = fs.readFileSync(exportPath, 'utf-8')
    const parsed = JSON.parse(content)

    expect(parsed.sessions).toHaveLength(2)

    // Find and verify sess-1
    const s1 = parsed.sessions.find((s: Record<string, unknown>) => s.id === 'sess-1')
    expect(s1).toBeDefined()
    expect(s1.project_path).toBe('/project/alpha')
    expect(s1.started_at).toBe(1000)
    expect(s1.exchange_count).toBe(5)

    // Find and verify sess-2 (with null project_path)
    const s2 = parsed.sessions.find((s: Record<string, unknown>) => s.id === 'sess-2')
    expect(s2).toBeDefined()
    expect(s2.project_path).toBeNull()
    expect(s2.started_at).toBe(2000)
    expect(s2.exchange_count).toBe(3)
  })
})

describe('formatExportReport', () => {
  it('produces valid markdown with export summary', async () => {
    const { formatExportReport } = await import('../export')

    // Construct an ExportResult manually
    const result: ExportResult = {
      outputPath: '/home/user/.config/shipyard/exports/memory-export-2026-02-04.json',
      fileSizeBytes: 51200,
      exchangeCount: 150,
      sessionCount: 12,
      exportedAt: Date.now(),
    }

    const markdown = formatExportReport(result)

    // Verify markdown structure
    expect(markdown).toContain('# Export Report')
    expect(markdown).toContain('memory-export-2026-02-04.json')
    expect(markdown).toContain('150')
    expect(markdown).toContain('12')
    expect(markdown).toContain('KB') // File size formatted
    expect(markdown).toContain('Sessions')
    expect(markdown).toContain('Exchanges')
  })

  it('produces markdown for zero-count export', async () => {
    const { formatExportReport } = await import('../export')

    // Construct ExportResult with zero counts
    const result: ExportResult = {
      outputPath: '/tmp/empty-export.json',
      fileSizeBytes: 256,
      exchangeCount: 0,
      sessionCount: 0,
      exportedAt: Date.now(),
    }

    const markdown = formatExportReport(result)

    // Verify markdown contains zero values
    expect(markdown).toContain('0')
    expect(markdown.length).toBeGreaterThan(0)
  })
})

describe('runExport - ExportResult fields', () => {
  it('ExportResult contains all expected fields with correct values', async () => {
    const { initDatabase, insertExchange } = await import('../db')
    initDatabase()

    // Insert 2 exchanges with different session IDs
    insertExchange(makeExchange({ id: 'ex1', sessionId: 'sess-1' }))
    insertExchange(makeExchange({ id: 'ex2', sessionId: 'sess-2' }))
    await seedSession('sess-1', '/test/project', 1000, 1)
    await seedSession('sess-2', '/test/project', 2000, 1)

    const { runExport } = await import('../export')
    const exportsDir = path.join(tmpDir, 'exports')
    fs.mkdirSync(exportsDir, { recursive: true })
    const result = await runExport(path.join(exportsDir, 'result-test.json'))

    // Verify all ExportResult fields
    expect(result.outputPath).toContain('result-test.json')
    expect(result.fileSizeBytes).toBeGreaterThan(0)
    expect(result.exchangeCount).toBe(2)
    expect(result.sessionCount).toBe(2)
    expect(result.exportedAt).toBeGreaterThan(0)
    expect(result.exportedAt).toBeLessThanOrEqual(Date.now())
  })
})

describe('runExport - transaction consistency', () => {
  it('metadata counts match actual array lengths in exported JSON', async () => {
    const { initDatabase, insertExchange } = await import('../db')
    initDatabase()

    // Insert 3 exchanges across 2 sessions
    insertExchange(makeExchange({ id: 'ex1', sessionId: 'sess-1' }))
    insertExchange(makeExchange({ id: 'ex2', sessionId: 'sess-1' }))
    insertExchange(makeExchange({ id: 'ex3', sessionId: 'sess-2' }))
    await seedSession('sess-1', '/test/project', 1000, 2)
    await seedSession('sess-2', '/test/project', 2000, 1)

    const { runExport } = await import('../export')
    const exportsDir = path.join(tmpDir, 'exports')
    fs.mkdirSync(exportsDir, { recursive: true })
    const exportPath = path.join(exportsDir, 'txn-consistency-test.json')
    await runExport(exportPath)

    // Parse and verify consistency
    const content = fs.readFileSync(exportPath, 'utf-8')
    const parsed = JSON.parse(content)

    // Metadata counts must match actual array lengths (transaction ensures snapshot consistency)
    expect(parsed.metadata.exchange_count).toBe(parsed.exchanges.length)
    expect(parsed.metadata.session_count).toBe(parsed.sessions.length)
    expect(parsed.metadata.exchange_count).toBe(3)
    expect(parsed.metadata.session_count).toBe(2)
  })
})

describe('runExport - stream error cleanup', () => {
  it('cleans up partial file when write stream emits error', async () => {
    const { initDatabase } = await import('../db')
    initDatabase()

    const { runExport } = await import('../export')
    const exportsDir = path.join(tmpDir, 'exports')
    fs.mkdirSync(exportsDir, { recursive: true })
    const exportPath = path.join(exportsDir, 'error-cleanup-test.json')

    // Create a fake writable stream that accepts writes but emits error on end
    const fakeStream = new PassThrough()
    const streamError = new Error('Simulated disk full error')

    // Override createWriteStream to return our fake stream for this test
    const mockedCreateWriteStream = vi.mocked(fs.createWriteStream)
    mockedCreateWriteStream.mockImplementationOnce((() => {
      // Create the partial file so the cleanup handler has something to unlink
      fs.writeFileSync(exportPath, 'partial')
      return fakeStream
    }) as unknown as typeof fs.createWriteStream)

    // Spy on unlinkSync to verify cleanup was called
    const unlinkSpy = vi.spyOn(fs, 'unlinkSync')

    // Override end() to emit error after a tick (simulating async write error)
    const originalEnd = fakeStream.end.bind(fakeStream)
    fakeStream.end = ((...args: Parameters<PassThrough['end']>) => {
      process.nextTick(() => {
        fakeStream.emit('error', streamError)
      })
      return originalEnd(...args)
    }) as typeof fakeStream.end

    // Export should reject with the stream error
    await expect(runExport(exportPath)).rejects.toThrow('Simulated disk full error')

    // Verify unlinkSync was called with the export path
    expect(unlinkSpy).toHaveBeenCalledWith(exportPath)

    unlinkSpy.mockRestore()
  })
})
