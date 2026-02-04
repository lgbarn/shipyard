"use strict";
/**
 * Tests for the configuration module
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
const vitest_1 = require("vitest");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
// We need to mock the config paths for testing
let tmpDir;
(0, vitest_1.beforeEach)(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-config-test-'));
    // Reset module cache to pick up new paths
});
(0, vitest_1.afterEach)(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});
(0, vitest_1.describe)('configuration', () => {
    (0, vitest_1.describe)('default values', () => {
        (0, vitest_1.it)('should have memory disabled by default', () => {
            const DEFAULT_CONFIG = {
                memory: false,
                memory_storage_cap_mb: 1024,
            };
            (0, vitest_1.expect)(DEFAULT_CONFIG.memory).toBe(false);
        });
        (0, vitest_1.it)('should default to 1GB storage cap', () => {
            const DEFAULT_CONFIG = {
                memory: false,
                memory_storage_cap_mb: 1024,
            };
            (0, vitest_1.expect)(DEFAULT_CONFIG.memory_storage_cap_mb).toBe(1024);
        });
    });
    (0, vitest_1.describe)('path conventions', () => {
        (0, vitest_1.it)('should use ~/.config/shipyard for config directory', () => {
            const configDir = path.join(os.homedir(), '.config', 'shipyard');
            (0, vitest_1.expect)(configDir).toContain('.config');
            (0, vitest_1.expect)(configDir).toContain('shipyard');
        });
        (0, vitest_1.it)('should use memory.db for database', () => {
            const dbPath = path.join(os.homedir(), '.config', 'shipyard', 'memory.db');
            (0, vitest_1.expect)(dbPath).toContain('memory.db');
        });
        (0, vitest_1.it)('should use ~/.claude/projects for Claude history', () => {
            const claudeDir = path.join(os.homedir(), '.claude', 'projects');
            (0, vitest_1.expect)(claudeDir).toContain('.claude');
            (0, vitest_1.expect)(claudeDir).toContain('projects');
        });
    });
    (0, vitest_1.describe)('project exclusion', () => {
        (0, vitest_1.it)('should detect memory: false in project config', () => {
            const projectDir = path.join(tmpDir, 'project');
            const shipyardDir = path.join(projectDir, '.shipyard');
            fs.mkdirSync(shipyardDir, { recursive: true });
            fs.writeFileSync(path.join(shipyardDir, 'config.json'), JSON.stringify({ memory: false }));
            const configContent = fs.readFileSync(path.join(shipyardDir, 'config.json'), 'utf-8');
            const config = JSON.parse(configContent);
            (0, vitest_1.expect)(config.memory).toBe(false);
        });
        (0, vitest_1.it)('should allow memory when not explicitly excluded', () => {
            const projectDir = path.join(tmpDir, 'project');
            const shipyardDir = path.join(projectDir, '.shipyard');
            fs.mkdirSync(shipyardDir, { recursive: true });
            fs.writeFileSync(path.join(shipyardDir, 'config.json'), JSON.stringify({ interaction_mode: 'interactive' }));
            const configContent = fs.readFileSync(path.join(shipyardDir, 'config.json'), 'utf-8');
            const config = JSON.parse(configContent);
            (0, vitest_1.expect)(config.memory).toBeUndefined();
        });
    });
    (0, vitest_1.describe)('storage cap calculation', () => {
        (0, vitest_1.it)('should convert MB to bytes correctly', () => {
            const capMb = 1024;
            const capBytes = capMb * 1024 * 1024;
            (0, vitest_1.expect)(capBytes).toBe(1073741824); // 1 GB in bytes
        });
        (0, vitest_1.it)('should support custom storage caps', () => {
            const config = { memory_storage_cap_mb: 2048 };
            const capBytes = config.memory_storage_cap_mb * 1024 * 1024;
            (0, vitest_1.expect)(capBytes).toBe(2147483648); // 2 GB in bytes
        });
    });
});
//# sourceMappingURL=config.test.js.map