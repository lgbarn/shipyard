/**
 * Shipyard Memory - Storage Pruner
 *
 * Enforces storage cap by removing oldest exchanges.
 */
export interface PruneResult {
    previousSizeMb: number;
    newSizeMb: number;
    deletedExchanges: number;
    prunedByProject: Map<string, number>;
}
/**
 * Get current database size
 */
export declare function getDatabaseSizeMb(): number;
/**
 * Check if pruning is needed
 */
export declare function isPruningNeeded(): boolean;
/**
 * Get percentage of storage used
 */
export declare function getStorageUsagePercent(): number;
/**
 * Run pruning to enforce storage cap
 */
export declare function runPrune(): PruneResult;
/**
 * Delete all exchanges from a specific project
 */
export declare function deleteProjectExchanges(projectPath: string): number;
/**
 * Get storage breakdown by project
 */
export declare function getStorageBreakdown(): Array<{
    project: string;
    exchangeCount: number;
    estimatedSizeMb: number;
}>;
//# sourceMappingURL=pruner.d.ts.map