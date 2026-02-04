/**
 * Shipyard Memory - Embeddings Generation
 *
 * Uses Transformers.js for local embedding generation (no external API calls).
 */

import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

// Model configuration
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIM = 384;
const MAX_TEXT_LENGTH = 2000; // Truncate to respect 512 token limit

let extractor: FeatureExtractionPipeline | null = null;
let initPromise: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Initialize the embedding model (lazy loading)
 */
async function initModel(): Promise<FeatureExtractionPipeline> {
  if (extractor) {
    return extractor;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = pipeline('feature-extraction', MODEL_NAME, {
    quantized: true, // Use quantized model for smaller size
  });

  extractor = await initPromise;
  return extractor;
}

/**
 * Truncate text to maximum length
 */
function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }
  return text.slice(0, MAX_TEXT_LENGTH);
}

/**
 * Format an exchange for embedding
 */
export function formatExchangeForEmbedding(
  userMessage: string,
  assistantMessage: string,
  toolNames: string[]
): string {
  const parts = [`User: ${truncateText(userMessage)}`, '', `Assistant: ${truncateText(assistantMessage)}`];

  if (toolNames.length > 0) {
    parts.push('', `Tools: ${toolNames.join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Generate embedding for text
 */
export async function generateEmbedding(text: string): Promise<Float32Array> {
  const model = await initModel();

  const truncated = truncateText(text);
  const output = await model(truncated, {
    pooling: 'mean',
    normalize: true,
  });

  // Extract the embedding array
  const data = output.data as Float32Array;

  // Ensure correct dimensions
  if (data.length !== EMBEDDING_DIM) {
    throw new Error(`Expected embedding dimension ${EMBEDDING_DIM}, got ${data.length}`);
  }

  return data;
}

/**
 * Generate embedding for an exchange
 */
export async function generateExchangeEmbedding(
  userMessage: string,
  assistantMessage: string,
  toolNames: string[]
): Promise<Float32Array> {
  const text = formatExchangeForEmbedding(userMessage, assistantMessage, toolNames);
  return generateEmbedding(text);
}

/**
 * Generate embeddings for multiple texts (batched)
 */
export async function generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
  const model = await initModel();

  const truncated = texts.map(truncateText);
  const results: Float32Array[] = [];

  // Process one at a time to avoid memory issues
  for (const text of truncated) {
    const output = await model(text, {
      pooling: 'mean',
      normalize: true,
    });
    results.push(output.data as Float32Array);
  }

  return results;
}

/**
 * Check if the embedding model is loaded
 */
export function isModelLoaded(): boolean {
  return extractor !== null;
}

/**
 * Get embedding dimension
 */
export function getEmbeddingDimension(): number {
  return EMBEDDING_DIM;
}
