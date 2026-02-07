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
      const model = (...args: any[]) => (mockModelFn as any)(...args);
      return Promise.resolve(model);
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
    mockModelFn.mockResolvedValue({
      data: new Float32Array(384).fill(0.1),
    });

    const { generateEmbedding } = await import('../embeddings');
    const result = await generateEmbedding('test text');

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(384);
  });

  it('rejects with timeout error when model exceeds 30 seconds', async () => {
    mockModelFn.mockReturnValue(new Promise(() => {}));

    const { generateEmbedding } = await import('../embeddings');

    let rejected = false;
    let errorMsg = '';
    generateEmbedding('test text').catch((err: Error) => {
      rejected = true;
      errorMsg = err.message;
    });

    await vi.runAllTimersAsync();

    expect(rejected).toBe(true);
    expect(errorMsg).toBe('Embedding generation timed out after 30s');
  }, 15000);

  it('cleans up timer on successful completion (no leaked timers)', async () => {
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
    mockModelFn.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: new Float32Array(384).fill(0.1) });
      }
      return new Promise(() => {});
    });

    const { generateEmbeddings } = await import('../embeddings');

    let rejected = false;
    let errorMsg = '';
    generateEmbeddings(['text1', 'text2']).catch((err: Error) => {
      rejected = true;
      errorMsg = err.message;
    });

    await vi.runAllTimersAsync();

    expect(rejected).toBe(true);
    expect(errorMsg).toBe('Embedding generation timed out after 30s');
  }, 15000);
});
