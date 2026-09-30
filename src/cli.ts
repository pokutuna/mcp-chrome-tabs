#!/usr/bin/env node

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  createMcpServer,
  executeListTabsForCli,
  executeReadTabContent,
  executeReadTabContentByIndex,
  packageVersion,
} from "./mcp.js";
import { parseCliArgs } from "./cli-options.js";
import { cliPagination } from "./view.js";

function showHelp(): void {
  console.log(
    `
mcp-chrome-tabs - Read browser tabs on macOS, as an MCP server or from the CLI

USAGE:
  mcp-chrome-tabs [OPTIONS]                         Start the MCP server (stdio)
  mcp-chrome-tabs list [OPTIONS]                    List open tabs
  mcp-chrome-tabs read <ID | -n <index> | --active> [OPTIONS]
                                                    Read the main content of a tab

EXAMPLES:
  mcp-chrome-tabs list                              Prints: [INDEX] ID TITLE DOMAIN
  mcp-chrome-tabs read --active                     Read the active tab
  mcp-chrome-tabs read ID:12345:67890               Read the tab with this ID
  mcp-chrome-tabs read -n 2                         Read the tab at INDEX 2
  mcp-chrome-tabs read -n 2 --offset=20000          Continue a truncated read

  INDEX numbers one listing only and shifts when windows are reordered or
  tabs change. Pass the ID to refer to a tab reliably.

LIST OPTIONS:
  --include-url               Show the full URL instead of the domain

READ OPTIONS:
  -n, --index=<index>         Read the tab at this INDEX from list
                              Resolved when read runs, so it can shift
  --active                    Read the tab you are looking at now
  --offset=<chars>            Start reading at this character offset
                              (default: 0)

CONTENT OPTIONS (read and MCP server):
  --max-content-chars=<chars> Maximum content characters per single read
                              (default: 20000)
  --extraction-timeout=<ms>   Timeout for content extraction in milliseconds
                              (default: 20000)

MCP SERVER OPTIONS:
  --check-interval=<ms>       Interval for checking browser tabs and sending
                              listChanged notifications
                              (default: 0 disabled, set to 3000 for 3 seconds)

COMMON OPTIONS (all commands):
  --exclude-hosts=<hosts>     Comma-separated list of hosts to exclude
                              Example: "github.com,example.com"
  --application-name=<name>   Application name to control
                              (default: "Google Chrome")
                              Example: "Google Chrome Canary"
  --experimental-browser=<b>  Browser implementation to use
                              (default: "chrome")
                              Options: "chrome", "safari", "arc"
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
    console.log(
      await executeListTabsForCli(cli.server, cli.command.includeUrl)
    );
    return;
  }

  if (cli.command.name === "read") {
    const { target, offset } = cli.command;
    console.log(
      target.by === "index"
        ? await executeReadTabContentByIndex(
            cli.server,
            target.index,
            offset,
            cliPagination
          )
        : await executeReadTabContent(
            cli.server,
            target.by === "id" ? target.id : undefined,
            offset,
            cliPagination
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
