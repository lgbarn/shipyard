/**
 * Shipyard Memory - Structured Logger
 *
 * Lightweight JSON-lines logger for the memory subsystem.
 * No external dependencies — writes to stderr to avoid polluting MCP stdio transport.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
/**
 * Set the minimum log level
 */
export declare function setLogLevel(level: LogLevel): void;
export declare const logger: {
    debug: (msg: string, context?: Record<string, unknown>) => void;
    info: (msg: string, context?: Record<string, unknown>) => void;
    warn: (msg: string, context?: Record<string, unknown>) => void;
    error: (msg: string, context?: Record<string, unknown>) => void;
};
//# sourceMappingURL=logger.d.ts.map