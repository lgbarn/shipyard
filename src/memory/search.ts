/**
 * Shipyard Memory - Search
 *
 * Provides semantic and text-based search over indexed exchanges.
 */

import { generateEmbedding } from './embeddings';
import { vectorSearch, textSearch, getStats as getDbStats } from './db';
import { readGlobalConfig, isProjectExcluded } from './config';
import type { SearchOptions, SearchResult, MemoryStats } from './types';

/**
 * Parse date string (YYYY-MM-DD) to timestamp
 */
function parseDateToTimestamp(dateStr: string, endOfDay: boolean = false): number {
  const date = new Date(dateStr);
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.getTime();
}

/**
 * Search memory for relevant exchanges
 */
export async function search(options: SearchOptions): Promise<SearchResult[]> {
  const { query, limit = 10, after, before, project } = options;

  // Build filter options
  const filters: {
    afterTimestamp?: number;
    beforeTimestamp?: number;
    projectPath?: string;
  } = {};

  if (after) {
    filters.afterTimestamp = parseDateToTimestamp(after);
  }
  if (before) {
    filters.beforeTimestamp = parseDateToTimestamp(before, true);
  }
  if (project) {
    // Check if project is excluded
    if (isProjectExcluded(project)) {
      return [];
    }
    filters.projectPath = project;
  }

  // Try vector search first
  try {
    const queryEmbedding = await generateEmbedding(query);
    const results = vectorSearch(queryEmbedding, limit, filters);

    if (results.length > 0) {
      return results;
    }
  } catch (error) {
    console.warn('Vector search failed, falling back to text search:', error);
  }

  // Fall back to text search
  return textSearch(query, limit, filters);
}

/**
 * Search with multiple concepts (AND search)
 */
export async function searchMultipleConcepts(
  concepts: string[],
  limit: number = 10,
  filters?: {
    after?: string;
    before?: string;
    project?: string;
  }
): Promise<SearchResult[]> {
  if (concepts.length === 0) {
    return [];
  }

  if (concepts.length === 1) {
    return search({
      query: concepts[0],
      limit,
      ...filters,
    });
  }

  // Search for each concept
  const resultSets = await Promise.all(
    concepts.map((concept) =>
      search({
        query: concept,
        limit: limit * 3, // Get more results for intersection
        ...filters,
      })
    )
  );

  // Find exchanges that appear in all result sets
  const exchangeScores = new Map<string, { result: SearchResult; count: number; totalScore: number }>();

  for (const results of resultSets) {
    for (const result of results) {
      const existing = exchangeScores.get(result.exchange.id);
      if (existing) {
        existing.count++;
        existing.totalScore += result.score;
      } else {
        exchangeScores.set(result.exchange.id, {
          result,
          count: 1,
          totalScore: result.score,
        });
      }
    }
  }

  // Filter to exchanges matching all concepts and sort by combined score
  const matchingAll = Array.from(exchangeScores.values())
    .filter((item) => item.count === concepts.length)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit)
    .map((item) => ({
      ...item.result,
      score: item.totalScore / concepts.length,
    }));

  return matchingAll;
}

/**
 * Get memory statistics
 */
export function getMemoryStats(): MemoryStats {
  const config = readGlobalConfig();
  const dbStats = getDbStats();

  return {
    enabled: config.memory,
    storageCapMb: config.memory_storage_cap_mb,
    ...dbStats,
  };
}

/**
 * Format search results as markdown
 */
export function formatResultsAsMarkdown(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No results found.';
  }

  const lines: string[] = [];

  for (const { exchange, score } of results) {
    const date = new Date(exchange.timestamp).toISOString().split('T')[0];
    const project = exchange.projectPath || 'Unknown project';
    const tools = exchange.toolNames.length > 0 ? `Tools: ${exchange.toolNames.join(', ')}` : '';

    lines.push(`### Exchange (${date}) - Score: ${score.toFixed(2)}`);
    lines.push(`**Project:** ${project}`);
    if (tools) lines.push(`**${tools}**`);
    lines.push('');
    lines.push('**User:**');
    lines.push(truncateForDisplay(exchange.userMessage, 200));
    lines.push('');
    lines.push('**Assistant:**');
    lines.push(truncateForDisplay(exchange.assistantMessage, 500));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format search results as JSON
 */
export function formatResultsAsJson(results: SearchResult[]): string {
  return JSON.stringify(
    results.map(({ exchange, score }) => ({
      id: exchange.id,
      score,
      timestamp: exchange.timestamp,
      project: exchange.projectPath,
      toolNames: exchange.toolNames,
      userMessage: exchange.userMessage,
      assistantMessage: exchange.assistantMessage,
    })),
    null,
    2
  );
}

/**
 * Truncate text for display
 */
function truncateForDisplay(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}
