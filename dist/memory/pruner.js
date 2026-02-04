"use strict";
/**
 * Shipyard Memory - Storage Pruner
 *
 * Enforces storage cap by removing oldest exchanges.
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
exports.getDatabaseSizeMb = getDatabaseSizeMb;
exports.isPruningNeeded = isPruningNeeded;
exports.getStorageUsagePercent = getStorageUsagePercent;
exports.runPrune = runPrune;
exports.deleteProjectExchanges = deleteProjectExchanges;
exports.getStorageBreakdown = getStorageBreakdown;
const fs = __importStar(require("fs"));
const config_1 = require("./config");
const db_1 = require("./db");
/**
 * Get current database size
 */
function getDatabaseSizeMb() {
    try {
        const stats = fs.statSync(config_1.DATABASE_PATH);
        return stats.size / (1024 * 1024);
    }
    catch {
        return 0;
    }
}
/**
 * Check if pruning is needed
 */
function isPruningNeeded() {
    const currentSize = getDatabaseSizeMb();
    const capMb = (0, config_1.getStorageCapBytes)() / (1024 * 1024);
    return currentSize > capMb;
}
/**
 * Get percentage of storage used
 */
function getStorageUsagePercent() {
    const currentSize = getDatabaseSizeMb();
    const capMb = (0, config_1.getStorageCapBytes)() / (1024 * 1024);
    return (currentSize / capMb) * 100;
}
/**
 * Run pruning to enforce storage cap
 */
function runPrune() {
    const previousSizeMb = getDatabaseSizeMb();
    const capBytes = (0, config_1.getStorageCapBytes)();
    // Get counts by project before pruning
    const db = (0, db_1.getDatabase)();
    const projectCountsBefore = new Map();
    const rows = db
        .prepare(`
    SELECT project_path, COUNT(*) as count
    FROM exchanges
    GROUP BY project_path
  `)
        .all();
    for (const row of rows) {
        projectCountsBefore.set(row.project_path || 'unknown', row.count);
    }
    // Run pruning
    const deletedExchanges = (0, db_1.pruneToCapacity)(capBytes);
    // Get counts by project after pruning
    const projectCountsAfter = new Map();
    const rowsAfter = db
        .prepare(`
    SELECT project_path, COUNT(*) as count
    FROM exchanges
    GROUP BY project_path
  `)
        .all();
    for (const row of rowsAfter) {
        projectCountsAfter.set(row.project_path || 'unknown', row.count);
    }
    // Calculate pruned by project
    const prunedByProject = new Map();
    for (const [project, countBefore] of projectCountsBefore) {
        const countAfter = projectCountsAfter.get(project) || 0;
        const pruned = countBefore - countAfter;
        if (pruned > 0) {
            prunedByProject.set(project, pruned);
        }
    }
    const newSizeMb = getDatabaseSizeMb();
    return {
        previousSizeMb,
        newSizeMb,
        deletedExchanges,
        prunedByProject,
    };
}
/**
 * Delete all exchanges from a specific project
 */
function deleteProjectExchanges(projectPath) {
    const db = (0, db_1.getDatabase)();
    // Delete from vector table first
    try {
        db.prepare(`
      DELETE FROM vec_exchanges WHERE id IN (
        SELECT id FROM exchanges WHERE project_path = ?
      )
    `).run(projectPath);
    }
    catch {
        // Vector table may not exist
    }
    const result = db.prepare('DELETE FROM exchanges WHERE project_path = ?').run(projectPath);
    return result.changes;
}
/**
 * Get storage breakdown by project
 */
function getStorageBreakdown() {
    const db = (0, db_1.getDatabase)();
    const totalSizeMb = getDatabaseSizeMb();
    const rows = db
        .prepare(`
    SELECT
      project_path,
      COUNT(*) as count,
      SUM(LENGTH(user_message) + LENGTH(assistant_message)) as text_size
    FROM exchanges
    GROUP BY project_path
    ORDER BY text_size DESC
  `)
        .all();
    const totalTextSize = rows.reduce((sum, row) => sum + row.text_size, 0);
    return rows.map((row) => ({
        project: row.project_path || 'unknown',
        exchangeCount: row.count,
        // Estimate size proportionally based on text content
        estimatedSizeMb: totalTextSize > 0 ? (row.text_size / totalTextSize) * totalSizeMb : 0,
    }));
}
//# sourceMappingURL=pruner.js.map