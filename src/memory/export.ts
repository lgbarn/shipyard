/**
 * Shipyard Memory - Database Export Tool
 *
 * Produces a full JSON export of all sessions and exchanges for data portability.
 * Uses streaming writes to maintain constant memory usage regardless of database size.
 */

import type Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import { getDatabase } from './db'
import { CONFIG_DIR, DATABASE_PATH, ensureConfigDir } from './config'
import { logger } from './logger'
import type { ExportMetadata, ExportResult } from './types'

/**
 * Main entry point for database export.
 * Exports all sessions and exchanges to a JSON file using streaming writes.
 *
 * @param outputPath - Optional custom output path. If not provided, uses CONFIG_DIR/exports/memory-export-{timestamp}.json
 * @returns Export result containing output path, file size, counts, and timestamp
 */
export async function runExport(outputPath?: string): Promise<ExportResult> {
  const db = getDatabase()

  const exportsDir = path.join(CONFIG_DIR, 'exports')
  ensureConfigDir()
  fs.mkdirSync(exportsDir, { recursive: true })

  // Generate default path if not provided
  if (!outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    outputPath = path.join(exportsDir, `memory-export-${timestamp}.json`)
  } else {
    // Validate custom path is within exports directory to prevent path traversal
    const resolved = path.resolve(outputPath)
    const resolvedExportsDir = path.resolve(exportsDir)
    if (!resolved.startsWith(resolvedExportsDir + path.sep) && resolved !== resolvedExportsDir) {
      throw new Error(`Export path must be within ${resolvedExportsDir}. Got: ${resolved}`)
    }
    outputPath = resolved
  }

  // Open write stream
  const stream = fs.createWriteStream(outputPath, { encoding: 'utf-8' })

  // Wrap all synchronous DB reads and stream writes in a single transaction
  // for snapshot consistency between metadata counts and actual data
  const { sessionCount, exchangeCount } = db.transaction(() => {
    // Gather metadata
    const metadata = gatherMetadata(db)

    // Write opening JSON structure and metadata
    stream.write('{\n  "metadata": ')
    stream.write(JSON.stringify(metadata, null, 2).split('\n').join('\n  '))
    stream.write(',\n  "sessions": [\n')

    // Stream sessions
    const sc = streamSessions(db, stream)

    // Write transition to exchanges array
    stream.write('\n  ],\n  "exchanges": [\n')

    // Stream exchanges
    const ec = streamExchanges(db, stream)

    // Write closing JSON structure
    stream.write('\n  ]\n}\n')

    return { sessionCount: sc, exchangeCount: ec }
  })()

  stream.end()

  // Await stream finish
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve)
    stream.on('error', (err) => {
      // Clean up partial file on write stream error
      try {
        if (fs.existsSync(outputPath!)) {
          fs.unlinkSync(outputPath!)
        }
      } catch (cleanupErr) {
        logger.warn('Failed to clean up partial export file', {
          outputPath,
          error: String(cleanupErr),
        })
      }
      reject(err)
    })
  })

  // Set restrictive permissions
  fs.chmodSync(outputPath, 0o600)

  // Get file stats for result
  const stats = fs.statSync(outputPath)

  // Log completion
  logger.info('Export completed', {
    outputPath,
    exchangeCount,
    sessionCount,
    fileSizeBytes: stats.size,
  })

  return {
    outputPath,
    fileSizeBytes: stats.size,
    exchangeCount,
    sessionCount,
    exportedAt: Date.now(),
  }
}

/**
 * Gather metadata about the database for the export file.
 * Includes counts, schema version from migration framework, and export timestamp.
 */
function gatherMetadata(db: Database.Database): ExportMetadata {
  const exchangeCount = (db.prepare('SELECT COUNT(*) as count FROM exchanges').get() as { count: number }).count
  const sessionCount = (db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number }).count

  // Read schema version from migration framework (Phase 1 dependency)
  const schemaRow = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as { version: number | null }
  const schemaVersion = schemaRow?.version ?? 0

  return {
    version: '1.0.0',
    schema_version: schemaVersion,
    exported_at: new Date().toISOString(),
    database_path: DATABASE_PATH,
    exchange_count: exchangeCount,
    session_count: sessionCount,
  }
}

/**
 * Stream all sessions to the output file.
 * Returns the count of sessions written.
 */
function streamSessions(db: Database.Database, stream: fs.WriteStream): number {
  const stmt = db.prepare('SELECT id, project_path, started_at, exchange_count FROM sessions')
  let count = 0
  let first = true

  for (const row of stmt.iterate()) {
    if (!first) stream.write(',\n')
    stream.write('    ' + JSON.stringify(row))
    first = false
    count++
  }

  return count
}

/**
 * Safely parse tool_names JSON string to array.
 * Returns empty array if raw is falsy or contains malformed JSON.
 */
function safeParseToolNames(raw: string | null, exchangeId: string): unknown[] {
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    logger.warn('Malformed tool_names JSON, using empty array', { exchangeId, raw })
    return []
  }
}

/**
 * Stream all exchanges to the output file.
 * Excludes the embedding field (derived data, not portable).
 * Parses tool_names from JSON string to array for cleaner export.
 * Returns the count of exchanges written.
 */
function streamExchanges(db: Database.Database, stream: fs.WriteStream): number {
  // Select all columns EXCEPT embedding (derived data, not portable)
  const stmt = db.prepare(`
    SELECT id, session_id, project_path, user_message, assistant_message,
           tool_names, timestamp, git_branch, source_file, line_start,
           line_end, indexed_at
    FROM exchanges
  `)
  let count = 0
  let first = true

  for (const row of stmt.iterate()) {
    if (!first) stream.write(',\n')
    // Parse tool_names from JSON string to array for cleaner export
    const typedRow = row as Record<string, unknown>
    const exportRow = {
      ...typedRow,
      tool_names: safeParseToolNames(typedRow.tool_names as string, typedRow.id as string),
    }
    stream.write('    ' + JSON.stringify(exportRow))
    first = false
    count++
  }

  return count
}

/**
 * Format an export result as a markdown report for MCP tool output.
 */
export function formatExportReport(result: ExportResult): string {
  const lines: string[] = []

  lines.push('# Export Report')
  lines.push('')
  lines.push(`**Exported at:** ${new Date(result.exportedAt).toISOString()}`)
  lines.push(`**Output file:** ${result.outputPath}`)
  lines.push(`**File size:** ${(result.fileSizeBytes / 1024).toFixed(2)} KB`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Sessions: ${result.sessionCount}`)
  lines.push(`- Exchanges: ${result.exchangeCount}`)

  return lines.join('\n')
}
