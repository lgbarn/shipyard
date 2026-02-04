/**
 * Shipyard Memory - Search
 *
 * Provides semantic and text-based search over indexed exchanges.
 */
import type { SearchOptions, SearchResult, MemoryStats } from './types';
/**
 * Search memory for relevant exchanges
 */
export declare function search(options: SearchOptions): Promise<SearchResult[]>;
/**
 * Search with multiple concepts (AND search)
 */
export declare function searchMultipleConcepts(concepts: string[], limit?: number, filters?: {
    after?: string;
    before?: string;
    project?: string;
}): Promise<SearchResult[]>;
/**
 * Get memory statistics
 */
export declare function getMemoryStats(): MemoryStats;
/**
 * Format search results as markdown
 */
export declare function formatResultsAsMarkdown(results: SearchResult[]): string;
/**
 * Format search results as JSON
 */
export declare function formatResultsAsJson(results: SearchResult[]): string;
//# sourceMappingURL=search.d.ts.map