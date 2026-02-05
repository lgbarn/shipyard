/**
 * Tests for indexer functions: runFullIndex, runIncrementalIndex, runImport, and indexCurrentSession.
 *
 * Uses hybrid mocking strategy:
 * - Real temp-file SQLite database (to test isFileIndexed queries and insertExchange writes)
 * - Mocked parser, embeddings, and config
 * - Real scrubber (fast pure function, already tested)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { ParsedExchange } from '../types'

let tmpDir: string
let dbPath: string

// Mock config with tmpDir pattern (same as backup.test.ts)
vi.mock('../config', async () => {
  const actual = await vi.importActual('../config')
  return {
    ...actual,
    get CONFIG_DIR() { return tmpDir },
    get DATABASE_PATH() { return dbPath },
    get CLAUDE_PROJECTS_DIR() { return path.join(tmpDir, 'claude-projects') },
    ensureConfigDir: () => {
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    },
    isProjectExcluded: vi.fn(() => false),
    getStorageCapBytes: vi.fn(() => 1073741824), // 1GB -- large enough to never trigger pruning
  }
})

// Mock embeddings
vi.mock('../embeddings', () => ({
  generateExchangeEmbedding: vi.fn(async () => new Float32Array(384).fill(0.5)),
}))

// Mock parser
vi.mock('../parser', () => ({
  findConversationFiles: vi.fn(() => []),
  parseConversationFile: vi.fn(async () => []),
  decodeProjectPath: vi.fn((p: string) => p),
}))

// Mock logger
vi.mock('../logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(async () => {
  vi.clearAllMocks()
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'indexer-test-'))
  dbPath = path.join(tmpDir, 'memory.db')
  const claudeProjectsDir = path.join(tmpDir, 'claude-projects')
  fs.mkdirSync(claudeProjectsDir, { recursive: true })

  const { closeDatabase } = await import('../db')
  closeDatabase()
})

afterEach(async () => {
  const { closeDatabase } = await import('../db')
  closeDatabase()
  vi.restoreAllMocks()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('isFileIndexed — via runFullIndex behavior', () => {
  it('indexes a new file that has not been indexed before', async () => {
    const { runFullIndex } = await import('../indexer')
    const { getDatabase } = await import('../db')
    const { findConversationFiles, parseConversationFile } = await import('../parser')

    const testFilePath = path.join(tmpDir, 'test-project', 'session.jsonl')
    const modifiedAt = Date.now()

    // Mock findConversationFiles to return one file
    vi.mocked(findConversationFiles).mockReturnValue([
      {
        path: testFilePath,
        projectPath: path.join(tmpDir, 'test-project'),
        modifiedAt,
      },
    ])

    // Mock parseConversationFile to return one exchange with sufficient content (>50 chars)
    const parsedExchange: ParsedExchange = {
      userMessage: 'This is a test user message with more than fifty characters in total.',
      assistantMessage: 'This is a test assistant response with sufficient content length.',
      toolNames: ['Read'],
      timestamp: Date.now(),
      sessionId: 'test-session-1',
    }
    vi.mocked(parseConversationFile).mockResolvedValue([parsedExchange])

    // Call runFullIndex
    await runFullIndex()

    // Verify insertExchange was called by querying the exchanges table directly
    const db = getDatabase()
    const rows = db.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number }
    expect(rows.count).toBe(1)
  })

  it('skips a file that is already indexed', async () => {
    const { runFullIndex } = await import('../indexer')
    const { getDatabase } = await import('../db')
    const { findConversationFiles, parseConversationFile } = await import('../parser')

    const testFilePath = path.join(tmpDir, 'test-project', 'session.jsonl')
    const modifiedAt = Date.now()

    // Mock findConversationFiles to return one file
    vi.mocked(findConversationFiles).mockReturnValue([
      {
        path: testFilePath,
        projectPath: path.join(tmpDir, 'test-project'),
        modifiedAt,
      },
    ])

    // Mock parseConversationFile to return one exchange
    const parsedExchange: ParsedExchange = {
      userMessage: 'This is a test user message with more than fifty characters in total.',
      assistantMessage: 'This is a test assistant response with sufficient content length.',
      toolNames: ['Read'],
      timestamp: Date.now(),
      sessionId: 'test-session-1',
    }
    vi.mocked(parseConversationFile).mockResolvedValue([parsedExchange])

    // First call to runFullIndex - should index the file
    await runFullIndex()

    // Verify 1 row was inserted
    const db = getDatabase()
    const rows1 = db.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number }
    expect(rows1.count).toBe(1)

    // Second call to runFullIndex with same file and same modifiedAt - should skip
    await runFullIndex()

    // Verify still only 1 row (not 2)
    const rows2 = db.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number }
    expect(rows2.count).toBe(1)
  })
})

describe('indexExchange — short content skip', () => {
  it('skips exchanges with content below MIN_CONTENT_LENGTH', async () => {
    const { runFullIndex } = await import('../indexer')
    const { getDatabase } = await import('../db')
    const { findConversationFiles, parseConversationFile } = await import('../parser')

    const testFilePath = path.join(tmpDir, 'test-project', 'session.jsonl')

    // Mock findConversationFiles to return one file
    vi.mocked(findConversationFiles).mockReturnValue([
      {
        path: testFilePath,
        projectPath: path.join(tmpDir, 'test-project'),
        modifiedAt: Date.now(),
      },
    ])

    // Mock parseConversationFile to return exchange with total content < 50 chars
    const shortExchange: ParsedExchange = {
      userMessage: 'Hi',
      assistantMessage: 'Hello',
      toolNames: [],
      timestamp: Date.now(),
      sessionId: 'test-session-short',
    }
    vi.mocked(parseConversationFile).mockResolvedValue([shortExchange])

    // Call runFullIndex
    await runFullIndex()

    // Verify generateExchangeEmbedding was NOT called
    const { generateExchangeEmbedding: mockEmbedding } = await import('../embeddings')
    expect(mockEmbedding).not.toHaveBeenCalled()

    // Verify exchanges table is empty
    const db = getDatabase()
    const rows = db.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number }
    expect(rows.count).toBe(0)
  })

  it('indexes exchanges with content at or above MIN_CONTENT_LENGTH', async () => {
    const { runFullIndex } = await import('../indexer')
    const { getDatabase } = await import('../db')
    const { findConversationFiles, parseConversationFile } = await import('../parser')

    const testFilePath = path.join(tmpDir, 'test-project', 'session.jsonl')

    // Mock findConversationFiles to return one file
    vi.mocked(findConversationFiles).mockReturnValue([
      {
        path: testFilePath,
        projectPath: path.join(tmpDir, 'test-project'),
        modifiedAt: Date.now(),
      },
    ])

    // Mock parseConversationFile to return exchange with total content >= 50 chars
    const validExchange: ParsedExchange = {
      userMessage: 'This is a user message',
      assistantMessage: 'This is an assistant response message',
      toolNames: ['Read'],
      timestamp: Date.now(),
      sessionId: 'test-session-valid',
    }
    vi.mocked(parseConversationFile).mockResolvedValue([validExchange])

    // Call runFullIndex
    await runFullIndex()

    // Verify generateExchangeEmbedding WAS called
    const { generateExchangeEmbedding } = await import('../embeddings')
    expect(generateExchangeEmbedding).toHaveBeenCalled()

    // Verify exchanges table has 1 row
    const db = getDatabase()
    const rows = db.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number }
    expect(rows.count).toBe(1)
  })
})

describe('runFullIndex', () => {
  it('reports correct progress for multiple files', async () => {
    const { runFullIndex } = await import('../indexer')
    const { findConversationFiles, parseConversationFile } = await import('../parser')

    // Mock findConversationFiles to return 3 files
    vi.mocked(findConversationFiles).mockReturnValue([
      {
        path: path.join(tmpDir, 'project1', 'session1.jsonl'),
        projectPath: path.join(tmpDir, 'project1'),
        modifiedAt: Date.now(),
      },
      {
        path: path.join(tmpDir, 'project2', 'session2.jsonl'),
        projectPath: path.join(tmpDir, 'project2'),
        modifiedAt: Date.now(),
      },
      {
        path: path.join(tmpDir, 'project3', 'session3.jsonl'),
        projectPath: path.join(tmpDir, 'project3'),
        modifiedAt: Date.now(),
      },
    ])

    // Mock parseConversationFile to return 2 exchanges per file
    vi.mocked(parseConversationFile).mockResolvedValue([
      {
        userMessage: 'First user message with sufficient length for indexing.',
        assistantMessage: 'First assistant response with sufficient length.',
        toolNames: ['Read'],
        timestamp: Date.now(),
        sessionId: 'session-1',
      },
      {
        userMessage: 'Second user message with sufficient length for indexing.',
        assistantMessage: 'Second assistant response with sufficient length.',
        toolNames: ['Write'],
        timestamp: Date.now(),
        sessionId: 'session-1',
      },
    ])

    // Call runFullIndex with progress callback
    let finalProgress: any = null
    const progress = await runFullIndex((p) => {
      finalProgress = p
    })

    // Verify final progress
    expect(progress.totalFiles).toBe(3)
    expect(progress.processedFiles).toBe(3)
    expect(progress.indexedExchanges).toBe(6)
    expect(progress.errors).toBe(0)

    // Verify callback was called with final progress
    expect(finalProgress).toEqual(progress)
  })

  it('skips excluded projects', async () => {
    const { runFullIndex } = await import('../indexer')
    const { getDatabase } = await import('../db')
    const { findConversationFiles, parseConversationFile } = await import('../parser')
    const { isProjectExcluded } = await import('../config')

    const excludedPath = path.join(tmpDir, 'excluded-project')
    const includedPath = path.join(tmpDir, 'included-project')

    // Mock findConversationFiles to return 2 files from different projects
    vi.mocked(findConversationFiles).mockReturnValue([
      {
        path: path.join(excludedPath, 'session1.jsonl'),
        projectPath: excludedPath,
        modifiedAt: Date.now(),
      },
      {
        path: path.join(includedPath, 'session2.jsonl'),
        projectPath: includedPath,
        modifiedAt: Date.now(),
      },
    ])

    // Mock isProjectExcluded to return true for excluded project
    vi.mocked(isProjectExcluded).mockImplementation((p) => p === excludedPath)

    // Mock parseConversationFile to return 1 exchange per file
    vi.mocked(parseConversationFile).mockResolvedValue([
      {
        userMessage: 'User message with sufficient length for indexing purposes.',
        assistantMessage: 'Assistant response with sufficient length for indexing.',
        toolNames: ['Read'],
        timestamp: Date.now(),
        sessionId: 'session-test',
      },
    ])

    // Call runFullIndex
    await runFullIndex()

    // Verify only 1 file's exchanges are indexed (from included project)
    const db = getDatabase()
    const rows = db.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number }
    expect(rows.count).toBe(1)

    // Verify the indexed exchange is from the included project
    const exchange = db.prepare('SELECT project_path FROM exchanges LIMIT 1').get() as { project_path: string }
    expect(exchange.project_path).toBe(includedPath)
  })

  it('calls pruneToCapacity after indexing', async () => {
    const { runFullIndex } = await import('../indexer')
    const { findConversationFiles, parseConversationFile } = await import('../parser')
    const pruneModule = await import('../db')

    // Spy on pruneToCapacity
    const pruneSpy = vi.spyOn(pruneModule, 'pruneToCapacity')

    // Mock findConversationFiles to return 1 file
    vi.mocked(findConversationFiles).mockReturnValue([
      {
        path: path.join(tmpDir, 'project1', 'session1.jsonl'),
        projectPath: path.join(tmpDir, 'project1'),
        modifiedAt: Date.now(),
      },
    ])

    // Mock parseConversationFile to return 1 exchange
    vi.mocked(parseConversationFile).mockResolvedValue([
      {
        userMessage: 'User message with sufficient length for indexing purposes.',
        assistantMessage: 'Assistant response with sufficient length for indexing.',
        toolNames: ['Read'],
        timestamp: Date.now(),
        sessionId: 'session-test',
      },
    ])

    // Call runFullIndex
    await runFullIndex()

    // Verify pruneToCapacity was called with 1GB (1073741824 bytes)
    expect(pruneSpy).toHaveBeenCalledWith(1073741824)
  })

  it('handles indexExchange errors gracefully', async () => {
    const { runFullIndex } = await import('../indexer')
    const { findConversationFiles, parseConversationFile } = await import('../parser')
    const { generateExchangeEmbedding } = await import('../embeddings')

    // Mock findConversationFiles to return 1 file
    vi.mocked(findConversationFiles).mockReturnValue([
      {
        path: path.join(tmpDir, 'project1', 'session1.jsonl'),
        projectPath: path.join(tmpDir, 'project1'),
        modifiedAt: Date.now(),
      },
    ])

    // Mock parseConversationFile to return 2 exchanges
    vi.mocked(parseConversationFile).mockResolvedValue([
      {
        userMessage: 'First user message with sufficient length for indexing.',
        assistantMessage: 'First assistant response with sufficient length.',
        toolNames: ['Read'],
        timestamp: Date.now(),
        sessionId: 'session-1',
      },
      {
        userMessage: 'Second user message with sufficient length for indexing.',
        assistantMessage: 'Second assistant response with sufficient length.',
        toolNames: ['Write'],
        timestamp: Date.now(),
        sessionId: 'session-1',
      },
    ])

    // Mock generateExchangeEmbedding to throw on first call, succeed on second
    vi.mocked(generateExchangeEmbedding)
      .mockRejectedValueOnce(new Error('Embedding generation failed'))
      .mockResolvedValue(new Float32Array(384).fill(0.5))

    // Call runFullIndex
    const progress = await runFullIndex()

    // Verify progress reflects 1 error and 1 success
    expect(progress.errors).toBe(0) // File-level errors, not exchange-level
    expect(progress.indexedExchanges).toBe(1) // Only the second exchange succeeded
  })
})

describe('runIncrementalIndex', () => {
  it('delegates to runFullIndex behavior', async () => {
    const { runIncrementalIndex } = await import('../indexer')
    const { getDatabase } = await import('../db')
    const { findConversationFiles, parseConversationFile } = await import('../parser')

    // Mock findConversationFiles to return 1 file
    vi.mocked(findConversationFiles).mockReturnValue([
      {
        path: path.join(tmpDir, 'project1', 'session1.jsonl'),
        projectPath: path.join(tmpDir, 'project1'),
        modifiedAt: Date.now(),
      },
    ])

    // Mock parseConversationFile to return 1 exchange
    vi.mocked(parseConversationFile).mockResolvedValue([
      {
        userMessage: 'User message with sufficient length for indexing purposes.',
        assistantMessage: 'Assistant response with sufficient length for indexing.',
        toolNames: ['Read'],
        timestamp: Date.now(),
        sessionId: 'session-test',
      },
    ])

    // Call runIncrementalIndex
    await runIncrementalIndex()

    // Verify the same indexing behavior occurs (exchanges are inserted)
    const db = getDatabase()
    const rows = db.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number }
    expect(rows.count).toBe(1)
  })
})

describe('runImport', () => {
  it('runs full index when import not completed', async () => {
    const { runImport } = await import('../indexer')
    const { getDatabase, getImportState } = await import('../db')
    const { findConversationFiles, parseConversationFile } = await import('../parser')

    // Mock findConversationFiles to return 1 file
    vi.mocked(findConversationFiles).mockReturnValue([
      {
        path: path.join(tmpDir, 'project1', 'session1.jsonl'),
        projectPath: path.join(tmpDir, 'project1'),
        modifiedAt: Date.now(),
      },
    ])

    // Mock parseConversationFile to return 1 exchange
    vi.mocked(parseConversationFile).mockResolvedValue([
      {
        userMessage: 'User message with sufficient length for indexing purposes.',
        assistantMessage: 'Assistant response with sufficient length for indexing.',
        toolNames: ['Read'],
        timestamp: Date.now(),
        sessionId: 'session-test',
      },
    ])

    // Call runImport
    await runImport()

    // Verify exchanges are indexed
    const db = getDatabase()
    const rows = db.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number }
    expect(rows.count).toBe(1)

    // Verify import_completed is set to 'true'
    const importCompleted = getImportState('import_completed')
    expect(importCompleted).toBe('true')

    // Verify import_timestamp is set
    const importTimestamp = getImportState('import_timestamp')
    expect(importTimestamp).not.toBeNull()
    expect(Number(importTimestamp)).toBeGreaterThan(0)
  })

  it('returns empty progress when already imported', async () => {
    const { runImport } = await import('../indexer')
    const { setImportState } = await import('../db')
    const { findConversationFiles } = await import('../parser')

    // Set import_completed to 'true'
    setImportState('import_completed', 'true')

    // Spy on findConversationFiles to verify it's not called
    const findSpy = vi.mocked(findConversationFiles)

    // Call runImport
    const progress = await runImport()

    // Verify returned progress has all zeros
    expect(progress.totalFiles).toBe(0)
    expect(progress.processedFiles).toBe(0)
    expect(progress.totalExchanges).toBe(0)
    expect(progress.indexedExchanges).toBe(0)
    expect(progress.errors).toBe(0)

    // Verify findConversationFiles was not called
    expect(findSpy).not.toHaveBeenCalled()
  })

  it('force flag re-imports even when already completed', async () => {
    const { runImport } = await import('../indexer')
    const { getDatabase, setImportState, getImportState } = await import('../db')
    const { findConversationFiles, parseConversationFile } = await import('../parser')

    // Set import_completed to 'true'
    setImportState('import_completed', 'true')

    // Mock findConversationFiles to return 1 file
    vi.mocked(findConversationFiles).mockReturnValue([
      {
        path: path.join(tmpDir, 'project1', 'session1.jsonl'),
        projectPath: path.join(tmpDir, 'project1'),
        modifiedAt: Date.now(),
      },
    ])

    // Mock parseConversationFile to return 1 exchange
    vi.mocked(parseConversationFile).mockResolvedValue([
      {
        userMessage: 'User message with sufficient length for indexing purposes.',
        assistantMessage: 'Assistant response with sufficient length for indexing.',
        toolNames: ['Read'],
        timestamp: Date.now(),
        sessionId: 'session-test',
      },
    ])

    // Call runImport with force=true
    await runImport(true)

    // Verify files WERE processed (exchanges indexed)
    const db = getDatabase()
    const rows = db.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number }
    expect(rows.count).toBe(1)

    // Verify import_completed is still 'true'
    const importCompleted = getImportState('import_completed')
    expect(importCompleted).toBe('true')
  })
})

describe('indexCurrentSession', () => {
  it('indexes exchanges from a live session', async () => {
    const { indexCurrentSession } = await import('../indexer')
    const { getDatabase } = await import('../db')

    // Create 2 ParsedExchange objects with >50 chars content
    const exchanges: ParsedExchange[] = [
      {
        userMessage: 'First user message from live session with sufficient content.',
        assistantMessage: 'First assistant response from live session with sufficient content.',
        toolNames: ['Read'],
        timestamp: Date.now(),
        sessionId: 'session-1',
      },
      {
        userMessage: 'Second user message from live session with sufficient content.',
        assistantMessage: 'Second assistant response from live session with sufficient content.',
        toolNames: ['Write'],
        timestamp: Date.now(),
        sessionId: 'session-1',
      },
    ]

    // Call indexCurrentSession
    const indexed = await indexCurrentSession('session-1', exchanges, '/test/project')

    // Verify 2 exchanges were indexed
    expect(indexed).toBe(2)

    // Verify 2 rows in exchanges table
    const db = getDatabase()
    const rows = db.prepare('SELECT COUNT(*) as count FROM exchanges WHERE session_id = ?').get('session-1') as { count: number }
    expect(rows.count).toBe(2)

    // Verify source_file starts with 'session:'
    const sourceFiles = db.prepare('SELECT DISTINCT source_file FROM exchanges').all() as Array<{ source_file: string }>
    expect(sourceFiles).toHaveLength(1)
    expect(sourceFiles[0].source_file).toBe('session:session-1')
  })

  it('returns 0 when project is excluded', async () => {
    const { indexCurrentSession } = await import('../indexer')
    const { getDatabase } = await import('../db')
    const { isProjectExcluded } = await import('../config')

    // Mock isProjectExcluded to return true
    vi.mocked(isProjectExcluded).mockReturnValue(true)

    // Create 1 ParsedExchange
    const exchanges: ParsedExchange[] = [
      {
        userMessage: 'User message from excluded project with sufficient content.',
        assistantMessage: 'Assistant response from excluded project with sufficient content.',
        toolNames: ['Read'],
        timestamp: Date.now(),
        sessionId: 'session-excluded',
      },
    ]

    // Call indexCurrentSession
    const indexed = await indexCurrentSession('session-excluded', exchanges, '/excluded/project')

    // Verify return value is 0
    expect(indexed).toBe(0)

    // Verify exchanges table is empty
    const db = getDatabase()
    const rows = db.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number }
    expect(rows.count).toBe(0)
  })

  it('skips short exchanges in session indexing', async () => {
    const { indexCurrentSession } = await import('../indexer')

    // Create a ParsedExchange with total content < 50 chars
    const shortExchange: ParsedExchange = {
      userMessage: 'Hi',
      assistantMessage: 'Hello',
      toolNames: [],
      timestamp: Date.now(),
      sessionId: 'session-short',
    }

    // Call indexCurrentSession
    const indexed = await indexCurrentSession('session-short', [shortExchange], '/test/project')

    // Verify return value is 0
    expect(indexed).toBe(0)
  })
})
