/**
 * Shipyard Memory - Storage Pruner
 *
 * Enforces storage cap by removing oldest exchanges.
 */

import * as fs from 'fs';
import { DATABASE_PATH, getStorageCapBytes } from './config';
import { getDatabase, pruneToCapacity } from './db';

export interface PruneResult {
  previousSizeMb: number;
  newSizeMb: number;
  deletedExchanges: number;
  prunedByProject: Map<string, number>;
}

/**
 * Get current database size
 */
export function getDatabaseSizeMb(): number {
  try {
    const stats = fs.statSync(DATABASE_PATH);
    return stats.size / (1024 * 1024);
  } catch {
    return 0;
  }
}

/**
 * Check if pruning is needed
 */
export function isPruningNeeded(): boolean {
  const currentSize = getDatabaseSizeMb();
  const capMb = getStorageCapBytes() / (1024 * 1024);
  return currentSize > capMb;
}

/**
 * Get percentage of storage used
 */
export function getStorageUsagePercent(): number {
  const currentSize = getDatabaseSizeMb();
  const capMb = getStorageCapBytes() / (1024 * 1024);
  return (currentSize / capMb) * 100;
}

/**
 * Run pruning to enforce storage cap
 */
export function runPrune(): PruneResult {
  const previousSizeMb = getDatabaseSizeMb();
  const capBytes = getStorageCapBytes();

  // Get counts by project before pruning
  const db = getDatabase();
  const projectCountsBefore = new Map<string, number>();
  const rows = db
    .prepare(
      `
    SELECT project_path, COUNT(*) as count
    FROM exchanges
    GROUP BY project_path
  `
    )
    .all() as Array<{ project_path: string | null; count: number }>;

  for (const row of rows) {
    projectCountsBefore.set(row.project_path || 'unknown', row.count);
  }

  // Run pruning
  const deletedExchanges = pruneToCapacity(capBytes);

  // Get counts by project after pruning
  const projectCountsAfter = new Map<string, number>();
  const rowsAfter = db
    .prepare(
      `
    SELECT project_path, COUNT(*) as count
    FROM exchanges
    GROUP BY project_path
  `
    )
    .all() as Array<{ project_path: string | null; count: number }>;

  for (const row of rowsAfter) {
    projectCountsAfter.set(row.project_path || 'unknown', row.count);
  }

  // Calculate pruned by project
  const prunedByProject = new Map<string, number>();
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
export function deleteProjectExchanges(projectPath: string): number {
  const db = getDatabase();

  // Delete from vector table first
  try {
    db.prepare(
      `
      DELETE FROM vec_exchanges WHERE id IN (
        SELECT id FROM exchanges WHERE project_path = ?
      )
    `
    ).run(projectPath);
  } catch {
    // Vector table may not exist
  }

  const result = db.prepare('DELETE FROM exchanges WHERE project_path = ?').run(projectPath);

  return result.changes;
}

/**
 * Get storage breakdown by project
 */
export function getStorageBreakdown(): Array<{ project: string; exchangeCount: number; estimatedSizeMb: number }> {
  const db = getDatabase();
  const totalSizeMb = getDatabaseSizeMb();

  const rows = db
    .prepare(
      `
    SELECT
      project_path,
      COUNT(*) as count,
      SUM(LENGTH(user_message) + LENGTH(assistant_message)) as text_size
    FROM exchanges
    GROUP BY project_path
    ORDER BY text_size DESC
  `
    )
    .all() as Array<{ project_path: string | null; count: number; text_size: number }>;

  const totalTextSize = rows.reduce((sum, row) => sum + row.text_size, 0);

  return rows.map((row) => ({
    project: row.project_path || 'unknown',
    exchangeCount: row.count,
    // Estimate size proportionally based on text content
    estimatedSizeMb: totalTextSize > 0 ? (row.text_size / totalTextSize) * totalSizeMb : 0,
  }));
}
