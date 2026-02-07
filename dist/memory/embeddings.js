"use strict";
/**
 * Shipyard Memory - Embeddings Generation
 *
 * Uses Transformers.js for local embedding generation (no external API calls).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMBEDDING_TIMEOUT_MS = void 0;
exports.withTimeout = withTimeout;
exports.formatExchangeForEmbedding = formatExchangeForEmbedding;
exports.generateEmbedding = generateEmbedding;
exports.generateExchangeEmbedding = generateExchangeEmbedding;
exports.generateEmbeddings = generateEmbeddings;
exports.isModelLoaded = isModelLoaded;
exports.getEmbeddingDimension = getEmbeddingDimension;
const transformers_1 = require("@xenova/transformers");
// Model configuration
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIM = 384;
const MAX_TEXT_LENGTH = 2000; // Truncate to respect 512 token limit
/** @internal Used by withTimeout wrapper — Plan 1.3 will connect call sites */
exports.EMBEDDING_TIMEOUT_MS = 30_000;
let extractor = null;
let initPromise = null;
/**
 * Initialize the embedding model (lazy loading)
 */
async function initModel() {
    if (extractor) {
        return extractor;
    }
    if (initPromise) {
        return initPromise;
    }
    initPromise = (0, transformers_1.pipeline)('feature-extraction', MODEL_NAME, {
        quantized: true, // Use quantized model for smaller size
    });
    extractor = await initPromise;
    return extractor;
}
/**
 * Truncate text to maximum length
 */
function truncateText(text) {
    if (text.length <= MAX_TEXT_LENGTH) {
        return text;
    }
    return text.slice(0, MAX_TEXT_LENGTH);
}
/**
 * Race a promise against a timeout. Cleans up the timer on completion.
 */
/** @internal Plan 1.3 will connect call sites in generateEmbedding/generateEmbeddings */
function withTimeout(promise, ms, message) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
        timer.unref?.();
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}
/**
 * Format an exchange for embedding
 */
function formatExchangeForEmbedding(userMessage, assistantMessage, toolNames) {
    const parts = [`User: ${truncateText(userMessage)}`, '', `Assistant: ${truncateText(assistantMessage)}`];
    if (toolNames.length > 0) {
        parts.push('', `Tools: ${toolNames.join(', ')}`);
    }
    return parts.join('\n');
}
/**
 * Generate embedding for text
 */
async function generateEmbedding(text) {
    const model = await initModel();
    const truncated = truncateText(text);
    const output = await withTimeout(model(truncated, { pooling: 'mean', normalize: true }), exports.EMBEDDING_TIMEOUT_MS, 'Embedding generation timed out after 30s');
    // Extract the embedding array
    const data = output.data;
    // Ensure correct dimensions
    if (data.length !== EMBEDDING_DIM) {
        throw new Error(`Expected embedding dimension ${EMBEDDING_DIM}, got ${data.length}`);
    }
    return data;
}
/**
 * Generate embedding for an exchange
 */
async function generateExchangeEmbedding(userMessage, assistantMessage, toolNames) {
    const text = formatExchangeForEmbedding(userMessage, assistantMessage, toolNames);
    return generateEmbedding(text);
}
/**
 * Generate embeddings for multiple texts (batched)
 */
async function generateEmbeddings(texts) {
    const model = await initModel();
    const truncated = texts.map(truncateText);
    const results = [];
    // Process one at a time to avoid memory issues
    for (const text of truncated) {
        const output = await withTimeout(model(text, { pooling: 'mean', normalize: true }), exports.EMBEDDING_TIMEOUT_MS, 'Embedding generation timed out after 30s');
        results.push(output.data);
    }
    return results;
}
/**
 * Check if the embedding model is loaded
 */
function isModelLoaded() {
    return extractor !== null;
}
/**
 * Get embedding dimension
 */
function getEmbeddingDimension() {
    return EMBEDDING_DIM;
}
//# sourceMappingURL=embeddings.js.map