import { parseArgs } from "util";
import type { Browser } from "./browser/browser.js";
import type { McpServerOptions } from "./mcp.js";

export type CliCommand =
  | { name: "serve" }
  | { name: "list"; includeUrl: boolean }
  | { name: "read"; id?: string; index?: number; offset: number };

export type CliOptions = {
  server: McpServerOptions;
  command: CliCommand;
  help: boolean;
  version: boolean;
};

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

const browserOptions = ["application-name", "experimental-browser"];

// Options that take effect for each command; anything else passed alongside
// the command is rejected rather than silently ignored
const commandOptions: Record<CliCommand["name"], string[]> = {
  serve: [
    ...browserOptions,
    "max-content-chars",
    "extraction-timeout",
    "exclude-hosts",
    "check-interval",
  ],
  list: [...browserOptions, "exclude-hosts", "include-url"],
  read: [
    ...browserOptions,
    "max-content-chars",
    "extraction-timeout",
    "exclude-hosts",
    "index",
    "offset",
  ],
};

function assertOptionsApply(
  command: CliCommand["name"],
  passed: Set<string>
): void {
  for (const name of passed) {
    if (commandOptions[command].includes(name)) continue;
    const target =
      command === "serve" ? "the MCP server" : `the ${command} command`;
    throw new Error(`Option --${name} does not apply to ${target}.`);
  }
}

export function parseCliArgs(args: string[]): CliOptions {
  const { values, positionals, tokens } = parseArgs({
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
      "include-url": {
        type: "boolean",
        default: false,
      },
      offset: {
        type: "string",
        default: "0",
      },
      index: {
        type: "string",
        short: "n",
      },
      help: {
        type: "boolean",
        short: "h",
        default: false,
      },
      version: {
        type: "boolean",
        short: "v",
        default: false,
      },
    },
    allowPositionals: true,
    strict: true,
    tokens: true,
  });

  const server: McpServerOptions = {
    applicationName: values["application-name"],
    browser: parseBrowserOption(values["experimental-browser"]),
    excludeHosts: values["exclude-hosts"]
      .split(",")
      .map((domain) => domain.trim())
      .filter(Boolean),
    checkInterval: parseIntWithDefault(values["check-interval"], 0, 0),
    maxContentChars: parseIntWithDefault(values["max-content-chars"], 20000, 1),
    extractionTimeout: parseIntWithDefault(
      values["extraction-timeout"],
      20000,
      1000
    ),
  };

  const [commandName, ...commandArgs] = positionals;
  let command: CliCommand;
  if (commandName === undefined) {
    command = { name: "serve" };
  } else if (commandName === "list") {
    if (commandArgs.length > 0) {
      throw new Error("The list command does not accept positional arguments.");
    }
    command = { name: "list", includeUrl: values["include-url"] };
  } else if (commandName === "read") {
    if (commandArgs.length > 1) {
      throw new Error("The read command accepts at most one tab ID.");
    }
    const indexValue = values.index;
    let index: number | undefined;
    if (indexValue !== undefined) {
      if (commandArgs[0] !== undefined) {
        throw new Error("Pass either a tab ID or --index, not both.");
      }
      index = Number(indexValue);
      if (!Number.isInteger(index) || index < 1) {
        throw new Error(
          `Invalid --index option: "${indexValue}". Expected a positive integer.`
        );
      }
    }
    command = {
      name: "read",
      id: commandArgs[0],
      index,
      offset: parseIntWithDefault(values.offset, 0, 0),
    };
  } else {
    throw new Error(`Unknown command: ${commandName}`);
  }

  if (!values.help && !values.version) {
    const passed = new Set(
      tokens.flatMap((t) => (t.kind === "option" ? [t.name] : []))
    );
    assertOptionsApply(command.name, passed);
  }

  return {
    server,
    command,
    help: values.help,
    version: values.version,
  };
}
