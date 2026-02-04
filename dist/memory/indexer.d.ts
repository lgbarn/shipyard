/**
 * Shipyard Memory - Indexer
 *
 * Processes conversation files and indexes exchanges with embeddings.
 */
import type { ParsedExchange } from './types';
interface IndexProgress {
    totalFiles: number;
    processedFiles: number;
    totalExchanges: number;
    indexedExchanges: number;
    errors: number;
}
/**
 * Run the full indexer on all conversation files
 */
export declare function runFullIndex(onProgress?: (progress: IndexProgress) => void): Promise<IndexProgress>;
/**
 * Run incremental index (only new/modified files)
 */
export declare function runIncrementalIndex(onProgress?: (progress: IndexProgress) => void): Promise<IndexProgress>;
/**
 * Run initial import
 */
export declare function runImport(force?: boolean, onProgress?: (progress: IndexProgress) => void): Promise<IndexProgress>;
/**
 * Index exchanges from the current session
 * (Called by hook after session ends)
 */
export declare function indexCurrentSession(sessionId: string, exchanges: ParsedExchange[], projectPath: string): Promise<number>;
export {};
//# sourceMappingURL=indexer.d.ts.map