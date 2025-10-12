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
      "max-content-chars": {
        type: "string",
        default: "20000",
      },
      "extraction-timeout": {
        type: "string",
        default: "20000",
      },
      "check-interval": {
        type: "string",
        default: "0",
      },
      "exclude-hosts": {
        type: "string",
        default: "",
      },
      "application-name": {
        type: "string",
        default: "Google Chrome",
      },
      "experimental-browser": {
        type: "string",
        default: "",
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
    if (browser === "arc") return "arc";
    throw new Error(
      `Invalid --experimental-browser option: "${browser}". Use "chrome", "safari", or "arc".`
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
    checkInterval: parseIntWithDefault(values["check-interval"], 0, 0),
    maxContentChars: parseIntWithDefault(values["max-content-chars"], 20000, 1),
    extractionTimeout: parseIntWithDefault(
      values["extraction-timeout"],
      20000,
      1000
    ),
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
