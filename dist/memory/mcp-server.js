"use strict";
/**
 * Shipyard Memory - MCP Server
 *
 * Exposes memory search and management tools via the Model Context Protocol.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const zod_1 = require("zod");
const search_1 = require("./search");
const db_1 = require("./db");
const indexer_1 = require("./indexer");
const config_1 = require("./config");
// Input schemas
const SearchInputSchema = zod_1.z.union([
    zod_1.z.string(), // Simple query string
    zod_1.z.array(zod_1.z.string()).min(2).max(5), // Multi-concept search
    zod_1.z.object({
        query: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string()).min(2).max(5)]),
        limit: zod_1.z.number().min(1).max(50).optional(),
        after: zod_1.z.string().optional(), // YYYY-MM-DD
        before: zod_1.z.string().optional(), // YYYY-MM-DD
        project: zod_1.z.string().optional(),
        format: zod_1.z.enum(['markdown', 'json']).optional(),
    }),
]);
const ForgetInputSchema = zod_1.z.object({
    session_id: zod_1.z.string().optional(),
    after: zod_1.z.string().optional(), // YYYY-MM-DD
    before: zod_1.z.string().optional(), // YYYY-MM-DD
});
const ImportInputSchema = zod_1.z.object({
    force: zod_1.z.boolean().optional(),
});
// Tool definitions
const TOOLS = [
    {
        name: 'memory_search',
        description: 'Search past conversations for relevant context. Returns semantically similar exchanges from previous sessions.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    oneOf: [
                        { type: 'string', description: 'Semantic search query' },
                        { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5, description: '2-5 concepts for AND search' },
                    ],
                },
                limit: { type: 'number', minimum: 1, maximum: 50, default: 10, description: 'Maximum results to return' },
                after: { type: 'string', description: 'Only return results after this date (YYYY-MM-DD)' },
                before: { type: 'string', description: 'Only return results before this date (YYYY-MM-DD)' },
                project: { type: 'string', description: 'Filter to a specific project path' },
                format: { type: 'string', enum: ['markdown', 'json'], default: 'markdown', description: 'Output format' },
            },
            required: [],
        },
    },
    {
        name: 'memory_forget',
        description: 'Delete exchanges from memory. Can delete by session ID or date range.',
        inputSchema: {
            type: 'object',
            properties: {
                session_id: { type: 'string', description: 'Delete all exchanges from this session' },
                after: { type: 'string', description: 'Delete exchanges after this date (YYYY-MM-DD)' },
                before: { type: 'string', description: 'Delete exchanges before this date (YYYY-MM-DD)' },
            },
            required: [],
        },
    },
    {
        name: 'memory_status',
        description: 'Get memory storage statistics.',
        inputSchema: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
    {
        name: 'memory_import',
        description: 'Import existing conversation history from ~/.claude/projects/',
        inputSchema: {
            type: 'object',
            properties: {
                force: { type: 'boolean', default: false, description: 'Re-import even if already imported' },
            },
            required: [],
        },
    },
    {
        name: 'memory_index',
        description: 'Run incremental indexing of new conversation files.',
        inputSchema: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
];
/**
 * Handle memory_search tool call
 */
async function handleSearch(input) {
    const parsed = SearchInputSchema.parse(input);
    let query;
    let limit = 10;
    let after;
    let before;
    let project;
    let format = 'markdown';
    if (typeof parsed === 'string') {
        query = parsed;
    }
    else if (Array.isArray(parsed)) {
        query = parsed;
    }
    else {
        query = parsed.query;
        limit = parsed.limit ?? 10;
        after = parsed.after;
        before = parsed.before;
        project = parsed.project;
        format = parsed.format ?? 'markdown';
    }
    const results = Array.isArray(query)
        ? await (0, search_1.searchMultipleConcepts)(query, limit, { after, before, project })
        : await (0, search_1.search)({ query, limit, after, before, project });
    return format === 'json' ? (0, search_1.formatResultsAsJson)(results) : (0, search_1.formatResultsAsMarkdown)(results);
}
/**
 * Handle memory_forget tool call
 */
function handleForget(input) {
    const parsed = ForgetInputSchema.parse(input);
    if (parsed.session_id) {
        const deleted = (0, db_1.deleteExchangesBySession)(parsed.session_id);
        return `Deleted ${deleted} exchanges from session ${parsed.session_id}.`;
    }
    if (parsed.after || parsed.before) {
        const afterTimestamp = parsed.after ? new Date(parsed.after).getTime() : 0;
        const beforeTimestamp = parsed.before ? new Date(parsed.before).setHours(23, 59, 59, 999) : Date.now();
        const deleted = (0, db_1.deleteExchangesByDateRange)(afterTimestamp, beforeTimestamp);
        return `Deleted ${deleted} exchanges from date range.`;
    }
    return 'No session_id or date range specified. Nothing deleted.';
}
/**
 * Handle memory_status tool call
 */
function handleStatus() {
    const stats = (0, search_1.getMemoryStats)();
    const lines = [
        '## Memory Status',
        '',
        `**Enabled:** ${stats.enabled ? 'Yes' : 'No'}`,
        `**Database Size:** ${stats.databaseSizeMb.toFixed(2)} MB / ${stats.storageCapMb} MB (${((stats.databaseSizeMb / stats.storageCapMb) * 100).toFixed(1)}%)`,
        `**Exchanges:** ${stats.exchangeCount}`,
        `**Import Completed:** ${stats.importCompleted ? 'Yes' : 'No'}`,
        '',
    ];
    if (stats.oldestExchange && stats.newestExchange) {
        const oldest = new Date(stats.oldestExchange).toISOString().split('T')[0];
        const newest = new Date(stats.newestExchange).toISOString().split('T')[0];
        lines.push(`**Date Range:** ${oldest} to ${newest}`);
    }
    if (stats.lastIndexedAt) {
        const lastIndexed = new Date(stats.lastIndexedAt).toISOString();
        lines.push(`**Last Indexed:** ${lastIndexed}`);
    }
    if (stats.projectCounts.length > 0) {
        lines.push('', '### Top Projects');
        for (const { project, count } of stats.projectCounts.slice(0, 5)) {
            lines.push(`- ${project}: ${count} exchanges`);
        }
    }
    return lines.join('\n');
}
/**
 * Handle memory_import tool call
 */
async function handleImport(input) {
    const parsed = ImportInputSchema.parse(input);
    const progress = await (0, indexer_1.runImport)(parsed.force ?? false);
    return [
        '## Import Complete',
        '',
        `**Files Processed:** ${progress.processedFiles} / ${progress.totalFiles}`,
        `**Exchanges Indexed:** ${progress.indexedExchanges}`,
        `**Errors:** ${progress.errors}`,
    ].join('\n');
}
/**
 * Handle memory_index tool call
 */
async function handleIndex() {
    const progress = await (0, indexer_1.runIncrementalIndex)();
    return [
        '## Indexing Complete',
        '',
        `**Files Processed:** ${progress.processedFiles} / ${progress.totalFiles}`,
        `**Exchanges Indexed:** ${progress.indexedExchanges}`,
        `**Errors:** ${progress.errors}`,
    ].join('\n');
}
/**
 * Create and start the MCP server
 */
async function startServer() {
    // Check if memory is enabled
    if (!(0, config_1.isMemoryEnabled)()) {
        console.error('Memory is not enabled. Enable it with /shipyard:memory-enable or during /shipyard:init');
        process.exit(1);
    }
    // Initialize database
    (0, db_1.initDatabase)();
    const server = new index_js_1.Server({
        name: 'shipyard-memory',
        version: '1.0.0',
    }, {
        capabilities: {
            tools: {},
        },
    });
    // Handle list tools
    server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
        tools: TOOLS,
    }));
    // Handle tool calls
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            let result;
            switch (name) {
                case 'memory_search':
                    result = await handleSearch(args);
                    break;
                case 'memory_forget':
                    result = handleForget(args);
                    break;
                case 'memory_status':
                    result = handleStatus();
                    break;
                case 'memory_import':
                    result = await handleImport(args);
                    break;
                case 'memory_index':
                    result = await handleIndex();
                    break;
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
            return {
                content: [{ type: 'text', text: result }],
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: 'text', text: `Error: ${message}` }],
                isError: true,
            };
        }
    });
    // Start the server
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
// Run server or indexer if this is the main module
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.includes('--index')) {
        // Run incremental indexing and exit
        (0, db_1.initDatabase)();
        (0, indexer_1.runIncrementalIndex)((progress) => {
            console.log(`Indexed ${progress.indexedExchanges} exchanges from ${progress.processedFiles}/${progress.totalFiles} files`);
        })
            .then((progress) => {
            console.log(`Done. ${progress.indexedExchanges} new exchanges indexed, ${progress.errors} errors.`);
            process.exit(0);
        })
            .catch((error) => {
            console.error('Indexing failed:', error);
            process.exit(1);
        });
    }
    else {
        startServer().catch((error) => {
            console.error('Failed to start MCP server:', error);
            process.exit(1);
        });
    }
}
//# sourceMappingURL=mcp-server.js.map