"use strict";
/**
 * Shipyard Memory - Conversation Parser
 *
 * Extracts user/assistant exchanges from Claude Code JSONL conversation files.
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
exports.parseConversationFile = parseConversationFile;
exports.findConversationFiles = findConversationFiles;
exports.decodeProjectPath = decodeProjectPath;
const fs = __importStar(require("fs"));
const readline = __importStar(require("readline"));
/**
 * Extract text content from various message formats
 */
function extractTextContent(content) {
    if (!content)
        return '';
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .filter((c) => c.type === 'text' && c.text)
            .map((c) => c.text)
            .join('\n');
    }
    return '';
}
/**
 * Extract tool names from a message
 */
function extractToolNames(content) {
    if (!content || typeof content === 'string')
        return [];
    if (Array.isArray(content)) {
        return content
            .filter((c) => c.type === 'tool_use' && c.name)
            .map((c) => c.name);
    }
    return [];
}
/**
 * Parse a single JSONL file and extract exchanges
 */
async function parseConversationFile(filePath) {
    const exchanges = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });
    let lineNumber = 0;
    let currentUserMessage = null;
    let currentToolNames = [];
    let currentTimestamp = Date.now();
    let currentSessionId = '';
    let currentParentUuid;
    for await (const line of rl) {
        lineNumber++;
        if (!line.trim())
            continue;
        try {
            const parsed = JSON.parse(line);
            // Extract session ID
            if (parsed.sessionId) {
                currentSessionId = parsed.sessionId;
            }
            // Extract timestamp
            if (parsed.timestamp) {
                currentTimestamp = new Date(parsed.timestamp).getTime();
            }
            // Extract UUID for parent tracking
            if (parsed.uuid) {
                currentParentUuid = parsed.uuid;
            }
            // Determine role and content
            let role;
            let content;
            if (parsed.type === 'user' || parsed.role === 'user') {
                role = 'user';
                content = parsed.message?.content || parsed.content;
            }
            else if (parsed.type === 'assistant' || parsed.role === 'assistant') {
                role = 'assistant';
                content = parsed.message?.content || parsed.content;
            }
            else if (parsed.message?.role === 'user') {
                role = 'user';
                content = parsed.message.content;
            }
            else if (parsed.message?.role === 'assistant') {
                role = 'assistant';
                content = parsed.message.content;
            }
            if (role === 'user') {
                // Start of a new exchange
                currentUserMessage = extractTextContent(content);
                currentToolNames = [];
            }
            else if (role === 'assistant' && currentUserMessage !== null) {
                // Complete the exchange
                const assistantMessage = extractTextContent(content);
                const toolNames = extractToolNames(content);
                // Merge tool names
                currentToolNames = [...new Set([...currentToolNames, ...toolNames])];
                if (currentUserMessage.trim() && assistantMessage.trim()) {
                    exchanges.push({
                        userMessage: currentUserMessage,
                        assistantMessage,
                        toolNames: currentToolNames,
                        timestamp: currentTimestamp,
                        sessionId: currentSessionId || filePath,
                        parentUuid: currentParentUuid,
                    });
                }
                currentUserMessage = null;
                currentToolNames = [];
            }
        }
        catch {
            // Skip malformed lines
            continue;
        }
    }
    return exchanges;
}
/**
 * Find all conversation files in a directory
 */
function findConversationFiles(rootDir) {
    const files = [];
    if (!fs.existsSync(rootDir)) {
        return files;
    }
    function walkDir(dir, projectPath) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = `${dir}/${entry.name}`;
                if (entry.isDirectory()) {
                    // For the top level, each directory is a project
                    const newProjectPath = projectPath || fullPath;
                    walkDir(fullPath, newProjectPath);
                }
                else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
                    const stats = fs.statSync(fullPath);
                    files.push({
                        path: fullPath,
                        projectPath: projectPath || dir,
                        modifiedAt: stats.mtimeMs,
                    });
                }
            }
        }
        catch {
            // Skip directories we can't read
        }
    }
    walkDir(rootDir, '');
    return files;
}
/**
 * Extract project path from Claude's directory structure
 *
 * Claude stores conversations in ~/.claude/projects/-path-to-project/
 * where the path is URL-encoded with hyphens
 */
function decodeProjectPath(encodedPath) {
    // Remove the ~/.claude/projects/ prefix and decode
    const parts = encodedPath.split('/');
    // Find the project directory part (after 'projects')
    const projectsIndex = parts.indexOf('projects');
    if (projectsIndex === -1 || projectsIndex >= parts.length - 1) {
        return encodedPath;
    }
    const projectDir = parts[projectsIndex + 1];
    // Decode: -Users-name-project becomes /Users/name/project
    if (projectDir.startsWith('-')) {
        return projectDir.replace(/-/g, '/');
    }
    return encodedPath;
}
//# sourceMappingURL=parser.js.map