"use strict";
/**
 * Tests for the conversation parser module
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
const parser_1 = require("../parser");
(0, vitest_1.describe)('decodeProjectPath', () => {
    (0, vitest_1.it)('should decode hyphen-separated paths', () => {
        (0, vitest_1.expect)((0, parser_1.decodeProjectPath)('/home/user/.claude/projects/-Users-name-myproject')).toBe('/Users/name/myproject');
    });
    (0, vitest_1.it)('should handle paths without hyphen prefix', () => {
        const input = '/home/user/.claude/projects/some-project';
        (0, vitest_1.expect)((0, parser_1.decodeProjectPath)(input)).toBe(input);
    });
    (0, vitest_1.it)('should handle paths without projects directory', () => {
        const input = '/home/user/documents/project';
        (0, vitest_1.expect)((0, parser_1.decodeProjectPath)(input)).toBe(input);
    });
});
(0, vitest_1.describe)('parseConversationFile', () => {
    let tmpDir;
    (0, vitest_1.beforeEach)(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-test-'));
    });
    (0, vitest_1.afterEach)(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    (0, vitest_1.it)('should parse user/assistant exchanges', async () => {
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
        const exchanges = await (0, parser_1.parseConversationFile)(filePath);
        (0, vitest_1.expect)(exchanges).toHaveLength(1);
        (0, vitest_1.expect)(exchanges[0].userMessage).toBe('Hello, Claude!');
        (0, vitest_1.expect)(exchanges[0].assistantMessage).toBe('Hello! How can I help you today?');
        (0, vitest_1.expect)(exchanges[0].sessionId).toBe('test-session');
    });
    (0, vitest_1.it)('should extract tool names from assistant messages', async () => {
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
        const exchanges = await (0, parser_1.parseConversationFile)(filePath);
        (0, vitest_1.expect)(exchanges).toHaveLength(1);
        (0, vitest_1.expect)(exchanges[0].toolNames).toContain('Read');
    });
    (0, vitest_1.it)('should handle content as array with text blocks', async () => {
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
        const exchanges = await (0, parser_1.parseConversationFile)(filePath);
        (0, vitest_1.expect)(exchanges).toHaveLength(1);
        (0, vitest_1.expect)(exchanges[0].userMessage).toBe('First part\nSecond part');
    });
    (0, vitest_1.it)('should skip malformed lines', async () => {
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
        const exchanges = await (0, parser_1.parseConversationFile)(filePath);
        (0, vitest_1.expect)(exchanges).toHaveLength(1);
        (0, vitest_1.expect)(exchanges[0].userMessage).toBe('Valid message');
    });
    (0, vitest_1.it)('should handle empty files', async () => {
        const filePath = path.join(tmpDir, 'empty.jsonl');
        fs.writeFileSync(filePath, '');
        const exchanges = await (0, parser_1.parseConversationFile)(filePath);
        (0, vitest_1.expect)(exchanges).toHaveLength(0);
    });
    (0, vitest_1.it)('should handle multiple exchanges', async () => {
        const filePath = path.join(tmpDir, 'multi.jsonl');
        const lines = [
            JSON.stringify({ type: 'user', message: { content: 'First question' } }),
            JSON.stringify({ type: 'assistant', message: { content: 'First answer' } }),
            JSON.stringify({ type: 'user', message: { content: 'Second question' } }),
            JSON.stringify({ type: 'assistant', message: { content: 'Second answer' } }),
        ];
        fs.writeFileSync(filePath, lines.join('\n'));
        const exchanges = await (0, parser_1.parseConversationFile)(filePath);
        (0, vitest_1.expect)(exchanges).toHaveLength(2);
        (0, vitest_1.expect)(exchanges[0].userMessage).toBe('First question');
        (0, vitest_1.expect)(exchanges[1].userMessage).toBe('Second question');
    });
});
(0, vitest_1.describe)('findConversationFiles', () => {
    let tmpDir;
    (0, vitest_1.beforeEach)(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-find-test-'));
    });
    (0, vitest_1.afterEach)(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    (0, vitest_1.it)('should find JSONL files in directory', () => {
        // Create test structure
        const projectDir = path.join(tmpDir, 'project1');
        fs.mkdirSync(projectDir, { recursive: true });
        fs.writeFileSync(path.join(projectDir, 'conv1.jsonl'), '{}');
        fs.writeFileSync(path.join(projectDir, 'conv2.jsonl'), '{}');
        fs.writeFileSync(path.join(projectDir, 'readme.md'), '# Readme');
        const files = (0, parser_1.findConversationFiles)(tmpDir);
        (0, vitest_1.expect)(files).toHaveLength(2);
        (0, vitest_1.expect)(files.every((f) => f.path.endsWith('.jsonl'))).toBe(true);
    });
    (0, vitest_1.it)('should track project paths', () => {
        const projectDir = path.join(tmpDir, 'myproject');
        fs.mkdirSync(projectDir, { recursive: true });
        fs.writeFileSync(path.join(projectDir, 'conv.jsonl'), '{}');
        const files = (0, parser_1.findConversationFiles)(tmpDir);
        (0, vitest_1.expect)(files).toHaveLength(1);
        (0, vitest_1.expect)(files[0].projectPath).toBe(projectDir);
    });
    (0, vitest_1.it)('should handle nested directories', () => {
        const nestedDir = path.join(tmpDir, 'a', 'b', 'c');
        fs.mkdirSync(nestedDir, { recursive: true });
        fs.writeFileSync(path.join(nestedDir, 'deep.jsonl'), '{}');
        const files = (0, parser_1.findConversationFiles)(tmpDir);
        (0, vitest_1.expect)(files).toHaveLength(1);
        (0, vitest_1.expect)(files[0].path).toContain('deep.jsonl');
    });
    (0, vitest_1.it)('should return empty array for non-existent directory', () => {
        const files = (0, parser_1.findConversationFiles)('/nonexistent/path');
        (0, vitest_1.expect)(files).toHaveLength(0);
    });
    (0, vitest_1.it)('should return empty array for empty directory', () => {
        const files = (0, parser_1.findConversationFiles)(tmpDir);
        (0, vitest_1.expect)(files).toHaveLength(0);
    });
});
//# sourceMappingURL=parser.test.js.map