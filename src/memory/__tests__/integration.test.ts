/**
 * Integration Tests - Memory Pipeline
 *
 * Tests the full memory pipeline with real database and parser,
 * but mocked embeddings for speed and reliability.
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
    get CLAUDE_PROJECTS_DIR() { return path.join(tmpDir, 'projects') },
    ensureConfigDir: () => {
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    },
    isProjectExcluded: vi.fn(() => false),
    isMemoryEnabled: vi.fn(() => true),
    getStorageCapBytes: vi.fn(() => 1024 * 1024 * 1024),
  }
})

// Mock embeddings with deterministic values
vi.mock('../embeddings', () => ({
  generateEmbedding: vi.fn(async () => new Float32Array(384).fill(0.5)),
  generateExchangeEmbedding: vi.fn(async () => new Float32Array(384).fill(0.5)),
}))

// Mock logger to suppress output during tests
vi.mock('../logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(async () => {
  vi.clearAllMocks()
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'integration-test-'))
  dbPath = path.join(tmpDir, 'memory.db')
  fs.mkdirSync(path.join(tmpDir, 'projects'), { recursive: true })
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
 * Used in scenarios 3+ for direct database inserts
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
 * Helper to create a conversation file in the mocked CLAUDE_PROJECTS_DIR
 * Ensures messages meet MIN_CONTENT_LENGTH requirement (50 chars combined)
 */
function createConversationFile(
  projectName: string,
  exchanges: Array<{ user: string; assistant: string; sessionId?: string }>
): string {
  const projectDir = path.join(tmpDir, 'projects', projectName)
  fs.mkdirSync(projectDir, { recursive: true })

  const filePath = path.join(projectDir, 'session.jsonl')
  const lines: string[] = []

  for (const exchange of exchanges) {
    const sessionId = exchange.sessionId || 'default-session'

    // User message
    lines.push(JSON.stringify({
      type: 'user',
      message: { role: 'user', content: exchange.user },
      timestamp: new Date(Date.now()).toISOString(),
      sessionId: sessionId,
    }))

    // Assistant message
    lines.push(JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: exchange.assistant },
      timestamp: new Date(Date.now() + 1000).toISOString(),
    }))
  }

  fs.writeFileSync(filePath, lines.join('\n'))
  return filePath
}

describe('Scenario 1: import and recall', () => {
  it('should import conversation files and store exchanges in database', async () => {
    // Create 2 conversation files with 2 exchanges each
    createConversationFile('project-1', [
      {
        user: 'What is the capital of France?',
        assistant: 'The capital of France is Paris, known for the Eiffel Tower.',
        sessionId: 'session-1'
      },
      {
        user: 'Tell me more about Paris history.',
        assistant: 'Paris has been inhabited since around 250 BC. It became the French capital in 508 AD.',
        sessionId: 'session-1'
      }
    ])

    createConversationFile('project-2', [
      {
        user: 'How do I write a Python function?',
        assistant: 'You can define a function in Python using the def keyword, followed by the function name.',
        sessionId: 'session-2'
      },
      {
        user: 'What about parameters and return values?',
        assistant: 'Parameters go in parentheses after the function name. Use return to send back a value.',
        sessionId: 'session-2'
      }
    ])

    // Initialize database and run import
    const { initDatabase, getDatabase, getImportState } = await import('../db')
    const { runImport } = await import('../indexer')
    initDatabase()

    const progress = await runImport(true)

    // Verify progress counts
    expect(progress.indexedExchanges).toBeGreaterThanOrEqual(2)
    expect(progress.processedFiles).toBeGreaterThanOrEqual(2)

    // Verify exchanges stored in database
    const db = getDatabase()
    const result = db.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number }
    expect(result.count).toBeGreaterThanOrEqual(2)

    // Verify import completion state
    expect(getImportState('import_completed')).toBe('true')
  })
})

describe('Scenario 2: index and text search', () => {
  it('should index conversations and return results from text search', async () => {
    // Create conversation with distinctive content
    createConversationFile('rust-project', [
      {
        user: 'Can you explain Rust borrow checker to me please?',
        assistant: 'The Rust programming language borrow checker is a compile-time system that enforces memory safety rules. It tracks ownership and borrowing to prevent data races.',
        sessionId: 'rust-session'
      }
    ])

    // Initialize and import
    const { initDatabase } = await import('../db')
    const { runImport } = await import('../indexer')
    initDatabase()
    await runImport(true)

    // Perform text search
    const { textSearch } = await import('../db')
    const results = textSearch('borrow checker', 10)

    // Verify results
    expect(results.length).toBeGreaterThan(0)
    const firstResult = results[0]
    expect(firstResult.exchange.assistantMessage.toLowerCase()).toContain('borrow')
  })
})

describe('Scenario 3: index and vector search', () => {
  it('should index conversations and return results from vector search with scores', async () => {
    // Create conversation with distinctive content
    createConversationFile('ml-project', [
      {
        user: 'What are machine learning neural networks exactly?',
        assistant: 'Machine learning neural networks are computational models inspired by biological neural networks. They consist of interconnected nodes (neurons) organized in layers that process information.',
        sessionId: 'ml-session'
      }
    ])

    // Initialize and import
    const { initDatabase } = await import('../db')
    const { runImport } = await import('../indexer')
    initDatabase()
    await runImport(true)

    // Perform vector search with mocked embedding (matches the mock exactly)
    const { vectorSearch } = await import('../db')
    const results = vectorSearch(new Float32Array(384).fill(0.5), 10)

    // Verify results
    expect(results.length).toBeGreaterThan(0)

    // Verify each result has a score
    for (const result of results) {
      expect(typeof result.score).toBe('number')
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(1)
    }

    // Verify results are sorted by score descending
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score)
    }
  })
})

describe('Scenario 4: prune oldest exchanges', () => {
  it('should prune oldest exchanges when capacity is exceeded', async () => {
    // Initialize database
    const { initDatabase, insertExchange, pruneToCapacity, getDatabase } = await import('../db')
    initDatabase()

    // Insert 5 exchanges with sequential timestamps
    const exchanges = [
      makeExchange({ id: 'ex-1', timestamp: 1000, userMessage: 'First user message with enough content', assistantMessage: 'First assistant response' }),
      makeExchange({ id: 'ex-2', timestamp: 2000, userMessage: 'Second user message with enough content', assistantMessage: 'Second assistant response' }),
      makeExchange({ id: 'ex-3', timestamp: 3000, userMessage: 'Third user message with enough content', assistantMessage: 'Third assistant response' }),
      makeExchange({ id: 'ex-4', timestamp: 4000, userMessage: 'Fourth user message with enough content', assistantMessage: 'Fourth assistant response' }),
      makeExchange({ id: 'ex-5', timestamp: 5000, userMessage: 'Fifth user message with enough content', assistantMessage: 'Fifth assistant response' }),
    ]

    for (const ex of exchanges) {
      insertExchange(ex)
    }

    // Get current db file size
    const db = getDatabase()
    const initialCount = db.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number }
    expect(initialCount.count).toBe(5)

    // Call pruneToCapacity with 1 byte (forces pruning)
    const prunedCount = pruneToCapacity(1)

    // Verify some exchanges were pruned
    expect(prunedCount).toBeGreaterThan(0)

    // Verify count decreased
    const finalCount = db.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number }
    expect(finalCount.count).toBeLessThan(5)

    // If any rows remain, verify oldest timestamp is greater than 1000
    if (finalCount.count > 0) {
      const oldestRow = db.prepare('SELECT MIN(timestamp) as oldest FROM exchanges').get() as { oldest: number }
      expect(oldestRow.oldest).toBeGreaterThan(1000)
    }
  })
})

describe('Scenario 5: export roundtrip', () => {
  it('should export database to JSON with correct metadata and no embeddings', async () => {
    // Initialize database and import functions
    const { initDatabase, insertExchange, upsertSession } = await import('../db')
    const { runExport } = await import('../export')
    initDatabase()

    // Insert 3 exchanges with the same sessionId
    const sessionId = 'session-export'
    const projectPath = '/test/project'

    insertExchange(makeExchange({
      id: 'exp-1',
      sessionId,
      projectPath,
      timestamp: 1000,
      userMessage: 'First export test message with enough content for indexing',
      assistantMessage: 'First export response with enough content'
    }))

    insertExchange(makeExchange({
      id: 'exp-2',
      sessionId,
      projectPath,
      timestamp: 2000,
      userMessage: 'Second export test message with enough content for indexing',
      assistantMessage: 'Second export response with enough content'
    }))

    insertExchange(makeExchange({
      id: 'exp-3',
      sessionId,
      projectPath,
      timestamp: 3000,
      userMessage: 'Third export test message with enough content for indexing',
      assistantMessage: 'Third export response with enough content'
    }))

    // Upsert session for each exchange
    upsertSession(sessionId, projectPath, 1000)
    upsertSession(sessionId, projectPath, 2000)
    upsertSession(sessionId, projectPath, 3000)

    // Create valid export path within CONFIG_DIR/exports/
    const exportPath = path.join(tmpDir, 'exports', 'test-export.json')

    // Run export
    const result = await runExport(exportPath)

    // Verify export result
    expect(result.exchangeCount).toBe(3)
    expect(result.sessionCount).toBe(1)
    expect(result.outputPath).toBe(exportPath)
    expect(result.fileSizeBytes).toBeGreaterThan(0)

    // Read and parse exported file
    const exportedContent = fs.readFileSync(exportPath, 'utf-8')
    const parsed = JSON.parse(exportedContent)

    // Verify metadata
    expect(parsed.metadata.exchange_count).toBe(3)
    expect(parsed.metadata.session_count).toBe(1)
    expect(parsed.metadata.version).toBe('1.0.0')

    // Verify exchanges and sessions arrays
    expect(Array.isArray(parsed.exchanges)).toBe(true)
    expect(parsed.exchanges.length).toBe(3)
    expect(Array.isArray(parsed.sessions)).toBe(true)
    expect(parsed.sessions.length).toBe(1)

    // Verify no exchange has an embedding field (embeddings are stripped on export)
    for (const exchange of parsed.exchanges) {
      expect(exchange.embedding).toBeUndefined()
    }
  })
})

describe('Scenario 6: repair dry run detects issues', () => {
  it('should detect stale source references without fixing them', async () => {
    // Initialize database
    const { initDatabase, insertExchange } = await import('../db')
    const { runRepair } = await import('../repair')
    initDatabase()

    // Insert 2 exchanges with nonexistent source files (stale references)
    insertExchange(makeExchange({
      id: 'repair-1',
      sourceFile: '/nonexistent/path/conversation.jsonl',
      userMessage: 'First repair test with enough content for storage',
      assistantMessage: 'First repair response with enough content'
    }))

    insertExchange(makeExchange({
      id: 'repair-2',
      sourceFile: '/also/nonexistent/file.jsonl',
      userMessage: 'Second repair test with enough content for storage',
      assistantMessage: 'Second repair response with enough content'
    }))

    // Run repair in dry run mode
    const report = await runRepair(true)

    // Verify dry run flag is set
    expect(report.dryRun).toBe(true)

    // Verify total issues detected
    expect(report.totalIssues).toBeGreaterThan(0)

    // Find the stale references check
    const staleCheck = report.checks.find(c => c.name.toLowerCase().includes('stale'))
    expect(staleCheck).toBeDefined()
    expect(staleCheck?.status).toBe('warning')
    expect(staleCheck?.count).toBe(2)

    // Verify index rebuild and optimization are skipped in dry run mode
    const indexCheck = report.checks.find(c => c.name.toLowerCase().includes('index rebuild'))
    const optimizeCheck = report.checks.find(c => c.name.toLowerCase().includes('optimization'))
    expect(indexCheck?.status).toBe('skipped')
    expect(optimizeCheck?.status).toBe('skipped')
  })
})

describe('Scenario 7: repair fix resolves issues', () => {
  it('should run index rebuild and optimization in fix mode', async () => {
    // Initialize database
    const { initDatabase, insertExchange } = await import('../db')
    const { runRepair } = await import('../repair')
    initDatabase()

    // Insert 2 exchanges with stale source files (same pattern as scenario 6)
    insertExchange(makeExchange({
      id: 'fix-1',
      sourceFile: '/nonexistent/fix/path1.jsonl',
      userMessage: 'First fix test with enough content for storage',
      assistantMessage: 'First fix response with enough content'
    }))

    insertExchange(makeExchange({
      id: 'fix-2',
      sourceFile: '/nonexistent/fix/path2.jsonl',
      userMessage: 'Second fix test with enough content for storage',
      assistantMessage: 'Second fix response with enough content'
    }))

    // Run repair in fix mode
    const fixReport = await runRepair(false)

    // Verify fix mode flag
    expect(fixReport.dryRun).toBe(false)

    // Verify database size fields are present
    expect(typeof fixReport.databaseSizeBefore).toBe('number')
    expect(fixReport.databaseSizeBefore).toBeGreaterThan(0)
    expect(typeof fixReport.databaseSizeAfter).toBe('number')
    expect(fixReport.databaseSizeAfter).toBeGreaterThan(0)

    // Verify index rebuild and optimization checks have run (status is 'ok' or 'fixed', not 'skipped')
    const indexCheck = fixReport.checks.find(c => c.name.toLowerCase().includes('index rebuild'))
    const optimizeCheck = fixReport.checks.find(c => c.name.toLowerCase().includes('optimization'))
    expect(indexCheck?.status).not.toBe('skipped')
    expect(optimizeCheck?.status).not.toBe('skipped')

    // Run a dry run to confirm structural and referential integrity are clean
    const verifyReport = await runRepair(true)

    // Stale references are warnings (not auto-fixed), so they may still appear
    // The key assertion is that structural and referential integrity are clean
    const structuralCheck = verifyReport.checks.find(c => c.name.toLowerCase().includes('structural integrity'))
    const referentialCheck = verifyReport.checks.find(c => c.name.toLowerCase().includes('referential integrity'))
    expect(structuralCheck?.status).toBe('ok')
    expect(referentialCheck?.status).toBe('ok')
  })
})
