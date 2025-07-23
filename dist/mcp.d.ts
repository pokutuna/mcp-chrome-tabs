import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
type McpServerOptions = {
    applicationName: string;
    ignoreDomains: string[];
};
export declare function createMcpServer(options: McpServerOptions): Promise<McpServer>;
export {};
