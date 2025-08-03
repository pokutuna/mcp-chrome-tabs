#!/usr/bin/env node

import { parseArgs } from "util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer, McpServerOptions } from "./mcp.js";
import type { Browser } from "./browser/browser.js";

type CliOptions = McpServerOptions & {
  help: boolean;
};

function showHelp(): void {
  console.log(
    `
MCP Chrome Tabs Server

USAGE:
  mcp-chrome-tabs [OPTIONS]

OPTIONS:
  --application-name=<name>   Application name to control via AppleScript
                              (default: "Google Chrome")
                              Example: "Google Chrome Canary"

  --exclude-hosts=<hosts>     Comma-separated list of hosts to exclude
                              (default: "")
                              Example: "github.com,example.com,test.com"

  --check-interval=<ms>       Interval for checking browser tabs in milliseconds
                              (default: 3000, set to 0 to disable)
                              Example: 1000

  --experimental-browser=<b>  Browser implementation to use
                              (default: "chrome")
                              Options: "chrome", "safari"

  --max-content-chars=<chars> Maximum content characters per single read
                              (default: 20000)

  --help                      Show this help message


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

function parseCliArgs(args: string[]): CliOptions {
  const { values } = parseArgs({
    args,
    options: {
      "application-name": {
        type: "string",
        default: "Google Chrome",
      },
      "exclude-hosts": {
        type: "string",
        default: "",
      },
      "check-interval": {
        type: "string",
        default: "3000",
      },
      "experimental-browser": {
        type: "string",
        default: "",
      },
      "max-content-chars": {
        type: "string",
        default: "20000",
      },
      help: {
        type: "boolean",
        default: false,
      },
    },
    allowPositionals: false,
    tokens: true,
  });

  function parseBrowserOption(browser: string): Browser {
    if (browser === "" || browser === "chrome") return "chrome";
    if (browser === "safari") return "safari";
    throw new Error(
      `Invalid --experimental-browser option: "${browser}". Use "chrome" or "safari".`
    );
  }

  function parseIntWithDefault(
    value: string,
    defaultValue: number,
    minValue: number = 0
  ): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < minValue) return defaultValue;
    return parsed;
  }

  const parsed: CliOptions = {
    applicationName: values["application-name"],
    browser: parseBrowserOption(values["experimental-browser"]),
    excludeHosts: values["exclude-hosts"]
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean),
    checkInterval: parseIntWithDefault(values["check-interval"], 3000, 0),
    maxContentChars: parseIntWithDefault(values["max-content-chars"], 20000, 1),
    help: values.help,
  };
  return parsed;
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    showHelp();
    process.exit(0);
  }
  const server = await createMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async () => {
    await transport.close();
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

await main().catch(console.error);
