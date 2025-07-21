#!/usr/bin/env node
import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createMcpServer } from "./mcp.js";
const app = new Hono();
app.post("/mcp", async (c) => {
    const mcpServer = createMcpServer();
    const transport = new StreamableHTTPTransport();
    await mcpServer.connect(transport);
    return transport.handleRequest(c);
});
serve({ fetch: app.fetch, port: parseInt(process.env.PORT || "9606", 10) });
