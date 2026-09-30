import { parseArgs } from "util";
import type { Browser } from "./browser/browser.js";
import type { McpServerOptions } from "./mcp.js";

export type CliCommand =
  | { name: "serve" }
  | { name: "list"; includeUrl: boolean }
  | { name: "read"; target: ReadTarget; offset: number };

// The read command never falls back to the active tab; reading it must be
// asked for with --active, since it is the tab the user is looking at now
export type ReadTarget =
  { by: "id"; id: string } | { by: "index"; index: number } | { by: "active" };

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

// A value that is not an integer is an error rather than the default, so a
// typo does not silently run with other limits
function parseInteger(name: string, value: string, minValue: number): number {
  const parsed = /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < minValue) {
    throw new Error(
      `Invalid --${name}: "${value}". Expected an integer of ${minValue} or more.`
    );
  }
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
    "active",
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

// A tab argument is an ID when it has the ID: prefix that list prints, and an
// INDEX when it is a bare number; IDs never take the bare-number form
function parseReadTarget(arg: string | undefined, active: boolean): ReadTarget {
  if (arg === undefined && !active) {
    throw new Error("Specify a tab: pass an ID, an INDEX, or --active.");
  }
  if (arg !== undefined && active) {
    throw new Error("Pass either a tab ID or INDEX, or --active, not both.");
  }
  if (arg === undefined) return { by: "active" };

  if (arg.startsWith("ID:")) return { by: "id", id: arg };
  if (/^\d+$/.test(arg) && Number(arg) >= 1) {
    return { by: "index", index: Number(arg) };
  }
  throw new Error(
    `Invalid tab: "${arg}". Pass an ID from list (ID:<windowId>:<tabId>) or an INDEX of 1 or more.`
  );
}

// Hosts excluded for every run, in addition to --exclude-hosts. Set it in the
// shell profile so that command line runs exclude the same hosts as the
// MCP client config.
export const excludeHostsEnv = "MCP_CHROME_TABS_EXCLUDE_HOSTS";

function parseHostList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((domain) => domain.trim())
    .filter(Boolean);
}

export function parseCliArgs(
  args: string[],
  env: NodeJS.ProcessEnv = process.env
): CliOptions {
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
      active: {
        type: "boolean",
        default: false,
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
    excludeHosts: [
      ...new Set([
        ...parseHostList(env[excludeHostsEnv]),
        ...parseHostList(values["exclude-hosts"]),
      ]),
    ],
    checkInterval: parseInteger("check-interval", values["check-interval"], 0),
    maxContentChars: parseInteger(
      "max-content-chars",
      values["max-content-chars"],
      1
    ),
    extractionTimeout: parseInteger(
      "extraction-timeout",
      values["extraction-timeout"],
      1
    ),
  };

  // Help and version need no valid command line beyond themselves
  if (values.help || values.version) {
    return {
      server,
      command: { name: "serve" },
      help: values.help,
      version: values.version,
    };
  }

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
      throw new Error("The read command accepts at most one tab.");
    }
    command = {
      name: "read",
      target: parseReadTarget(commandArgs[0], values.active),
      offset: parseInteger("offset", values.offset, 0),
    };
  } else {
    throw new Error(`Unknown command: ${commandName}`);
  }

  const passed = new Set(
    tokens.flatMap((t) => (t.kind === "option" ? [t.name] : []))
  );
  assertOptionsApply(command.name, passed);

  return {
    server,
    command,
    help: values.help,
    version: values.version,
  };
}
