/**
 * Shipyard Memory - Configuration Management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { MemoryConfig, ProjectConfig } from './types';

// Default paths
export const CONFIG_DIR = path.join(os.homedir(), '.config', 'shipyard');
export const GLOBAL_CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
export const DATABASE_PATH = path.join(CONFIG_DIR, 'memory.db');
export const LOG_PATH = path.join(CONFIG_DIR, 'memory.log');
export const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

// Default configuration
export const DEFAULT_CONFIG: MemoryConfig = {
  memory: false,
  memory_storage_cap_mb: 1024,
};

/**
 * Ensure the config directory exists
 */
export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Read global memory configuration
 */
export function readGlobalConfig(): MemoryConfig {
  try {
    if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
      const content = fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf-8');
      const config = JSON.parse(content);
      return {
        ...DEFAULT_CONFIG,
        ...config,
      };
    }
  } catch {
    // Return defaults on error
  }
  return DEFAULT_CONFIG;
}

/**
 * Write global memory configuration
 */
export function writeGlobalConfig(config: Partial<MemoryConfig>): void {
  ensureConfigDir();
  const existing = readGlobalConfig();
  const merged = { ...existing, ...config };
  fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(merged, null, 2));
}

/**
 * Check if memory is enabled globally
 */
export function isMemoryEnabled(): boolean {
  const config = readGlobalConfig();
  return config.memory === true;
}

/**
 * Read project-specific configuration
 */
export function readProjectConfig(projectPath: string): ProjectConfig | null {
  try {
    const configPath = path.join(projectPath, '.shipyard', 'config.json');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // No project config
  }
  return null;
}

/**
 * Check if a project is excluded from memory
 */
export function isProjectExcluded(projectPath: string): boolean {
  const projectConfig = readProjectConfig(projectPath);
  return projectConfig?.memory === false;
}

/**
 * Get storage cap in bytes
 */
export function getStorageCapBytes(): number {
  const config = readGlobalConfig();
  return config.memory_storage_cap_mb * 1024 * 1024;
}
