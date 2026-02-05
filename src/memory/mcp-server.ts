/**
 * Shipyard Memory - MCP Server
 *
 * Exposes memory search and management tools via the Model Context Protocol.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { search, searchMultipleConcepts, getMemoryStats, formatResultsAsMarkdown, formatResultsAsJson } from './search';
import { deleteExchangesBySession, deleteExchangesByDateRange, initDatabase, getDatabase, isVecEnabled, createTimestampedBackup } from './db';
import { runImport, runIncrementalIndex } from './indexer';
import { isMemoryEnabled, DATABASE_PATH } from './config';
import { isModelLoaded } from './embeddings';
import { logger } from './logger';
import * as fs from 'fs';

// Input schemas
const SearchInputSchema = z.union([
  z.string(), // Simple query string
  z.array(z.string()).min(2).max(5), // Multi-concept search
  z.object({
    query: z.union([z.string(), z.array(z.string()).min(2).max(5)]),
    limit: z.number().min(1).max(50).optional(),
    after: z.string().optional(), // YYYY-MM-DD
    before: z.string().optional(), // YYYY-MM-DD
    project: z.string().optional(),
    format: z.enum(['markdown', 'json']).optional(),
  }),
]);

const ForgetInputSchema = z.object({
  session_id: z.string().optional(),
  after: z.string().optional(), // YYYY-MM-DD
  before: z.string().optional(), // YYYY-MM-DD
});

const ImportInputSchema = z.object({
  force: z.boolean().optional(),
});

// Tool definitions
const TOOLS = [
  {
    name: 'memory_search',
    description:
      'Search past conversations for relevant context. Returns semantically similar exchanges from previous sessions.',
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
  {
    name: 'memory_backup',
    description: 'Create a backup of the memory database.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'memory_health',
    description: 'Check MCP server health and configuration status.',
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
async function handleSearch(input: unknown): Promise<string> {
  const parsed = SearchInputSchema.parse(input);

  let query: string | string[];
  let limit = 10;
  let after: string | undefined;
  let before: string | undefined;
  let project: string | undefined;
  let format: 'markdown' | 'json' = 'markdown';

  if (typeof parsed === 'string') {
    query = parsed;
  } else if (Array.isArray(parsed)) {
    query = parsed;
  } else {
    query = parsed.query;
    limit = parsed.limit ?? 10;
    after = parsed.after;
    before = parsed.before;
    project = parsed.project;
    format = parsed.format ?? 'markdown';
  }

  const results = Array.isArray(query)
    ? await searchMultipleConcepts(query, limit, { after, before, project })
    : await search({ query, limit, after, before, project });

  return format === 'json' ? formatResultsAsJson(results) : formatResultsAsMarkdown(results);
}

/**
 * Handle memory_forget tool call
 */
function handleForget(input: unknown): string {
  const parsed = ForgetInputSchema.parse(input);

  if (parsed.session_id) {
    const deleted = deleteExchangesBySession(parsed.session_id);
    return `Deleted ${deleted} exchanges from session ${parsed.session_id}.`;
  }

  if (parsed.after || parsed.before) {
    const afterTimestamp = parsed.after ? new Date(parsed.after).getTime() : 0;
    const beforeTimestamp = parsed.before ? new Date(parsed.before).setHours(23, 59, 59, 999) : Date.now();
    const deleted = deleteExchangesByDateRange(afterTimestamp, beforeTimestamp);
    return `Deleted ${deleted} exchanges from date range.`;
  }

  return 'No session_id or date range specified. Nothing deleted.';
}

/**
 * Handle memory_status tool call
 */
function handleStatus(): string {
  const stats = getMemoryStats();

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
async function handleImport(input: unknown): Promise<string> {
  const parsed = ImportInputSchema.parse(input);

  const progress = await runImport(parsed.force ?? false);

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
async function handleIndex(): Promise<string> {
  const progress = await runIncrementalIndex();

  return [
    '## Indexing Complete',
    '',
    `**Files Processed:** ${progress.processedFiles} / ${progress.totalFiles}`,
    `**Exchanges Indexed:** ${progress.indexedExchanges}`,
    `**Errors:** ${progress.errors}`,
  ].join('\n');
}

/**
 * Handle memory_backup tool call
 */
async function handleBackup(): Promise<string> {
  const backupPath = await createTimestampedBackup();
  const stats = fs.statSync(backupPath);

  return [
    '## Backup Created',
    '',
    `**Path:** ${backupPath}`,
    `**Size:** ${(stats.size / 1024 / 1024).toFixed(2)} MB`,
    '',
    'The database has been backed up successfully. Up to 5 backups are retained.',
  ].join('\n');
}

/**
 * Handle memory_health tool call
 */
export function handleHealth(): string {
  // Test DB connectivity
  let dbConnected = false;
  let exchangeCount = 0;
  let dbSizeMb = 0;
  try {
    const database = getDatabase();
    database.prepare('SELECT 1').get();
    dbConnected = true;

    // Get basic stats
    const countRow = database.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number };
    exchangeCount = countRow.count;

    if (fs.existsSync(DATABASE_PATH)) {
      const stats = fs.statSync(DATABASE_PATH);
      dbSizeMb = stats.size / (1024 * 1024);
    }
  } catch {
    dbConnected = false;
  }

  // Check vector extension
  const vecEnabled = isVecEnabled();

  // Check embedding model
  const modelLoaded = isModelLoaded();

  // Determine overall status
  let status: string;
  if (dbConnected && vecEnabled) {
    status = 'healthy';
  } else if (dbConnected) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  return [
    '## MCP Server Health',
    '',
    `**Status:** ${status}`,
    `**Version:** shipyard-memory@1.0.0`,
    '',
    '### Database',
    `- Connected: ${dbConnected ? 'Yes' : 'No'}`,
    `- Path: ${DATABASE_PATH}`,
    `- Size: ${dbSizeMb.toFixed(2)} MB`,
    `- Exchanges: ${exchangeCount}`,
    '',
    '### Vector Search',
    `- Enabled: ${vecEnabled ? 'Yes' : 'No'}`,
    `- Extension: sqlite-vec`,
    '',
    '### Embeddings',
    `- Model Loaded: ${modelLoaded ? 'Yes' : 'No'}`,
    `- Model: Xenova/all-MiniLM-L6-v2`,
    `- Dimension: 384`,
  ].join('\n');
}

/**
 * Create and start the MCP server
 */
export async function startServer(): Promise<void> {
  // Check if memory is enabled
  if (!isMemoryEnabled()) {
    logger.error('Memory is not enabled. Enable it with /shipyard:memory-enable or during /shipyard:init');
    process.exit(1);
  }

  // Initialize database
  initDatabase();

  const server = new Server(
    {
      name: 'shipyard-memory',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

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
        case 'memory_health':
          result = handleHealth();
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run server or indexer if this is the main module
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--index')) {
    // Run incremental indexing and exit
    initDatabase();
    runIncrementalIndex((progress) => {
      logger.info('Indexing progress', { indexed: progress.indexedExchanges, processed: progress.processedFiles, total: progress.totalFiles });
    })
      .then((progress) => {
        logger.info('Indexing complete', { indexed: progress.indexedExchanges, errors: progress.errors });
        process.exit(0);
      })
      .catch((error) => {
        logger.error('Indexing failed', { error: String(error) });
        process.exit(1);
      });
  } else {
    startServer().catch((error) => {
      logger.error('Failed to start MCP server', { error: String(error) });
      process.exit(1);
    });
  }
}
