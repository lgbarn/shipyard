"use strict";
/**
 * Shipyard Memory - Indexer
 *
 * Processes conversation files and indexes exchanges with embeddings.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFullIndex = runFullIndex;
exports.runIncrementalIndex = runIncrementalIndex;
exports.runImport = runImport;
exports.indexCurrentSession = indexCurrentSession;
const crypto = __importStar(require("crypto"));
const config_1 = require("./config");
const db_1 = require("./db");
const parser_1 = require("./parser");
const embeddings_1 = require("./embeddings");
const scrubber_1 = require("./scrubber");
/**
 * Generate a unique ID for an exchange
 */
function generateExchangeId(sourceFile, lineStart, lineEnd) {
    const input = `${sourceFile}:${lineStart}-${lineEnd}`;
    return crypto.createHash('md5').update(input).digest('hex');
}
/**
 * Check if a file has already been indexed
 */
function isFileIndexed(filePath, modifiedAt) {
    const db = (0, db_1.getDatabase)();
    const row = db
        .prepare(`
    SELECT MAX(indexed_at) as last_indexed
    FROM exchanges
    WHERE source_file = ?
  `)
        .get(filePath);
    if (!row?.last_indexed)
        return false;
    // Re-index if file has been modified since last index
    return row.last_indexed >= modifiedAt;
}
/**
 * Index a single exchange
 */
const MIN_CONTENT_LENGTH = 50;
async function indexExchange(parsed, sourceFile, lineStart, lineEnd, projectPath) {
    // Skip noisy/empty exchanges
    if (parsed.userMessage.length + parsed.assistantMessage.length < MIN_CONTENT_LENGTH) {
        return;
    }
    // Scrub secrets before indexing
    const scrubbedUser = (0, scrubber_1.scrubSecrets)(parsed.userMessage);
    const scrubbedAssistant = (0, scrubber_1.scrubSecrets)(parsed.assistantMessage);
    // Generate embedding
    const embedding = await (0, embeddings_1.generateExchangeEmbedding)(scrubbedUser.text, scrubbedAssistant.text, parsed.toolNames);
    const exchange = {
        id: generateExchangeId(sourceFile, lineStart, lineEnd),
        sessionId: parsed.sessionId,
        projectPath: projectPath,
        userMessage: scrubbedUser.text,
        assistantMessage: scrubbedAssistant.text,
        toolNames: parsed.toolNames,
        timestamp: parsed.timestamp,
        gitBranch: null, // Could be extracted if available
        sourceFile,
        lineStart,
        lineEnd,
        embedding,
        indexedAt: Date.now(),
    };
    (0, db_1.insertExchange)(exchange);
    (0, db_1.upsertSession)(exchange.sessionId, exchange.projectPath, exchange.timestamp);
}
/**
 * Index a single conversation file
 */
async function indexFile(filePath, projectPath, onProgress) {
    const exchanges = await (0, parser_1.parseConversationFile)(filePath);
    let indexed = 0;
    let lineCounter = 0;
    for (const exchange of exchanges) {
        const lineStart = lineCounter;
        lineCounter++; // Simplified line tracking
        const lineEnd = lineCounter;
        try {
            await indexExchange(exchange, filePath, lineStart, lineEnd, projectPath);
            indexed++;
            if (onProgress) {
                onProgress(indexed, exchanges.length);
            }
        }
        catch (error) {
            console.error(`Error indexing exchange from ${filePath}:`, error);
        }
    }
    return indexed;
}
/**
 * Run the full indexer on all conversation files
 */
async function runFullIndex(onProgress) {
    const progress = {
        totalFiles: 0,
        processedFiles: 0,
        totalExchanges: 0,
        indexedExchanges: 0,
        errors: 0,
    };
    // Find all conversation files
    const files = (0, parser_1.findConversationFiles)(config_1.CLAUDE_PROJECTS_DIR);
    progress.totalFiles = files.length;
    if (onProgress)
        onProgress(progress);
    for (const file of files) {
        try {
            // Decode project path from Claude's directory structure
            const decodedProjectPath = (0, parser_1.decodeProjectPath)(file.projectPath);
            // Check if project is excluded
            if ((0, config_1.isProjectExcluded)(decodedProjectPath)) {
                progress.processedFiles++;
                if (onProgress)
                    onProgress(progress);
                continue;
            }
            // Check if already indexed
            if (isFileIndexed(file.path, file.modifiedAt)) {
                progress.processedFiles++;
                if (onProgress)
                    onProgress(progress);
                continue;
            }
            // Index the file
            const indexed = await indexFile(file.path, decodedProjectPath, (_current, total) => {
                progress.totalExchanges = total;
                if (onProgress)
                    onProgress(progress);
            });
            progress.indexedExchanges += indexed;
            progress.processedFiles++;
            if (onProgress)
                onProgress(progress);
        }
        catch (error) {
            console.error(`Error processing file ${file.path}:`, error);
            progress.errors++;
            progress.processedFiles++;
            if (onProgress)
                onProgress(progress);
        }
    }
    // Prune to stay within storage cap
    const capBytes = (0, config_1.getStorageCapBytes)();
    (0, db_1.pruneToCapacity)(capBytes);
    return progress;
}
/**
 * Run incremental index (only new/modified files)
 */
async function runIncrementalIndex(onProgress) {
    // Same as full index but relies on isFileIndexed check
    return runFullIndex(onProgress);
}
/**
 * Run initial import
 */
async function runImport(force = false, onProgress) {
    // Check if already imported (unless forcing)
    if (!force) {
        const imported = (0, db_1.getImportState)('import_completed');
        if (imported === 'true') {
            return {
                totalFiles: 0,
                processedFiles: 0,
                totalExchanges: 0,
                indexedExchanges: 0,
                errors: 0,
            };
        }
    }
    // Run full index
    const progress = await runFullIndex(onProgress);
    // Mark as imported
    (0, db_1.setImportState)('import_completed', 'true');
    (0, db_1.setImportState)('import_timestamp', Date.now().toString());
    return progress;
}
/**
 * Index exchanges from the current session
 * (Called by hook after session ends)
 */
async function indexCurrentSession(sessionId, exchanges, projectPath) {
    // Check if project is excluded
    if ((0, config_1.isProjectExcluded)(projectPath)) {
        return 0;
    }
    let indexed = 0;
    for (let i = 0; i < exchanges.length; i++) {
        const exchange = exchanges[i];
        try {
            await indexExchange(exchange, `session:${sessionId}`, i, i + 1, projectPath);
            indexed++;
        }
        catch (error) {
            console.error(`Error indexing exchange from session ${sessionId}:`, error);
        }
    }
    // Prune to stay within storage cap
    const capBytes = (0, config_1.getStorageCapBytes)();
    (0, db_1.pruneToCapacity)(capBytes);
    return indexed;
}
//# sourceMappingURL=indexer.js.map