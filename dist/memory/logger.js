"use strict";
/**
 * Shipyard Memory - Structured Logger
 *
 * Lightweight JSON-lines logger for the memory subsystem.
 * No external dependencies — writes to stderr to avoid polluting MCP stdio transport.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.setLogLevel = setLogLevel;
const LEVEL_PRIORITY = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
let minLevel = 'info';
/**
 * Set the minimum log level
 */
function setLogLevel(level) {
    minLevel = level;
}
function shouldLog(level) {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}
function emit(level, msg, context) {
    if (!shouldLog(level))
        return;
    const entry = {
        ts: new Date().toISOString(),
        level,
        msg,
        ...context,
    };
    process.stderr.write(JSON.stringify(entry) + '\n');
}
exports.logger = {
    debug: (msg, context) => emit('debug', msg, context),
    info: (msg, context) => emit('info', msg, context),
    warn: (msg, context) => emit('warn', msg, context),
    error: (msg, context) => emit('error', msg, context),
};
//# sourceMappingURL=logger.js.map