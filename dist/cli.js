#!/usr/bin/env node
import { parseArgs } from "util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp.js";
function showHelp() {
    console.log(`
MCP Chrome Tabs Server

USAGE:
  mcp-chrome-tabs [OPTIONS]

OPTIONS:
  --application-name <name>    Application name to control via AppleScript
                               (default: "Google Chrome")
                               Example: "Google Chrome Canary"

  --ignore-domains <domains>   Comma-separated list of domains to ignore
                               Example: "github.com,example.com,test.com"

  --help                       Show this help message

EXAMPLES:
  # Use default Chrome
  mcp-chrome-tabs

  # Use Chrome Canary
  mcp-chrome-tabs --application-name "Google Chrome Canary"

  # Ignore specific domains
  mcp-chrome-tabs --ignore-domains "github.com,example.com"

REQUIREMENTS:
  Chrome must allow JavaScript from Apple Events:
  1. Open Chrome
  2. Go to View > Developer > Allow JavaScript from Apple Events
  3. Enable the option

MCP CONFIGURATION EXAMPLE:
  {
    "mcpServers": {
      "chrome-tabs": {
        "command": "npx",
        "args": ["-y", "@pokutuna/mcp-chrome-tabs"]
      }
    }
  }
`);
}
function parseCliArgs() {
    const { values } = parseArgs({
        options: {
            "application-name": {
                type: "string",
                default: "Google Chrome",
            },
            "ignore-domains": {
                type: "string",
                default: "",
            },
            help: {
                type: "boolean",
                default: false,
            },
        },
        allowPositionals: false,
    });
    if (values.help) {
        showHelp();
        process.exit(0);
    }
    const ignoreDomainsStr = values["ignore-domains"];
    const ignoreDomains = ignoreDomainsStr
        ? ignoreDomainsStr
            .split(",")
            .map((domain) => domain.trim())
            .filter(Boolean)
        : [];
    return {
        applicationName: values["application-name"],
        ignoreDomains,
    };
}
const options = parseCliArgs();
const server = await createMcpServer(options);
const transport = new StdioServerTransport();
await server.connect(transport);
