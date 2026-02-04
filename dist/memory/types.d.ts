/**
 * Shipyard Memory - Type Definitions
 */
export interface Exchange {
    id: string;
    sessionId: string;
    projectPath: string | null;
    userMessage: string;
    assistantMessage: string;
    toolNames: string[];
    timestamp: number;
    gitBranch: string | null;
    sourceFile: string;
    lineStart: number;
    lineEnd: number;
    embedding?: Float32Array;
    indexedAt: number;
}
export interface Session {
    id: string;
    projectPath: string | null;
    startedAt: number;
    exchangeCount: number;
}
export interface SearchResult {
    exchange: Exchange;
    score: number;
}
export interface SearchOptions {
    query: string;
    limit?: number;
    after?: string;
    before?: string;
    project?: string;
}
export interface MemoryStats {
    enabled: boolean;
    databaseSizeMb: number;
    storageCapMb: number;
    exchangeCount: number;
    oldestExchange: number | null;
    newestExchange: number | null;
    lastIndexedAt: number | null;
    projectCounts: Array<{
        project: string;
        count: number;
    }>;
    importCompleted: boolean;
}
export interface MemoryConfig {
    memory: boolean;
    memory_storage_cap_mb: number;
}
export interface ProjectConfig {
    memory?: boolean;
}
export interface ParsedExchange {
    userMessage: string;
    assistantMessage: string;
    toolNames: string[];
    timestamp: number;
    sessionId: string;
    parentUuid?: string;
}
export interface ConversationFile {
    path: string;
    projectPath: string;
    modifiedAt: number;
}
//# sourceMappingURL=types.d.ts.map