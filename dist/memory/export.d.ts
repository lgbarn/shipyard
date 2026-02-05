/**
 * Shipyard Memory - Database Export Tool
 *
 * Produces a full JSON export of all sessions and exchanges for data portability.
 * Uses streaming writes to maintain constant memory usage regardless of database size.
 */
import type { ExportResult } from './types';
/**
 * Main entry point for database export.
 * Exports all sessions and exchanges to a JSON file using streaming writes.
 *
 * @param outputPath - Optional custom output path. If not provided, uses CONFIG_DIR/exports/memory-export-{timestamp}.json
 * @returns Export result containing output path, file size, counts, and timestamp
 */
export declare function runExport(outputPath?: string): Promise<ExportResult>;
/**
 * Format an export result as a markdown report for MCP tool output.
 */
export declare function formatExportReport(result: ExportResult): string;
//# sourceMappingURL=export.d.ts.map