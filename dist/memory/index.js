"use strict";
/**
 * Shipyard Memory - Main Entry Point
 *
 * Episodic memory for cross-session conversation recall.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStorageBreakdown = exports.deleteProjectExchanges = exports.runPrune = exports.getStorageUsagePercent = exports.isPruningNeeded = exports.getDatabaseSizeMb = exports.analyzeSecrets = exports.containsSecrets = exports.scrubSecrets = exports.formatResultsAsJson = exports.formatResultsAsMarkdown = exports.getMemoryStats = exports.searchMultipleConcepts = exports.search = exports.indexCurrentSession = exports.runImport = exports.runIncrementalIndex = exports.runFullIndex = exports.decodeProjectPath = exports.findConversationFiles = exports.parseConversationFile = exports.getEmbeddingDimension = exports.isModelLoaded = exports.formatExchangeForEmbedding = exports.generateEmbeddings = exports.generateExchangeEmbedding = exports.generateEmbedding = exports.pruneToCapacity = exports.getImportState = exports.setImportState = exports.getStats = exports.textSearch = exports.vectorSearch = exports.deleteExchangesByDateRange = exports.deleteExchangesBySession = exports.insertExchange = exports.closeDatabase = exports.getDatabase = exports.initDatabase = exports.getStorageCapBytes = exports.isProjectExcluded = exports.readProjectConfig = exports.isMemoryEnabled = exports.writeGlobalConfig = exports.readGlobalConfig = exports.CLAUDE_PROJECTS_DIR = exports.LOG_PATH = exports.DATABASE_PATH = exports.GLOBAL_CONFIG_PATH = exports.CONFIG_DIR = void 0;
exports.startServer = void 0;
// Configuration
var config_1 = require("./config");
Object.defineProperty(exports, "CONFIG_DIR", { enumerable: true, get: function () { return config_1.CONFIG_DIR; } });
Object.defineProperty(exports, "GLOBAL_CONFIG_PATH", { enumerable: true, get: function () { return config_1.GLOBAL_CONFIG_PATH; } });
Object.defineProperty(exports, "DATABASE_PATH", { enumerable: true, get: function () { return config_1.DATABASE_PATH; } });
Object.defineProperty(exports, "LOG_PATH", { enumerable: true, get: function () { return config_1.LOG_PATH; } });
Object.defineProperty(exports, "CLAUDE_PROJECTS_DIR", { enumerable: true, get: function () { return config_1.CLAUDE_PROJECTS_DIR; } });
Object.defineProperty(exports, "readGlobalConfig", { enumerable: true, get: function () { return config_1.readGlobalConfig; } });
Object.defineProperty(exports, "writeGlobalConfig", { enumerable: true, get: function () { return config_1.writeGlobalConfig; } });
Object.defineProperty(exports, "isMemoryEnabled", { enumerable: true, get: function () { return config_1.isMemoryEnabled; } });
Object.defineProperty(exports, "readProjectConfig", { enumerable: true, get: function () { return config_1.readProjectConfig; } });
Object.defineProperty(exports, "isProjectExcluded", { enumerable: true, get: function () { return config_1.isProjectExcluded; } });
Object.defineProperty(exports, "getStorageCapBytes", { enumerable: true, get: function () { return config_1.getStorageCapBytes; } });
// Database
var db_1 = require("./db");
Object.defineProperty(exports, "initDatabase", { enumerable: true, get: function () { return db_1.initDatabase; } });
Object.defineProperty(exports, "getDatabase", { enumerable: true, get: function () { return db_1.getDatabase; } });
Object.defineProperty(exports, "closeDatabase", { enumerable: true, get: function () { return db_1.closeDatabase; } });
Object.defineProperty(exports, "insertExchange", { enumerable: true, get: function () { return db_1.insertExchange; } });
Object.defineProperty(exports, "deleteExchangesBySession", { enumerable: true, get: function () { return db_1.deleteExchangesBySession; } });
Object.defineProperty(exports, "deleteExchangesByDateRange", { enumerable: true, get: function () { return db_1.deleteExchangesByDateRange; } });
Object.defineProperty(exports, "vectorSearch", { enumerable: true, get: function () { return db_1.vectorSearch; } });
Object.defineProperty(exports, "textSearch", { enumerable: true, get: function () { return db_1.textSearch; } });
Object.defineProperty(exports, "getStats", { enumerable: true, get: function () { return db_1.getStats; } });
Object.defineProperty(exports, "setImportState", { enumerable: true, get: function () { return db_1.setImportState; } });
Object.defineProperty(exports, "getImportState", { enumerable: true, get: function () { return db_1.getImportState; } });
Object.defineProperty(exports, "pruneToCapacity", { enumerable: true, get: function () { return db_1.pruneToCapacity; } });
// Embeddings
var embeddings_1 = require("./embeddings");
Object.defineProperty(exports, "generateEmbedding", { enumerable: true, get: function () { return embeddings_1.generateEmbedding; } });
Object.defineProperty(exports, "generateExchangeEmbedding", { enumerable: true, get: function () { return embeddings_1.generateExchangeEmbedding; } });
Object.defineProperty(exports, "generateEmbeddings", { enumerable: true, get: function () { return embeddings_1.generateEmbeddings; } });
Object.defineProperty(exports, "formatExchangeForEmbedding", { enumerable: true, get: function () { return embeddings_1.formatExchangeForEmbedding; } });
Object.defineProperty(exports, "isModelLoaded", { enumerable: true, get: function () { return embeddings_1.isModelLoaded; } });
Object.defineProperty(exports, "getEmbeddingDimension", { enumerable: true, get: function () { return embeddings_1.getEmbeddingDimension; } });
// Parser
var parser_1 = require("./parser");
Object.defineProperty(exports, "parseConversationFile", { enumerable: true, get: function () { return parser_1.parseConversationFile; } });
Object.defineProperty(exports, "findConversationFiles", { enumerable: true, get: function () { return parser_1.findConversationFiles; } });
Object.defineProperty(exports, "decodeProjectPath", { enumerable: true, get: function () { return parser_1.decodeProjectPath; } });
// Indexer
var indexer_1 = require("./indexer");
Object.defineProperty(exports, "runFullIndex", { enumerable: true, get: function () { return indexer_1.runFullIndex; } });
Object.defineProperty(exports, "runIncrementalIndex", { enumerable: true, get: function () { return indexer_1.runIncrementalIndex; } });
Object.defineProperty(exports, "runImport", { enumerable: true, get: function () { return indexer_1.runImport; } });
Object.defineProperty(exports, "indexCurrentSession", { enumerable: true, get: function () { return indexer_1.indexCurrentSession; } });
// Search
var search_1 = require("./search");
Object.defineProperty(exports, "search", { enumerable: true, get: function () { return search_1.search; } });
Object.defineProperty(exports, "searchMultipleConcepts", { enumerable: true, get: function () { return search_1.searchMultipleConcepts; } });
Object.defineProperty(exports, "getMemoryStats", { enumerable: true, get: function () { return search_1.getMemoryStats; } });
Object.defineProperty(exports, "formatResultsAsMarkdown", { enumerable: true, get: function () { return search_1.formatResultsAsMarkdown; } });
Object.defineProperty(exports, "formatResultsAsJson", { enumerable: true, get: function () { return search_1.formatResultsAsJson; } });
// Scrubber
var scrubber_1 = require("./scrubber");
Object.defineProperty(exports, "scrubSecrets", { enumerable: true, get: function () { return scrubber_1.scrubSecrets; } });
Object.defineProperty(exports, "containsSecrets", { enumerable: true, get: function () { return scrubber_1.containsSecrets; } });
Object.defineProperty(exports, "analyzeSecrets", { enumerable: true, get: function () { return scrubber_1.analyzeSecrets; } });
// Pruner
var pruner_1 = require("./pruner");
Object.defineProperty(exports, "getDatabaseSizeMb", { enumerable: true, get: function () { return pruner_1.getDatabaseSizeMb; } });
Object.defineProperty(exports, "isPruningNeeded", { enumerable: true, get: function () { return pruner_1.isPruningNeeded; } });
Object.defineProperty(exports, "getStorageUsagePercent", { enumerable: true, get: function () { return pruner_1.getStorageUsagePercent; } });
Object.defineProperty(exports, "runPrune", { enumerable: true, get: function () { return pruner_1.runPrune; } });
Object.defineProperty(exports, "deleteProjectExchanges", { enumerable: true, get: function () { return pruner_1.deleteProjectExchanges; } });
Object.defineProperty(exports, "getStorageBreakdown", { enumerable: true, get: function () { return pruner_1.getStorageBreakdown; } });
// MCP Server
var mcp_server_1 = require("./mcp-server");
Object.defineProperty(exports, "startServer", { enumerable: true, get: function () { return mcp_server_1.startServer; } });
//# sourceMappingURL=index.js.map