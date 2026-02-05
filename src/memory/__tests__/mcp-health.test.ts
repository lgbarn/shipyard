/**
 * Tests for the memory_health MCP tool
 */

import { describe, it, expect } from 'vitest';
import { initDatabase, closeDatabase } from '../db';
import { handleHealth, TOOLS } from '../mcp-server';

describe('memory_health', () => {
  describe('tool definition', () => {
    it('should include memory_health in the exported TOOLS array', () => {
      const tool = TOOLS.find(t => t.name === 'memory_health');
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.type).toBe('object');
      expect(tool!.inputSchema.required).toHaveLength(0);
    });

    it('should define all tools with required properties', () => {
      expect(TOOLS.length).toBeGreaterThanOrEqual(10);
      for (const tool of TOOLS) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
      }
    });
  });

  describe('handleHealth response format', () => {
    it('should return health status with expected sections', () => {
      initDatabase();

      try {
        const result = handleHealth();

        // Verify top-level structure
        expect(result).toContain('## MCP Server Health');
        expect(result).toContain('**Status:**');
        expect(result).toContain('**Version:** shipyard-memory@1.0.0');

        // Verify Database section
        expect(result).toContain('### Database');
        expect(result).toContain('- Connected:');
        expect(result).toContain('- Path:');
        expect(result).toContain('- Size:');
        expect(result).toContain('- Exchanges:');

        // Verify Vector Search section
        expect(result).toContain('### Vector Search');
        expect(result).toContain('- Enabled:');
        expect(result).toContain('- Extension: sqlite-vec');

        // Verify Embeddings section
        expect(result).toContain('### Embeddings');
        expect(result).toContain('- Model Loaded:');
        expect(result).toContain('- Model: Xenova/all-MiniLM-L6-v2');
        expect(result).toContain('- Dimension: 384');
      } finally {
        closeDatabase();
      }
    });

    it('should report DB as connected after initialization', () => {
      initDatabase();

      try {
        const result = handleHealth();
        expect(result).toContain('- Connected: Yes');
      } finally {
        closeDatabase();
      }
    });

    it('should report exchange count as a non-negative number', () => {
      initDatabase();

      try {
        const result = handleHealth();

        // Exchange count should be a non-negative integer
        const exchangeMatch = result.match(/- Exchanges: (\d+)/);
        expect(exchangeMatch).not.toBeNull();
        expect(Number(exchangeMatch![1])).toBeGreaterThanOrEqual(0);
      } finally {
        closeDatabase();
      }
    });

    it('should report a valid status value', () => {
      initDatabase();

      try {
        const result = handleHealth();

        // Status must be one of the three valid values
        const statusMatch = result.match(/\*\*Status:\*\* (healthy|degraded|unhealthy)/);
        expect(statusMatch).not.toBeNull();
      } finally {
        closeDatabase();
      }
    });
  });

  describe('new tool definitions', () => {
    it('should include memory_repair in TOOLS array', () => {
      const tool = TOOLS.find(t => t.name === 'memory_repair');
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.type).toBe('object');
      expect(tool!.inputSchema.properties).toHaveProperty('dry_run');
      expect(tool!.inputSchema.required).toHaveLength(0);
    });

    it('should include memory_export in TOOLS array', () => {
      const tool = TOOLS.find(t => t.name === 'memory_export');
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.type).toBe('object');
      expect(tool!.inputSchema.properties).toHaveProperty('output_path');
      expect(tool!.inputSchema.required).toHaveLength(0);
    });

    it('should include memory_migrate in TOOLS array', () => {
      const tool = TOOLS.find(t => t.name === 'memory_migrate');
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.type).toBe('object');
      expect(tool!.inputSchema.required).toHaveLength(0);
    });
  });
});
