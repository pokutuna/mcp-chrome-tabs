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

function showHelp(): void {
  console.log(
    `
MCP Chrome Tabs Server

USAGE:
  mcp-chrome-tabs [OPTIONS]
  mcp-chrome-tabs list [--include-url] [OPTIONS]
  mcp-chrome-tabs read [ID | -n <index>] [--start-index=<chars>] [OPTIONS]

COMMANDS:
  list                        List open tabs as: [INDEX] ID TITLE DOMAIN
                              INDEX numbers this listing only and shifts when
                              windows are reordered or tabs change; pass the ID
                              to refer to a tab reliably.
  read [ID]                   Read the main content of a tab
                              (default: active tab)
                              Takes an ID from list, or -n <index>.

COMMAND OPTIONS:
  --include-url               Show the full URL instead of the domain
                              in list output

  -n, --index=<index>         Read the tab at this INDEX from list
                              Resolved against the tab list at the time
                              read runs, so it can shift; prefer the ID
                              when it matters.

  --start-index=<chars>       Start reading content at this character index
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
    console.log(
      await executeListTabsForCli(cli.server, cli.command.includeUrl)
    );
    return;
  }

  if (cli.command.name === "read") {
    const { id, index, startIndex } = cli.command;
    console.log(
      index !== undefined
        ? await executeReadTabContentByIndex(cli.server, index, startIndex)
        : await executeReadTabContent(cli.server, id, startIndex)
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
