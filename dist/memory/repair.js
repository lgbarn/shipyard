"use strict";
/**
 * Shipyard Memory - Database Repair Tool
 *
 * Detects and fixes database corruption, orphaned data, stale references,
 * missing embeddings, and index health issues.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRepair = runRepair;
exports.formatRepairReport = formatRepairReport;
const fs = __importStar(require("fs"));
const db_1 = require("./db");
const config_1 = require("./config");
const embeddings_1 = require("./embeddings");
const logger_1 = require("./logger");
/**
 * Run database repair checks and optionally apply fixes
 *
 * @param dryRun - If true, only report issues without fixing them (default: true)
 * @returns RepairReport with check results and statistics
 */
async function runRepair(dryRun = true) {
    const db = (0, db_1.getDatabase)();
    const checks = [];
    const sizeBefore = fs.statSync(config_1.DATABASE_PATH).size;
    // Check 1: Structural integrity (abort if failed)
    checks.push(checkStructuralIntegrity(db));
    if (checks[0].status === 'error') {
        return {
            checks,
            dryRun,
            totalIssues: 1,
            timestamp: Date.now(),
            databaseSizeBefore: sizeBefore,
        };
    }
    // Checks 2-5: Data integrity
    checks.push(checkReferentialIntegrity(db));
    checks.push(checkOrphanedVectors(db, dryRun));
    checks.push(checkStaleReferences(db));
    checks.push(await checkMissingEmbeddings(db, dryRun));
    // Checks 6-7: Index rebuild and optimization (only in fix mode)
    if (!dryRun) {
        checks.push(rebuildIndexes(db));
        checks.push(optimizeDatabase(db));
    }
    else {
        checks.push({
            name: 'Index rebuild',
            status: 'skipped',
            details: 'Skipped in dry run mode',
        });
        checks.push({
            name: 'Database optimization',
            status: 'skipped',
            details: 'Skipped in dry run mode',
        });
    }
    // Calculate total issues
    const totalIssues = checks.reduce((sum, check) => {
        if (['warning', 'error', 'fixed'].includes(check.status) && check.count !== undefined) {
            return sum + check.count;
        }
        return sum;
    }, 0);
    const sizeAfter = fs.statSync(config_1.DATABASE_PATH).size;
    logger_1.logger.info('Repair completed', { dryRun, totalIssues, checks: checks.length });
    return {
        checks,
        dryRun,
        totalIssues,
        timestamp: Date.now(),
        databaseSizeBefore: sizeBefore,
        databaseSizeAfter: sizeAfter,
    };
}
/**
 * Format a repair report as markdown
 *
 * @param report - RepairReport to format
 * @returns Markdown-formatted report string
 */
function formatRepairReport(report) {
    const lines = [];
    lines.push('# Repair Report');
    lines.push('');
    lines.push(`**Mode:** ${report.dryRun ? 'Dry run' : 'Fix'}`);
    lines.push(`**Timestamp:** ${new Date(report.timestamp).toISOString()}`);
    lines.push(`**Total issues:** ${report.totalIssues}`);
    lines.push('');
    lines.push('## Checks');
    lines.push('');
    lines.push('| Check | Status | Details |');
    lines.push('|-------|--------|---------|');
    for (const check of report.checks) {
        lines.push(`| ${check.name} | ${check.status} | ${check.details} |`);
    }
    if (report.databaseSizeBefore !== undefined && report.databaseSizeAfter !== undefined) {
        const beforeKB = (report.databaseSizeBefore / 1024).toFixed(2);
        const afterKB = (report.databaseSizeAfter / 1024).toFixed(2);
        const savedBytes = report.databaseSizeBefore - report.databaseSizeAfter;
        const savedKB = (savedBytes / 1024).toFixed(2);
        lines.push('');
        lines.push('## Database Size');
        lines.push('');
        lines.push(`- Before: ${beforeKB} KB`);
        lines.push(`- After: ${afterKB} KB`);
        lines.push(`- Saved: ${savedKB} KB`);
    }
    return lines.join('\n');
}
/**
 * Check 1: Structural integrity
 */
function checkStructuralIntegrity(db) {
    try {
        const result = db.prepare('PRAGMA integrity_check').all();
        if (result.length === 1 && result[0].integrity_check === 'ok') {
            return {
                name: 'Structural integrity',
                status: 'ok',
                details: 'Database structure is valid',
            };
        }
        const errorDetails = result.map(r => r.integrity_check).join('; ');
        logger_1.logger.error('Structural integrity check failed', { errors: errorDetails });
        return {
            name: 'Structural integrity',
            status: 'error',
            details: errorDetails,
            count: result.length,
        };
    }
    catch (error) {
        logger_1.logger.error('Structural integrity check failed', { error: String(error) });
        return {
            name: 'Structural integrity',
            status: 'error',
            details: `Check failed: ${String(error)}`,
        };
    }
}
/**
 * Check 2: Referential integrity
 */
function checkReferentialIntegrity(db) {
    try {
        const result = db.prepare('PRAGMA foreign_key_check').all();
        if (result.length === 0) {
            return {
                name: 'Referential integrity',
                status: 'ok',
                details: 'No foreign key violations',
                count: 0,
            };
        }
        return {
            name: 'Referential integrity',
            status: 'warning',
            details: `Found ${result.length} foreign key violation(s)`,
            count: result.length,
        };
    }
    catch (error) {
        logger_1.logger.error('Referential integrity check failed', { error: String(error) });
        return {
            name: 'Referential integrity',
            status: 'error',
            details: `Check failed: ${String(error)}`,
        };
    }
}
/**
 * Check 3: Orphaned vector entries (two-step approach)
 */
function checkOrphanedVectors(db, dryRun) {
    if (!(0, db_1.isVecEnabled)()) {
        return {
            name: 'Orphaned vector entries',
            status: 'skipped',
            details: 'Vector extension not loaded',
        };
    }
    try {
        // Step 1: Get all vector IDs
        const vecRows = db.prepare('SELECT id FROM vec_exchanges').all();
        // Step 2: Check which are orphaned
        const orphanIds = [];
        for (const { id } of vecRows) {
            const exists = db.prepare('SELECT 1 FROM exchanges WHERE id = ?').get(id);
            if (!exists) {
                orphanIds.push(id);
            }
        }
        if (orphanIds.length === 0) {
            return {
                name: 'Orphaned vector entries',
                status: 'ok',
                details: 'No orphaned vectors found',
                count: 0,
            };
        }
        if (dryRun) {
            return {
                name: 'Orphaned vector entries',
                status: 'warning',
                details: `Found ${orphanIds.length} orphaned vector(s)`,
                count: orphanIds.length,
            };
        }
        // Fix mode: delete orphans in transaction
        try {
            db.exec('BEGIN IMMEDIATE');
            const placeholders = orphanIds.map(() => '?').join(',');
            db.prepare(`DELETE FROM vec_exchanges WHERE id IN (${placeholders})`).run(...orphanIds);
            db.exec('COMMIT');
            return {
                name: 'Orphaned vector entries',
                status: 'fixed',
                details: `Deleted ${orphanIds.length} orphaned vector(s)`,
                count: orphanIds.length,
            };
        }
        catch (deleteError) {
            try {
                db.exec('ROLLBACK');
            }
            catch (rollbackError) {
                logger_1.logger.error('ROLLBACK failed', { rollbackError: String(rollbackError) });
            }
            throw deleteError;
        }
    }
    catch (error) {
        logger_1.logger.error('Orphaned vector check failed', { error: String(error) });
        return {
            name: 'Orphaned vector entries',
            status: 'error',
            details: `Check failed: ${String(error)}`,
        };
    }
}
/**
 * Check 4: Stale source references (report-only)
 */
function checkStaleReferences(db) {
    try {
        const filePaths = db.prepare(`
      SELECT DISTINCT source_file
      FROM exchanges
      WHERE source_file IS NOT NULL AND source_file NOT LIKE 'session:%'
    `).all();
        const staleFiles = [];
        for (const { source_file } of filePaths) {
            if (!fs.existsSync(source_file)) {
                staleFiles.push(source_file);
            }
        }
        if (staleFiles.length === 0) {
            return {
                name: 'Stale source references',
                status: 'ok',
                details: 'All source files exist',
                count: 0,
            };
        }
        return {
            name: 'Stale source references',
            status: 'warning',
            details: `Found ${staleFiles.length} deleted source file(s). Data preserved.`,
            count: staleFiles.length,
        };
    }
    catch (error) {
        logger_1.logger.error('Stale reference check failed', { error: String(error) });
        return {
            name: 'Stale source references',
            status: 'error',
            details: `Check failed: ${String(error)}`,
        };
    }
}
/**
 * Check 5: Missing embeddings
 */
async function checkMissingEmbeddings(db, dryRun) {
    if (!(0, db_1.isVecEnabled)()) {
        return {
            name: 'Missing embeddings',
            status: 'skipped',
            details: 'Vector extension not loaded',
        };
    }
    try {
        const missingRows = db.prepare(`
      SELECT id, user_message, assistant_message, tool_names
      FROM exchanges
      WHERE embedding IS NULL
    `).all();
        if (missingRows.length === 0) {
            return {
                name: 'Missing embeddings',
                status: 'ok',
                details: 'All exchanges have embeddings',
                count: 0,
            };
        }
        if (dryRun) {
            return {
                name: 'Missing embeddings',
                status: 'warning',
                details: `Found ${missingRows.length} exchange(s) missing embeddings`,
                count: missingRows.length,
            };
        }
        // Fix mode: regenerate embeddings
        let regenerated = 0;
        for (const row of missingRows) {
            try {
                const toolNames = JSON.parse(row.tool_names || '[]');
                const embedding = await (0, embeddings_1.generateExchangeEmbedding)(row.user_message, row.assistant_message, toolNames);
                db.exec('BEGIN IMMEDIATE');
                db.prepare('UPDATE exchanges SET embedding = ? WHERE id = ?')
                    .run(Buffer.from(embedding.buffer), row.id);
                db.prepare('INSERT OR REPLACE INTO vec_exchanges (id, embedding) VALUES (?, ?)')
                    .run(row.id, Buffer.from(embedding.buffer));
                db.exec('COMMIT');
                regenerated++;
            }
            catch (rowError) {
                try {
                    db.exec('ROLLBACK');
                }
                catch (rollbackError) {
                    logger_1.logger.error('ROLLBACK failed', { rollbackError: String(rollbackError) });
                }
                logger_1.logger.warn('Failed to regenerate embedding', { id: row.id, error: String(rowError) });
            }
        }
        return {
            name: 'Missing embeddings',
            status: 'fixed',
            details: `Regenerated ${regenerated} of ${missingRows.length} embedding(s)`,
            count: regenerated,
        };
    }
    catch (error) {
        logger_1.logger.error('Missing embeddings check failed', { error: String(error) });
        return {
            name: 'Missing embeddings',
            status: 'error',
            details: `Check failed: ${String(error)}`,
        };
    }
}
/**
 * Check 6: Rebuild indexes
 */
function rebuildIndexes(db) {
    try {
        db.exec('REINDEX');
        return {
            name: 'Index rebuild',
            status: 'fixed',
            details: 'All indexes rebuilt',
        };
    }
    catch (error) {
        logger_1.logger.error('Index rebuild failed', { error: String(error) });
        return {
            name: 'Index rebuild',
            status: 'error',
            details: `Rebuild failed: ${String(error)}`,
        };
    }
}
/**
 * Check 7: Optimize database (VACUUM)
 */
function optimizeDatabase(db) {
    try {
        const sizeBefore = fs.statSync(config_1.DATABASE_PATH).size;
        db.exec('VACUUM');
        const sizeAfter = fs.statSync(config_1.DATABASE_PATH).size;
        const saved = sizeBefore - sizeAfter;
        const beforeKB = (sizeBefore / 1024).toFixed(2);
        const afterKB = (sizeAfter / 1024).toFixed(2);
        return {
            name: 'Database optimization',
            status: 'fixed',
            details: `VACUUM completed. Saved ${saved} bytes (${beforeKB} KB -> ${afterKB} KB)`,
            count: saved,
        };
    }
    catch (error) {
        logger_1.logger.error('Database optimization failed', { error: String(error) });
        return {
            name: 'Database optimization',
            status: 'error',
            details: `Optimization failed: ${String(error)}`,
        };
    }
}
//# sourceMappingURL=repair.js.map