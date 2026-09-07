#!/usr/bin/env node

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  createMcpServer,
  executeListTabs,
  executeReadTabContent,
  packageVersion,
} from "./mcp.js";
import { parseCliArgs } from "./cli-options.js";
import { parseTabRef } from "./view.js";

function showHelp(): void {
  console.log(
    `
MCP Chrome Tabs Server

USAGE:
  mcp-chrome-tabs [OPTIONS]
  mcp-chrome-tabs list [--include-url] [OPTIONS]
  mcp-chrome-tabs get [ID] [--start-index=<index>] [OPTIONS]

COMMANDS:
  list                        List open tabs
  get [ID]                    Get readable content from a tab
                              (default: active tab)

COMMAND OPTIONS:
  --include-url               Include full URLs in list output

  --start-index=<index>       Start reading content at this character index
                              (default: 0)

CONTENT EXTRACTION OPTIONS:
  --max-content-chars=<chars> Maximum content characters per single read
                              (default: 20000)

  --extraction-timeout=<ms>   Timeout for content extraction worker in milliseconds
                              (default: 20000)
                              Example: 5000

  --exclude-hosts=<hosts>     Comma-separated list of hosts to exclude
                              (default: "")
                              Example: "github.com,example.com,test.com"

RESOURCE OPTIONS:
  --check-interval=<ms>       Interval for checking browser tabs in milliseconds
                              and sending listChanged notifications
                              (default: 0 disabled, set to 3000 for 3 seconds)
                              Example: 3000

BROWSER OPTIONS:
  --application-name=<name>   Application name to control via AppleScript
                              (default: "Google Chrome")
                              Example: "Google Chrome Canary"

  --experimental-browser=<b>  Browser implementation to use
                              (default: "chrome")
                              Options: "chrome", "safari", "arc"

OTHER OPTIONS:
  -h, --help                  Show this help message
  -v, --version               Show version number


REQUIREMENTS:
  Chrome:
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
`.trimStart()
  );
}

async function main(): Promise<void> {
  const cli = parseCliArgs(process.argv.slice(2));
  if (cli.version) {
    console.log(await packageVersion());
    return;
  }
  if (cli.help) {
    showHelp();
    return;
  }

  if (cli.command.name === "list") {
    console.log(await executeListTabs(cli.server, cli.command.includeUrl));
    return;
  }

  if (cli.command.name === "get") {
    const tabRef = cli.command.id ? parseTabRef(cli.command.id) : null;
    if (cli.command.id && !tabRef) {
      throw new Error(
        `Invalid tab ID: "${cli.command.id}". Expected ID:<windowId>:<tabId>.`
      );
    }
    console.log(
      await executeReadTabContent(
        cli.server,
        cli.command.id,
        cli.command.startIndex
      )
    );
    return;
  }

  // serveStdio picks the protocol era from the opening exchange, so the same
  // factory serves both 2025-era and 2026-07-28 clients
  const handle = serveStdio(() => createMcpServer(cli.server));

  const shutdown = async () => {
    await handle.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // StdioServerTransport only watches stdin "data" and "error", so EOF never
  // reaches the server on its own
  process.stdin.on("end", shutdown);
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
