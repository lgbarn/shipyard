/**
 * Shipyard Memory - Embeddings Generation
 *
 * Uses Transformers.js for local embedding generation (no external API calls).
 */
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