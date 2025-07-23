#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp.js";

const server = await createMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
