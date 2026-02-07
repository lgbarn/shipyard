/**
 * Shipyard Memory - Embeddings Generation
 *
 * Uses Transformers.js for local embedding generation (no external API calls).
 */
/** @internal Used by withTimeout wrapper — Plan 1.3 will connect call sites */
export declare const EMBEDDING_TIMEOUT_MS = 30000;
/**
 * Race a promise against a timeout. Cleans up the timer on completion.
 */
/** @internal Plan 1.3 will connect call sites in generateEmbedding/generateEmbeddings */
export declare function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T>;
/**
 * Format an exchange for embedding
 */
export declare function formatExchangeForEmbedding(userMessage: string, assistantMessage: string, toolNames: string[]): string;
/**
 * Generate embedding for text
 */
export declare function generateEmbedding(text: string): Promise<Float32Array>;
/**
 * Generate embedding for an exchange
 */
export declare function generateExchangeEmbedding(userMessage: string, assistantMessage: string, toolNames: string[]): Promise<Float32Array>;
/**
 * Generate embeddings for multiple texts (batched)
 */
export declare function generateEmbeddings(texts: string[]): Promise<Float32Array[]>;
/**
 * Check if the embedding model is loaded
 */
export declare function isModelLoaded(): boolean;
/**
 * Get embedding dimension
 */
export declare function getEmbeddingDimension(): number;
//# sourceMappingURL=embeddings.d.ts.map