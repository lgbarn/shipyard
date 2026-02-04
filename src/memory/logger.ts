/**
 * Shipyard Memory - Structured Logger
 *
 * Lightweight JSON-lines logger for the memory subsystem.
 * No external dependencies — writes to stderr to avoid polluting MCP stdio transport.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let minLevel: LogLevel = 'info';

/**
 * Set the minimum log level
 */
export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function emit(level: LogLevel, msg: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...context,
  };

  process.stderr.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  debug: (msg: string, context?: Record<string, unknown>) => emit('debug', msg, context),
  info: (msg: string, context?: Record<string, unknown>) => emit('info', msg, context),
  warn: (msg: string, context?: Record<string, unknown>) => emit('warn', msg, context),
  error: (msg: string, context?: Record<string, unknown>) => emit('error', msg, context),
};
