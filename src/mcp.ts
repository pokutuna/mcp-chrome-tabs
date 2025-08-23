import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  Browser,
  Tab,
  TabRef,
  TabContent,
  getInterface,
} from "./browser/browser.js";
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import * as view from "./view.js";
import { Defuddle } from "defuddle/node";
import { withMockConsole } from "./util.js";

export type McpServerOptions = {
  applicationName: string;
  excludeHosts: string[];
  checkInterval: number;
  browser: Browser;
  maxContentChars: number;
};

function isExcludedHost(url: string, excludeHosts: string[]): boolean {
  const u = new URL(url);
  return excludeHosts.some(
    (d) => u.hostname === d || u.hostname.endsWith("." + d)
  );
}

async function listTabs(opts: McpServerOptions): Promise<Tab[]> {
  const browser = getInterface(opts.browser);
  const tabs = await browser.getTabList(opts.applicationName);
  return tabs.filter((t) => !isExcludedHost(t.url, opts.excludeHosts));
}

async function getTab(
  tabRef: TabRef | null,
  opts: McpServerOptions
): Promise<TabContent> {
  const browser = getInterface(opts.browser);
  const raw = await browser.getPageContent(opts.applicationName, tabRef);
  if (isExcludedHost(raw.url, opts.excludeHosts)) {
    throw new Error("Content not available for excluded host");
  }
  const { result } = await withMockConsole(() =>
    Defuddle(raw.content, raw.url, {
      markdown: true,
    })
  );
  if (!result?.content) {
    throw new Error("Failed to parse the page content");
  }
  return {
    title: raw.title,
    url: raw.url,
    content: result.content,
  };
}

async function packageVersion(): Promise<string> {
  const packageJsonText = await readFile(
    join(dirname(fileURLToPath(import.meta.url)), "../package.json"),
    "utf8"
  );
  const packageJson = JSON.parse(packageJsonText);
  return packageJson.version;
}

function hashTabList(tabs: Tab[]): string {
  const sortedTabs = tabs.slice().sort((a, b) => {
    if (a.windowId !== b.windowId) return a.windowId < b.windowId ? -1 : 1;
    if (a.tabId !== b.tabId) return a.tabId < b.tabId ? -1 : 1;
    return 0;
  });
  const dump = sortedTabs
    .map((tab) => `${tab.windowId}:${tab.tabId}:${tab.title}:${tab.url}`)
    .join("|");
  return createHash("sha256").update(dump, "utf8").digest("hex");
}

export async function createMcpServer(
  options: McpServerOptions
): Promise<McpServer> {
  const server = new McpServer(
    {
      name: "chrome-tabs",
      version: await packageVersion(),
    },
    {
      instructions: "Use this server to access the user's open browser tabs.",
      capabilities: {
        resources: {
          listChanged: true,
        },
      },
      debouncedNotificationMethods: ["notifications/resources/list_changed"],
    }
  );

  server.registerTool(
    "list_tabs",
    {
      description:
        "List all open tabs in the user's browser with their titles and tab references.",
      inputSchema: {
        includeUrl: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "Include URLs in the output. Enable only when you need to reference specific URLs. (default: false, hostnames always included)"
          ),
      },
    },
    async (args) => {
      const { includeUrl } = args;
      const tabs = await listTabs(options);
      return {
        content: [
          {
            type: "text",
            text: view.formatList(tabs, includeUrl),
          },
        ],
      };
    }
  );

  server.registerTool(
    "read_tab_content",
    {
      description:
        "Get readable content from a tab in the user's browser. Provide ID (from list_tabs output) to read a specific tab, or omit for the active tab.",
      inputSchema: {
        id: z
          .string()
          .optional()
          .describe(
            "Tab reference from list_tabs output (e.g: ID:12345:67890). If omitted, uses the currently active tab."
          ),
        startIndex: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .default(0)
          .describe(
            "Starting character position for content extraction (default: 0)"
          ),
      },
    },
    async (args) => {
      const { id, startIndex } = args;
      const tab = await getTab(id ? view.parseTabRef(id) : null, options);
      return {
        content: [
          {
            type: "text",
            text: view.formatTabContent(
              tab,
              startIndex,
              options.maxContentChars
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "open_in_new_tab",
    {
      description:
        "Open a URL in a new tab to present content or enable user interaction with webpages",
      inputSchema: {
        url: z.string().url().describe("URL to open in the browser"),
      },
    },
    async (args) => {
      const { url } = args;
      const browser = getInterface(options.browser);
      const tabRef = await browser.openURL(options.applicationName, url);
      const tabId = `ID:${tabRef.windowId}:${tabRef.tabId}`;
      return {
        content: [
          {
            type: "text",
            text: `Successfully opened URL in new tab. Tab: \`${tabId}\``,
          },
        ],
      };
    }
  );

  server.registerResource(
    "current_tab",
    "tab://current",
    {
      title: "Active Browser Tab",
      description: "Content of the currently active tab in the user's browser",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const tab = await getTab(null, options);
      // TODO: Add pagination support for resources (startIndex parameter)
      const text = view.formatTabContent(tab, 0, undefined);
      return {
        contents: [
          {
            uri: uri.href,
            name: view.formatTabName(tab),
            text,
            mimeType: "text/markdown",
            size: new Blob([text]).size,
          },
        ],
      };
    }
  );

  server.registerResource(
    "tabs",
    new ResourceTemplate(view.uriTemplate, {
      list: async () => {
        const tabs = await listTabs(options);
        return {
          resources: tabs.map((tab) => ({
            uri: view.formatUri(tab),
            name: view.formatTabName(tab),
            mimeType: "text/markdown",
          })),
        };
      },
    }),
    {
      title: "Browser Tabs",
      description: "Content of a specific tab in the user's browser",
      mimeType: "text/markdown",
    },
    async (uri, { windowId, tabId }) => {
      const tabRef: TabRef = {
        windowId: String(windowId),
        tabId: String(tabId),
      };
      const tab = await getTab(tabRef, options);
      // TODO: Add pagination support for resources (startIndex parameter)
      const text = view.formatTabContent(tab, 0, undefined);
      return {
        contents: [
          {
            uri: uri.href,
            name: view.formatTabName(tab),
            mimeType: "text/markdown",
            text,
            size: new Blob([text]).size,
          },
        ],
      };
    }
  );

  if (options.checkInterval > 0) {
    let lastHash: string = hashTabList(await listTabs(options));
    const check = async () => {
      try {
        const hash = hashTabList(await listTabs(options));
        if (hash !== lastHash) {
          server.sendResourceListChanged();
          lastHash = hash;
        }
      } catch (error) {
        console.error("Error during periodic tab list update:", error);
      }
      // Use setTimeout instead of setInterval to avoid overlapping calls
      setTimeout(check, options.checkInterval);
    };
    check();
  }

  return server;
}
