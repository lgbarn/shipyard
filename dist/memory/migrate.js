"use strict";
/**
 * Shipyard Memory - Migration Runner
 *
 * Manages sequential SQL migrations for the memory database.
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
exports.readMigrationFiles = readMigrationFiles;
exports.getAppliedMigrations = getAppliedMigrations;
exports.applyMigration = applyMigration;
exports.runMigrations = runMigrations;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("./logger");
/**
 * Read migration files from the migrations directory.
 * Returns sorted array by version number (extracted from filename).
 */
function readMigrationFiles(migrationsDir) {
    const dir = migrationsDir || path.join(__dirname, 'migrations');
    if (!fs.existsSync(dir)) {
        logger_1.logger.warn('Migrations directory does not exist', { dir });
        return [];
    }
    const files = fs.readdirSync(dir);
    const migrationPattern = /^\d{3}_.*\.sql$/;
    const migrations = files
        .filter(filename => migrationPattern.test(filename))
        .map(filename => {
        const version = parseInt(filename.substring(0, 3), 10);
        const filePath = path.join(dir, filename);
        const sql = fs.readFileSync(filePath, 'utf-8');
        return { version, filename, sql };
    })
        .sort((a, b) => a.version - b.version);
    return migrations;
}
/**
 * Query schema_migrations table for already-applied migrations.
 */
function getAppliedMigrations(db) {
    const rows = db
        .prepare('SELECT version, filename, applied_at FROM schema_migrations ORDER BY version ASC')
        .all();
    return rows;
}
/**
 * Apply a single migration within a transaction.
 * Inserts record into schema_migrations on success.
 * Rolls back and throws on failure.
 */
function applyMigration(db, migration) {
    db.exec('BEGIN IMMEDIATE');
    try {
        db.exec(migration.sql);
        db.prepare('INSERT INTO schema_migrations (version, filename, applied_at) VALUES (?, ?, ?)')
            .run(migration.version, migration.filename, Date.now());
        db.exec('COMMIT');
    }
    catch (error) {
        // Attempt ROLLBACK, but if it fails, log separately and preserve original error
        try {
            db.exec('ROLLBACK');
        }
        catch (rollbackError) {
            logger_1.logger.error('ROLLBACK failed after migration error', {
                filename: migration.filename,
                version: migration.version,
                rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
            });
        }
        // Log the original migration error before re-throwing
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error('Migration failed', {
            filename: migration.filename,
            version: migration.version,
            error: errorMessage
        });
        throw new Error(`Migration ${migration.filename} failed: ${errorMessage}`);
    }
}
/**
 * Orchestrate migration process:
 * 1. Read migration files
 * 2. Get already-applied migrations
 * 3. Apply unapplied migrations in order
 * 4. Stop on first error
 */
function runMigrations(db, migrationsDir) {
    const availableMigrations = readMigrationFiles(migrationsDir);
    const appliedMigrations = getAppliedMigrations(db);
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));
    const pendingMigrations = availableMigrations.filter(m => !appliedVersions.has(m.version));
    for (const migration of pendingMigrations) {
        applyMigration(db, migration);
        logger_1.logger.info('Applied migration', {
            version: migration.version,
            filename: migration.filename
        });
    }
}
//# sourceMappingURL=migrate.js.map