/**
 * Tests for the conversation parser module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseConversationFile, findConversationFiles, decodeProjectPath } from '../parser';

describe('decodeProjectPath', () => {
  it('should decode hyphen-separated paths', () => {
    expect(decodeProjectPath('/home/user/.claude/projects/-Users-name-myproject')).toBe(
      '/Users/name/myproject'
    );
  });

  it('should handle paths without hyphen prefix', () => {
    const input = '/home/user/.claude/projects/some-project';
    expect(decodeProjectPath(input)).toBe(input);
  });

  it('should handle paths without projects directory', () => {
    const input = '/home/user/documents/project';
    expect(decodeProjectPath(input)).toBe(input);
  });
});

describe('parseConversationFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should parse user/assistant exchanges', async () => {
    const filePath = path.join(tmpDir, 'conversation.jsonl');
    const lines = [
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Hello, Claude!' },
        timestamp: '2026-01-01T00:00:00Z',
        sessionId: 'test-session',
      }),
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: 'Hello! How can I help you today?' },
        timestamp: '2026-01-01T00:00:01Z',
      }),
    ];
    fs.writeFileSync(filePath, lines.join('\n'));

    const exchanges = await parseConversationFile(filePath);

    expect(exchanges).toHaveLength(1);
    expect(exchanges[0].userMessage).toBe('Hello, Claude!');
    expect(exchanges[0].assistantMessage).toBe('Hello! How can I help you today?');
    expect(exchanges[0].sessionId).toBe('test-session');
  });

  it('should extract tool names from assistant messages', async () => {
    const filePath = path.join(tmpDir, 'conversation.jsonl');
    const lines = [
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Read this file' },
        timestamp: '2026-01-01T00:00:00Z',
      }),
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me read that file.' },
            { type: 'tool_use', name: 'Read', id: 'tool-1' },
          ],
        },
        timestamp: '2026-01-01T00:00:01Z',
      }),
    ];
    fs.writeFileSync(filePath, lines.join('\n'));

    const exchanges = await parseConversationFile(filePath);

    expect(exchanges).toHaveLength(1);
    expect(exchanges[0].toolNames).toContain('Read');
  });

  it('should handle content as array with text blocks', async () => {
    const filePath = path.join(tmpDir, 'conversation.jsonl');
    const lines = [
      JSON.stringify({
        role: 'user',
        content: [{ type: 'text', text: 'First part' }, { type: 'text', text: 'Second part' }],
        timestamp: '2026-01-01T00:00:00Z',
      }),
      JSON.stringify({
        role: 'assistant',
        content: [{ type: 'text', text: 'Response here' }],
        timestamp: '2026-01-01T00:00:01Z',
      }),
    ];
    fs.writeFileSync(filePath, lines.join('\n'));

    const exchanges = await parseConversationFile(filePath);

    expect(exchanges).toHaveLength(1);
    expect(exchanges[0].userMessage).toBe('First part\nSecond part');
  });

  it('should skip malformed lines', async () => {
    const filePath = path.join(tmpDir, 'conversation.jsonl');
    const lines = [
      'not valid json',
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Valid message' },
      }),
      '{ broken json',
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: 'Valid response' },
      }),
    ];
    fs.writeFileSync(filePath, lines.join('\n'));

    const exchanges = await parseConversationFile(filePath);

    expect(exchanges).toHaveLength(1);
    expect(exchanges[0].userMessage).toBe('Valid message');
  });

  it('should handle empty files', async () => {
    const filePath = path.join(tmpDir, 'empty.jsonl');
    fs.writeFileSync(filePath, '');

    const exchanges = await parseConversationFile(filePath);

    expect(exchanges).toHaveLength(0);
  });

  it('should handle multiple exchanges', async () => {
    const filePath = path.join(tmpDir, 'multi.jsonl');
    const lines = [
      JSON.stringify({ type: 'user', message: { content: 'First question' } }),
      JSON.stringify({ type: 'assistant', message: { content: 'First answer' } }),
      JSON.stringify({ type: 'user', message: { content: 'Second question' } }),
      JSON.stringify({ type: 'assistant', message: { content: 'Second answer' } }),
    ];
    fs.writeFileSync(filePath, lines.join('\n'));

    const exchanges = await parseConversationFile(filePath);

    expect(exchanges).toHaveLength(2);
    expect(exchanges[0].userMessage).toBe('First question');
    expect(exchanges[1].userMessage).toBe('Second question');
  });
});

describe('findConversationFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-find-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should find JSONL files in directory', () => {
    // Create test structure
    const projectDir = path.join(tmpDir, 'project1');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'conv1.jsonl'), '{}');
    fs.writeFileSync(path.join(projectDir, 'conv2.jsonl'), '{}');
    fs.writeFileSync(path.join(projectDir, 'readme.md'), '# Readme');

    const files = findConversationFiles(tmpDir);

    expect(files).toHaveLength(2);
    expect(files.every((f) => f.path.endsWith('.jsonl'))).toBe(true);
  });

  it('should track project paths', () => {
    const projectDir = path.join(tmpDir, 'myproject');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'conv.jsonl'), '{}');

    const files = findConversationFiles(tmpDir);

    expect(files).toHaveLength(1);
    expect(files[0].projectPath).toBe(projectDir);
  });

  it('should handle nested directories', () => {
    const nestedDir = path.join(tmpDir, 'a', 'b', 'c');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(nestedDir, 'deep.jsonl'), '{}');

    const files = findConversationFiles(tmpDir);

    expect(files).toHaveLength(1);
    expect(files[0].path).toContain('deep.jsonl');
  });

  it('should return empty array for non-existent directory', () => {
    const files = findConversationFiles('/nonexistent/path');
    expect(files).toHaveLength(0);
  });

  it('should return empty array for empty directory', () => {
    const files = findConversationFiles(tmpDir);
    expect(files).toHaveLength(0);
  });
});
