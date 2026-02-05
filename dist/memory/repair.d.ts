/**
 * Shipyard Memory - Database Repair Tool
 *
 * Detects and fixes database corruption, orphaned data, stale references,
 * missing embeddings, and index health issues.
 */
import type { RepairReport } from './types';
/**
 * Run database repair checks and optionally apply fixes
 *
 * @param dryRun - If true, only report issues without fixing them (default: true)
 * @returns RepairReport with check results and statistics
 */
export declare function runRepair(dryRun?: boolean): Promise<RepairReport>;
/**
 * Format a repair report as markdown
 *
 * @param report - RepairReport to format
 * @returns Markdown-formatted report string
 */
export declare function formatRepairReport(report: RepairReport): string;
//# sourceMappingURL=repair.d.ts.map