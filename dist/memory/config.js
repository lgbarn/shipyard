"use strict";
/**
 * Shipyard Memory - Configuration Management
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
exports.DEFAULT_CONFIG = exports.CLAUDE_PROJECTS_DIR = exports.LOG_PATH = exports.DATABASE_PATH = exports.GLOBAL_CONFIG_PATH = exports.CONFIG_DIR = void 0;
exports.ensureConfigDir = ensureConfigDir;
exports.readGlobalConfig = readGlobalConfig;
exports.writeGlobalConfig = writeGlobalConfig;
exports.isMemoryEnabled = isMemoryEnabled;
exports.readProjectConfig = readProjectConfig;
exports.isProjectExcluded = isProjectExcluded;
exports.getStorageCapBytes = getStorageCapBytes;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
// Default paths
exports.CONFIG_DIR = path.join(os.homedir(), '.config', 'shipyard');
exports.GLOBAL_CONFIG_PATH = path.join(exports.CONFIG_DIR, 'config.json');
exports.DATABASE_PATH = path.join(exports.CONFIG_DIR, 'memory.db');
exports.LOG_PATH = path.join(exports.CONFIG_DIR, 'memory.log');
exports.CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
// Default configuration
exports.DEFAULT_CONFIG = {
    memory: false,
    memory_storage_cap_mb: 1024,
};
/**
 * Ensure the config directory exists
 */
function ensureConfigDir() {
    if (!fs.existsSync(exports.CONFIG_DIR)) {
        fs.mkdirSync(exports.CONFIG_DIR, { recursive: true });
    }
}
/**
 * Read global memory configuration
 */
function readGlobalConfig() {
    try {
        if (fs.existsSync(exports.GLOBAL_CONFIG_PATH)) {
            const content = fs.readFileSync(exports.GLOBAL_CONFIG_PATH, 'utf-8');
            const config = JSON.parse(content);
            return {
                ...exports.DEFAULT_CONFIG,
                ...config,
            };
        }
    }
    catch {
        // Return defaults on error
    }
    return exports.DEFAULT_CONFIG;
}
/**
 * Write global memory configuration
 */
function writeGlobalConfig(config) {
    ensureConfigDir();
    const existing = readGlobalConfig();
    const merged = { ...existing, ...config };
    fs.writeFileSync(exports.GLOBAL_CONFIG_PATH, JSON.stringify(merged, null, 2));
}
/**
 * Check if memory is enabled globally
 */
function isMemoryEnabled() {
    const config = readGlobalConfig();
    return config.memory === true;
}
/**
 * Read project-specific configuration
 */
function readProjectConfig(projectPath) {
    try {
        const configPath = path.join(projectPath, '.shipyard', 'config.json');
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(content);
        }
    }
    catch {
        // No project config
    }
    return null;
}
/**
 * Check if a project is excluded from memory
 */
function isProjectExcluded(projectPath) {
    const projectConfig = readProjectConfig(projectPath);
    return projectConfig?.memory === false;
}
/**
 * Get storage cap in bytes
 */
function getStorageCapBytes() {
    const config = readGlobalConfig();
    return config.memory_storage_cap_mb * 1024 * 1024;
}
//# sourceMappingURL=config.js.map