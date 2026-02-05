/**
 * Tests for search orchestration: search, searchMultipleConcepts, formatting, and stats.
 *
 * Uses pure mocking strategy for embeddings, db, and config dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { SearchResult, Exchange } from '../types'

// Mock embeddings module to avoid slow model loading
vi.mock('../embeddings', () => ({
  generateEmbedding: vi.fn(async () => new Float32Array(384).fill(0.5)),
}))

// Mock db module functions
vi.mock('../db', () => ({
  vectorSearch: vi.fn(() => []),
  textSearch: vi.fn(() => []),
  getStats: vi.fn(() => ({
    databaseSizeMb: 1.5,
    exchangeCount: 10,
    oldestExchange: 1000,
    newestExchange: 3000,
    lastIndexedAt: 3000,
    projectCounts: [{ project: '/proj', count: 10 }],
    importCompleted: true,
  })),
}))

// Mock config module
vi.mock('../config', () => ({
  readGlobalConfig: vi.fn(() => ({
    memory: true,
    memory_storage_cap_mb: 1024,
  })),
  isProjectExcluded: vi.fn(() => false),
}))

// Mock logger to suppress output during tests
vi.mock('../logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

let exchangeCounter = 0

/**
 * Factory to create SearchResult with complete Exchange object
 */
function makeSearchResult(overrides?: Partial<Exchange & { score: number }>): SearchResult {
  exchangeCounter++
  const id = overrides?.id || `ex${exchangeCounter}`

  const exchange: Exchange = {
    id,
    sessionId: overrides?.sessionId || 'session-123',
    projectPath: overrides?.projectPath || '/test/project',
    userMessage: overrides?.userMessage || 'Test user message',
    assistantMessage: overrides?.assistantMessage || 'Test assistant message',
    toolNames: overrides?.toolNames || ['Read', 'Write'],
    timestamp: overrides?.timestamp || Date.now(),
    gitBranch: overrides?.gitBranch || 'main',
    sourceFile: overrides?.sourceFile || '/test/file.jsonl',
    lineStart: overrides?.lineStart || 1,
    lineEnd: overrides?.lineEnd || 10,
    indexedAt: overrides?.indexedAt || Date.now(),
  }

  return {
    exchange,
    score: overrides?.score ?? 0.85,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  exchangeCounter = 0
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('search', () => {
  it('delegates to vectorSearch when it returns results', async () => {
    const { search } = await import('../search')
    const { generateEmbedding } = await import('../embeddings')
    const { vectorSearch, textSearch } = await import('../db')

    // Mock vectorSearch to return 2 results
    const mockResults = [makeSearchResult(), makeSearchResult()]
    vi.mocked(vectorSearch).mockReturnValue(mockResults)

    const results = await search({ query: 'test' })

    // Verify generateEmbedding was called with query
    expect(generateEmbedding).toHaveBeenCalledWith('test')

    // Verify vectorSearch was called with embedding, limit 10, and empty filters
    expect(vectorSearch).toHaveBeenCalledWith(
      expect.any(Float32Array),
      10,
      {}
    )

    // Verify results match what vectorSearch returned
    expect(results).toEqual(mockResults)

    // Verify textSearch was NOT called
    expect(textSearch).not.toHaveBeenCalled()
  })

  it('falls back to textSearch when vectorSearch returns empty', async () => {
    const { search } = await import('../search')
    const { vectorSearch, textSearch } = await import('../db')

    // Mock vectorSearch to return empty, textSearch to return results
    vi.mocked(vectorSearch).mockReturnValue([])
    const mockResults = [makeSearchResult()]
    vi.mocked(textSearch).mockReturnValue(mockResults)

    const results = await search({ query: 'test' })

    // Verify textSearch was called with query, limit, and filters
    expect(textSearch).toHaveBeenCalledWith('test', 10, {})

    // Verify results match what textSearch returned
    expect(results).toEqual(mockResults)
  })

  it('falls back to textSearch when generateEmbedding throws', async () => {
    const { search } = await import('../search')
    const { generateEmbedding } = await import('../embeddings')
    const { vectorSearch, textSearch } = await import('../db')

    // Mock generateEmbedding to throw
    vi.mocked(generateEmbedding).mockRejectedValue(new Error('Model load failed'))

    // Mock textSearch to return results
    const mockResults = [makeSearchResult()]
    vi.mocked(textSearch).mockReturnValue(mockResults)

    const results = await search({ query: 'test' })

    // Verify textSearch was called
    expect(textSearch).toHaveBeenCalledWith('test', 10, {})

    // Verify results match what textSearch returned
    expect(results).toEqual(mockResults)

    // Verify vectorSearch was NOT called
    expect(vectorSearch).not.toHaveBeenCalled()
  })

  it('returns empty when project is excluded', async () => {
    const { search } = await import('../search')
    const { isProjectExcluded } = await import('../config')
    const { vectorSearch, textSearch } = await import('../db')

    // Mock isProjectExcluded to return true
    vi.mocked(isProjectExcluded).mockReturnValue(true)

    const results = await search({ query: 'test', project: '/excluded' })

    // Verify empty array returned
    expect(results).toEqual([])

    // Verify neither vectorSearch nor textSearch was called
    expect(vectorSearch).not.toHaveBeenCalled()
    expect(textSearch).not.toHaveBeenCalled()
  })

  it('passes date filters correctly', async () => {
    const { search } = await import('../search')
    const { generateEmbedding } = await import('../embeddings')
    const { vectorSearch } = await import('../db')
    const { isProjectExcluded } = await import('../config')

    // Reset mocks to ensure clean state
    vi.mocked(isProjectExcluded).mockReturnValue(false)
    vi.mocked(generateEmbedding).mockResolvedValue(new Float32Array(384).fill(0.5))

    // Mock vectorSearch to return results
    vi.mocked(vectorSearch).mockReturnValue([makeSearchResult()])

    await search({
      query: 'test',
      after: '2025-01-15',
      before: '2025-02-15',
    })

    // Verify vectorSearch was called with filters containing timestamps
    expect(vectorSearch).toHaveBeenCalledWith(
      expect.any(Float32Array),
      10,
      {
        afterTimestamp: expect.any(Number),
        beforeTimestamp: expect.any(Number),
      }
    )

    // Verify the timestamps are correctly parsed
    const call = vi.mocked(vectorSearch).mock.calls[0]
    const filters = call[2]

    // afterTimestamp should be start of 2025-01-15 (midnight local time)
    const expectedAfter = new Date('2025-01-15')
    expectedAfter.setHours(0, 0, 0, 0)
    expect(filters?.afterTimestamp).toBe(expectedAfter.getTime())

    // beforeTimestamp should be end of 2025-02-15 (23:59:59.999 local time)
    const expectedBefore = new Date('2025-02-15')
    expectedBefore.setHours(23, 59, 59, 999)
    expect(filters?.beforeTimestamp).toBe(expectedBefore.getTime())
  })
})
