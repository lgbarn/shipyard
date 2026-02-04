/**
 * Shipyard Memory - Configuration Management
 */
import type { MemoryConfig, ProjectConfig } from './types';
export declare const CONFIG_DIR: string;
export declare const GLOBAL_CONFIG_PATH: string;
export declare const DATABASE_PATH: string;
export declare const LOG_PATH: string;
export declare const CLAUDE_PROJECTS_DIR: string;
export declare const DEFAULT_CONFIG: MemoryConfig;
/**
 * Ensure the config directory exists
 */
export declare function ensureConfigDir(): void;
/**
 * Read global memory configuration
 */
export declare function readGlobalConfig(): MemoryConfig;
/**
 * Write global memory configuration
 */
export declare function writeGlobalConfig(config: Partial<MemoryConfig>): void;
/**
 * Check if memory is enabled globally
 */
export declare function isMemoryEnabled(): boolean;
/**
 * Read project-specific configuration
 */
export declare function readProjectConfig(projectPath: string): ProjectConfig | null;
/**
 * Check if a project is excluded from memory
 */
export declare function isProjectExcluded(projectPath: string): boolean;
/**
 * Get storage cap in bytes
 */
export declare function getStorageCapBytes(): number;
//# sourceMappingURL=config.d.ts.map