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
// @ts-expect-error - defined for use in later scenarios
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
