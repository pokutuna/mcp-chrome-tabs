import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export type McpServerOptions = {
    applicationName: string;
    ignoreHosts: string[];
    checkInterval: number;
};
export declare function createMcpServer(options: McpServerOptions): Promise<McpServer>;
