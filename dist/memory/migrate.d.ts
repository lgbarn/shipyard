/**
 * Shipyard Memory - Migration Runner
 *
 * Manages sequential SQL migrations for the memory database.
 */
import Database from 'better-sqlite3';
export interface Migration {
    version: number;
    filename: string;
    sql: string;
}
export interface AppliedMigration {
    version: number;
    filename: string;
    applied_at: number;
}
/**
 * Read migration files from the migrations directory.
 * Returns sorted array by version number (extracted from filename).
 */
export declare function readMigrationFiles(migrationsDir?: string): Migration[];
/**
 * Query schema_migrations table for already-applied migrations.
 */
export declare function getAppliedMigrations(db: Database.Database): AppliedMigration[];
/**
 * Apply a single migration within a transaction.
 * Inserts record into schema_migrations on success.
 * Rolls back and throws on failure.
 */
export declare function applyMigration(db: Database.Database, migration: Migration): void;
/**
 * Orchestrate migration process:
 * 1. Read migration files
 * 2. Get already-applied migrations
 * 3. Apply unapplied migrations in order
 * 4. Stop on first error
 */
export declare function runMigrations(db: Database.Database, migrationsDir?: string): void;
//# sourceMappingURL=migrate.d.ts.map