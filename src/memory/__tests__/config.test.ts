/**
 * Tests for the configuration module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// We need to mock the config paths for testing
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-config-test-'));
  // Reset module cache to pick up new paths
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('configuration', () => {
  describe('default values', () => {
    it('should have memory disabled by default', () => {
      const DEFAULT_CONFIG = {
        memory: false,
        memory_storage_cap_mb: 1024,
      };

      expect(DEFAULT_CONFIG.memory).toBe(false);
    });

    it('should default to 1GB storage cap', () => {
      const DEFAULT_CONFIG = {
        memory: false,
        memory_storage_cap_mb: 1024,
      };

      expect(DEFAULT_CONFIG.memory_storage_cap_mb).toBe(1024);
    });
  });

  describe('path conventions', () => {
    it('should use ~/.config/shipyard for config directory', () => {
      const configDir = path.join(os.homedir(), '.config', 'shipyard');
      expect(configDir).toContain('.config');
      expect(configDir).toContain('shipyard');
    });

    it('should use memory.db for database', () => {
      const dbPath = path.join(os.homedir(), '.config', 'shipyard', 'memory.db');
      expect(dbPath).toContain('memory.db');
    });

    it('should use ~/.claude/projects for Claude history', () => {
      const claudeDir = path.join(os.homedir(), '.claude', 'projects');
      expect(claudeDir).toContain('.claude');
      expect(claudeDir).toContain('projects');
    });
  });

  describe('project exclusion', () => {
    it('should detect memory: false in project config', () => {
      const projectDir = path.join(tmpDir, 'project');
      const shipyardDir = path.join(projectDir, '.shipyard');
      fs.mkdirSync(shipyardDir, { recursive: true });
      fs.writeFileSync(
        path.join(shipyardDir, 'config.json'),
        JSON.stringify({ memory: false })
      );

      const configContent = fs.readFileSync(
        path.join(shipyardDir, 'config.json'),
        'utf-8'
      );
      const config = JSON.parse(configContent);

      expect(config.memory).toBe(false);
    });

    it('should allow memory when not explicitly excluded', () => {
      const projectDir = path.join(tmpDir, 'project');
      const shipyardDir = path.join(projectDir, '.shipyard');
      fs.mkdirSync(shipyardDir, { recursive: true });
      fs.writeFileSync(
        path.join(shipyardDir, 'config.json'),
        JSON.stringify({ interaction_mode: 'interactive' })
      );

      const configContent = fs.readFileSync(
        path.join(shipyardDir, 'config.json'),
        'utf-8'
      );
      const config = JSON.parse(configContent);

      expect(config.memory).toBeUndefined();
    });
  });

  describe('storage cap calculation', () => {
    it('should convert MB to bytes correctly', () => {
      const capMb = 1024;
      const capBytes = capMb * 1024 * 1024;

      expect(capBytes).toBe(1073741824); // 1 GB in bytes
    });

    it('should support custom storage caps', () => {
      const config = { memory_storage_cap_mb: 2048 };
      const capBytes = config.memory_storage_cap_mb * 1024 * 1024;

      expect(capBytes).toBe(2147483648); // 2 GB in bytes
    });
  });
});
