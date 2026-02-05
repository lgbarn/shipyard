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

describe('searchMultipleConcepts', () => {
  it('returns empty for empty concepts array', async () => {
    const { searchMultipleConcepts } = await import('../search')
    const { generateEmbedding } = await import('../embeddings')

    const results = await searchMultipleConcepts([])

    // Verify returns empty array
    expect(results).toEqual([])

    // Verify generateEmbedding was not called
    expect(generateEmbedding).not.toHaveBeenCalled()
  })

  it('delegates to search() for single concept', async () => {
    const { searchMultipleConcepts } = await import('../search')
    const { generateEmbedding } = await import('../embeddings')
    const { vectorSearch } = await import('../db')

    // Reset mocks
    vi.mocked(generateEmbedding).mockResolvedValue(new Float32Array(384).fill(0.5))

    // Mock vectorSearch to return 2 results
    const mockResults = [makeSearchResult(), makeSearchResult()]
    vi.mocked(vectorSearch).mockReturnValue(mockResults)

    const results = await searchMultipleConcepts(['concept1'])

    // Verify generateEmbedding was called once (delegated to search())
    expect(generateEmbedding).toHaveBeenCalledTimes(1)

    // Verify results are returned
    expect(results).toHaveLength(2)
  })

  it('intersects results across multiple concepts', async () => {
    const { searchMultipleConcepts } = await import('../search')
    const { generateEmbedding } = await import('../embeddings')
    const { vectorSearch } = await import('../db')

    // Reset mocks
    vi.mocked(generateEmbedding).mockResolvedValue(new Float32Array(384).fill(0.5))

    // Create 3 exchanges
    const ex1 = makeSearchResult({ id: 'ex1', score: 0.9 })
    const ex2 = makeSearchResult({ id: 'ex2', score: 0.8 })
    const ex3 = makeSearchResult({ id: 'ex3', score: 0.6 })

    // Mock vectorSearch to return different subsets per call
    // First call (concept A): returns ex1 (score 0.9), ex2 (score 0.8)
    // Second call (concept B): returns ex2 (score 0.7), ex3 (score 0.6)
    vi.mocked(vectorSearch)
      .mockReturnValueOnce([ex1, ex2])
      .mockReturnValueOnce([
        makeSearchResult({ id: 'ex2', score: 0.7 }),
        ex3,
      ])

    const results = await searchMultipleConcepts(['conceptA', 'conceptB'])

    // Only ex2 appears in both, so result should contain only ex2
    expect(results).toHaveLength(1)
    expect(results[0].exchange.id).toBe('ex2')

    // Score should be normalized: (0.8 + 0.7) / 2 = 0.75
    expect(results[0].score).toBe(0.75)
  })

  it('returns empty when no exchanges match all concepts', async () => {
    const { searchMultipleConcepts } = await import('../search')
    const { generateEmbedding } = await import('../embeddings')
    const { vectorSearch } = await import('../db')

    // Reset mocks
    vi.mocked(generateEmbedding).mockResolvedValue(new Float32Array(384).fill(0.5))

    // Mock vectorSearch to return non-overlapping id sets
    const ex1 = makeSearchResult({ id: 'ex1' })
    const ex2 = makeSearchResult({ id: 'ex2' })

    vi.mocked(vectorSearch)
      .mockReturnValueOnce([ex1])
      .mockReturnValueOnce([ex2])

    const results = await searchMultipleConcepts(['conceptA', 'conceptB'])

    // No overlap, so empty array
    expect(results).toEqual([])
  })
})

describe('formatResultsAsMarkdown', () => {
  it('returns "No results found." for empty array', async () => {
    const { formatResultsAsMarkdown } = await import('../search')

    const output = formatResultsAsMarkdown([])

    expect(output).toBe('No results found.')
  })

  it('formats single result with all fields', async () => {
    const { formatResultsAsMarkdown } = await import('../search')

    const result = makeSearchResult({
      timestamp: new Date('2025-01-15T10:30:00Z').getTime(),
      projectPath: '/test/my-project',
      toolNames: ['Read', 'Write', 'Bash'],
      userMessage: 'What is the capital of France?',
      assistantMessage: 'The capital of France is Paris.',
      score: 0.92,
    })

    const output = formatResultsAsMarkdown([result])

    // Verify output contains expected sections
    expect(output).toContain('### Exchange')
    expect(output).toContain('2025-01-15') // Date in YYYY-MM-DD format
    expect(output).toContain('0.92') // Score formatted to 2 decimal places
    expect(output).toContain('**Project:** /test/my-project')
    expect(output).toContain('**User:**')
    expect(output).toContain('What is the capital of France?')
    expect(output).toContain('**Assistant:**')
    expect(output).toContain('The capital of France is Paris.')
    expect(output).toContain('Tools: Read, Write, Bash')
    expect(output).toContain('---') // Separator
  })

  it('truncates long messages', async () => {
    const { formatResultsAsMarkdown } = await import('../search')

    const longMessage = 'a'.repeat(250)
    const result = makeSearchResult({
      userMessage: longMessage,
    })

    const output = formatResultsAsMarkdown([result])

    // Verify truncation marker
    expect(output).toContain('...')
    // User message is truncated to 200 chars
    expect(output).not.toContain('a'.repeat(250))
  })
})

describe('formatResultsAsJson', () => {
  it('returns empty array JSON for empty results', async () => {
    const { formatResultsAsJson } = await import('../search')

    const output = formatResultsAsJson([])

    expect(JSON.parse(output)).toEqual([])
  })

  it('includes correct fields in JSON output', async () => {
    const { formatResultsAsJson } = await import('../search')

    const result = makeSearchResult({
      id: 'test-id-123',
      timestamp: 1705320000000,
      projectPath: '/test/project',
      toolNames: ['Read', 'Write'],
      userMessage: 'User message',
      assistantMessage: 'Assistant message',
      score: 0.88,
    })

    const output = formatResultsAsJson([result])
    const parsed = JSON.parse(output)

    // Verify correct fields
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toHaveProperty('id', 'test-id-123')
    expect(parsed[0]).toHaveProperty('score', 0.88)
    expect(parsed[0]).toHaveProperty('timestamp', 1705320000000)
    expect(parsed[0]).toHaveProperty('project', '/test/project')
    expect(parsed[0]).toHaveProperty('toolNames')
    expect(parsed[0]).toHaveProperty('userMessage', 'User message')
    expect(parsed[0]).toHaveProperty('assistantMessage', 'Assistant message')

    // Verify it does NOT contain these fields
    expect(parsed[0]).not.toHaveProperty('embedding')
    expect(parsed[0]).not.toHaveProperty('sourceFile')
    expect(parsed[0]).not.toHaveProperty('lineStart')
    expect(parsed[0]).not.toHaveProperty('lineEnd')
    expect(parsed[0]).not.toHaveProperty('indexedAt')
    expect(parsed[0]).not.toHaveProperty('gitBranch')
    expect(parsed[0]).not.toHaveProperty('sessionId')
  })
})

describe('getMemoryStats', () => {
  it('merges config and db stats', async () => {
    const { getMemoryStats } = await import('../search')

    const stats = getMemoryStats()

    // Verify config values
    expect(stats.enabled).toBe(true)
    expect(stats.storageCapMb).toBe(1024)

    // Verify db values (from mocked getStats)
    expect(stats.exchangeCount).toBe(10)
    expect(stats.databaseSizeMb).toBe(1.5)
    expect(stats.oldestExchange).toBe(1000)
    expect(stats.newestExchange).toBe(3000)
    expect(stats.lastIndexedAt).toBe(3000)
    expect(stats.projectCounts).toEqual([{ project: '/proj', count: 10 }])
    expect(stats.importCompleted).toBe(true)
  })
})
