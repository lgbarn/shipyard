/**
 * Shipyard Memory - Main Entry Point
 *
 * Episodic memory for cross-session conversation recall.
 */

// Configuration
export {
  CONFIG_DIR,
  GLOBAL_CONFIG_PATH,
  DATABASE_PATH,
  LOG_PATH,
  CLAUDE_PROJECTS_DIR,
  readGlobalConfig,
  writeGlobalConfig,
  isMemoryEnabled,
  readProjectConfig,
  isProjectExcluded,
  getStorageCapBytes,
} from './config';

// Database
export {
  initDatabase,
  getDatabase,
  closeDatabase,
  insertExchange,
  deleteExchangesBySession,
  deleteExchangesByDateRange,
  vectorSearch,
  textSearch,
  getStats,
  setImportState,
  getImportState,
  pruneToCapacity,
} from './db';

// Embeddings
export {
  generateEmbedding,
  generateExchangeEmbedding,
  generateEmbeddings,
  formatExchangeForEmbedding,
  isModelLoaded,
  getEmbeddingDimension,
} from './embeddings';

// Parser
export {
  parseConversationFile,
  findConversationFiles,
  decodeProjectPath,
} from './parser';

// Indexer
export {
  runFullIndex,
  runIncrementalIndex,
  runImport,
  indexCurrentSession,
} from './indexer';

// Search
export {
  search,
  searchMultipleConcepts,
  getMemoryStats,
  formatResultsAsMarkdown,
  formatResultsAsJson,
} from './search';

// Scrubber
export {
  scrubSecrets,
  containsSecrets,
  analyzeSecrets,
} from './scrubber';

// Pruner
export {
  getDatabaseSizeMb,
  isPruningNeeded,
  getStorageUsagePercent,
  runPrune,
  deleteProjectExchanges,
  getStorageBreakdown,
} from './pruner';

// Types
export type {
  Exchange,
  Session,
  SearchResult,
  SearchOptions,
  MemoryStats,
  MemoryConfig,
  ProjectConfig,
  ParsedExchange,
  ConversationFile,
} from './types';

// MCP Server
export { startServer } from './mcp-server';
