/**
 * Shipyard Memory - MCP Server
 *
 * Exposes memory search and management tools via the Model Context Protocol.
 */
export declare const TOOLS: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                oneOf: ({
                    type: string;
                    description: string;
                    items?: undefined;
                    minItems?: undefined;
                    maxItems?: undefined;
                } | {
                    type: string;
                    items: {
                        type: string;
                    };
                    minItems: number;
                    maxItems: number;
                    description: string;
                })[];
            };
            limit: {
                type: string;
                minimum: number;
                maximum: number;
                default: number;
                description: string;
            };
            after: {
                type: string;
                description: string;
            };
            before: {
                type: string;
                description: string;
            };
            project: {
                type: string;
                description: string;
            };
            format: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            session_id?: undefined;
            force?: undefined;
            dry_run?: undefined;
            output_path?: undefined;
        };
        required: never[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            session_id: {
                type: string;
                description: string;
            };
            after: {
                type: string;
                description: string;
            };
            before: {
                type: string;
                description: string;
            };
            query?: undefined;
            limit?: undefined;
            project?: undefined;
            format?: undefined;
            force?: undefined;
            dry_run?: undefined;
            output_path?: undefined;
        };
        required: never[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query?: undefined;
            limit?: undefined;
            after?: undefined;
            before?: undefined;
            project?: undefined;
            format?: undefined;
            session_id?: undefined;
            force?: undefined;
            dry_run?: undefined;
            output_path?: undefined;
        };
        required: never[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            force: {
                type: string;
                default: boolean;
                description: string;
            };
            query?: undefined;
            limit?: undefined;
            after?: undefined;
            before?: undefined;
            project?: undefined;
            format?: undefined;
            session_id?: undefined;
            dry_run?: undefined;
            output_path?: undefined;
        };
        required: never[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            dry_run: {
                type: string;
                default: boolean;
                description: string;
            };
            query?: undefined;
            limit?: undefined;
            after?: undefined;
            before?: undefined;
            project?: undefined;
            format?: undefined;
            session_id?: undefined;
            force?: undefined;
            output_path?: undefined;
        };
        required: never[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            output_path: {
                type: string;
                description: string;
            };
            query?: undefined;
            limit?: undefined;
            after?: undefined;
            before?: undefined;
            project?: undefined;
            format?: undefined;
            session_id?: undefined;
            force?: undefined;
            dry_run?: undefined;
        };
        required: never[];
    };
})[];
/**
 * Handle memory_health tool call
 */
export declare function handleHealth(): string;
/**
 * Create and start the MCP server
 */
export declare function startServer(): Promise<void>;
//# sourceMappingURL=mcp-server.d.ts.map