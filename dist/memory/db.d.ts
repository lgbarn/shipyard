/**
 * Shipyard Memory - Database Operations
 */
import Database from 'better-sqlite3';
import type { Exchange, MemoryStats, SearchResult } from './types';
/**
 * Initialize the database with schema
 */
export declare function initDatabase(): Database.Database;
/**
 * Get database instance
 */
export declare function getDatabase(): Database.Database;
/**
 * Close database connection
 */
export declare function closeDatabase(): void;
/**
 * Insert an exchange into the database
 */
export declare function insertExchange(exchange: Exchange): void;
/**
 * Delete exchanges by session ID
 */
export declare function deleteExchangesBySession(sessionId: string): number;
/**
 * Delete exchanges by date range
 */
export declare function deleteExchangesByDateRange(afterTimestamp: number, beforeTimestamp: number): number;
/**
 * Vector similarity search
 */
export declare function vectorSearch(embedding: Float32Array, limit?: number, filters?: {
    afterTimestamp?: number;
    beforeTimestamp?: number;
    projectPath?: string;
}): SearchResult[];
/**
 * Text-based search (fallback)
 */
export declare function textSearch(query: string, limit?: number, filters?: {
    afterTimestamp?: number;
    beforeTimestamp?: number;
    projectPath?: string;
}): SearchResult[];
/**
 * Get memory statistics
 */
export declare function getStats(): Omit<MemoryStats, 'enabled' | 'storageCapMb'>;
/**
 * Set import state
 */
export declare function setImportState(key: string, value: string): void;
/**
 * Get import state
 */
export declare function getImportState(key: string): string | null;
/**
 * Prune old exchanges to stay within storage cap
 */
export declare function pruneToCapacity(capBytes: number): number;
//# sourceMappingURL=db.d.ts.map