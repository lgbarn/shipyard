/**
 * Tests for embeddings.ts — timeout behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Controllable mock model function
let mockModelFn: ReturnType<typeof vi.fn>;

// Mock @xenova/transformers — pipeline returns our controllable mock model
vi.mock('@xenova/transformers', () => {
  return {
    pipeline: vi.fn(() => {
      // Return a resolved promise with the mock model to avoid fake timer interaction during initModel()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Promise.resolve((...args: any[]) => mockModelFn(...args));
    }),
  };
});

// Mock logger to suppress output during tests
vi.mock('../logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  mockModelFn = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('generateEmbedding timeout', () => {
  it('resolves normally when model responds within timeout', async () => {
    // Configure mock model to return immediately
    mockModelFn.mockResolvedValue({
      data: new Float32Array(384).fill(0.1),
    });

    const { generateEmbedding } = await import('../embeddings');
    const result = await generateEmbedding('test text');

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(384);
  });

  it('rejects with timeout error when model exceeds 30 seconds', async () => {
    // Configure mock model to return a promise that never resolves
    mockModelFn.mockReturnValue(new Promise(() => {}));

    const { generateEmbedding } = await import('../embeddings');
    const promise = generateEmbedding('test text');

    // Advance fake timers by 30 seconds
    vi.advanceTimersByTime(30_000);

    await expect(promise).rejects.toThrow('Embedding generation timed out after 30s');
  });

  it('cleans up timer on successful completion (no leaked timers)', async () => {
    // Configure mock model to resolve immediately
    mockModelFn.mockResolvedValue({
      data: new Float32Array(384).fill(0.1),
    });

    const { generateEmbedding } = await import('../embeddings');
    await generateEmbedding('test text');

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('generateEmbeddings timeout', () => {
  it('rejects when any single model call in batch exceeds timeout', async () => {
    let callCount = 0;
    // First call resolves immediately, second call never resolves
    mockModelFn.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: new Float32Array(384).fill(0.1) });
      }
      return new Promise(() => {});
    });

    const { generateEmbeddings } = await import('../embeddings');
    const promise = generateEmbeddings(['text1', 'text2']);

    // Advance fake timers by 30 seconds
    vi.advanceTimersByTime(30_000);

    await expect(promise).rejects.toThrow('Embedding generation timed out after 30s');
  });
});
