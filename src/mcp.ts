import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as chrome from "./chrome.js";
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import * as view from "./view.js";

export type McpServerOptions = {
  applicationName: string;
  ignoreHosts: string[];
  checkInterval: number;
};

function isIgnoredHost(url: string, ignoreHosts: string[]): boolean {
  const u = new URL(url);
  return ignoreHosts.some(
    (d) => u.hostname === d || u.hostname.endsWith("." + d)
  );
}

async function listTabs(opts: McpServerOptions): Promise<chrome.Tab[]> {
  const tabs = await chrome.getChromeTabList(opts.applicationName);
  return tabs.filter((t) => !isIgnoredHost(t.url, opts.ignoreHosts));
}

async function getTab(
  tabRef: chrome.TabRef | null,
  opts: McpServerOptions
): Promise<chrome.TabContent> {
  const content = await chrome.getPageContent(opts.applicationName, tabRef);
  if (isIgnoredHost(content.url, opts.ignoreHosts)) {
    throw new Error("Content not available for ignored domain");
  }
  return content;
}

async function packageVersion(): Promise<string> {
  const packageJsonText = await readFile(
    join(dirname(fileURLToPath(import.meta.url)), "../package.json"),
    "utf8"
  );
  const packageJson = JSON.parse(packageJsonText);
  return packageJson.version;
}

function hashTabList(tabs: chrome.Tab[]): string {
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
      description: "List all open Chrome tabs",
      inputSchema: {},
    },
    async () => {
      const tabs = await listTabs(options);
      return {
        content: [
          {
            type: "text",
            text: view.formatList(tabs),
          },
        ],
      };
    }
  );

  server.registerTool(
    "read_tab_content",
    {
      description:
        "Get readable content from a Chrome tab. If tabId is omitted, uses the currently active tab.",
      inputSchema: {
        tabId: z
          .string()
          .optional()
          .describe(
            "Tab ID in the format `ID:{windowId}:{tabId}`. If omitted, uses the currently active tab."
          ),
      },
    },
    async (args) => {
      const { tabId } = args;
      const tab = await getTab(tabId ? view.parseTabRef(tabId) : null, options);
      return {
        content: [
          {
            type: "text",
            text: view.formatTabContent(tab),
          },
        ],
      };
    }
  );

  server.registerTool(
    "open_in_new_tab",
    {
      description: "Open a URL in user's browser",
      inputSchema: {
        url: z.string().url().describe("URL to open in Chrome"),
      },
    },
    async (args) => {
      const { url } = args;
      await chrome.openURL(options.applicationName, url);
      return {
        content: [
          {
            type: "text",
            text: `Successfully opened the URL`,
          },
        ],
      };
    }
  );

  server.registerResource(
    "current_tab",
    "tab://current",
    {
      title: "Current Tab",
      description: "Content of the currently active Chrome tab",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const tab = await getTab(null, options);
      const text = view.formatTabContent(tab);
      return {
        contents: [
          {
            uri: uri.href,
            name: tab.title,
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
            name: tab.title,
            mimeType: "text/markdown",
          })),
        };
      },
    }),
    {
      title: "Chrome Tab Content",
      description: "Content of a specific Chrome tab",
      mimeType: "text/markdown",
    },
    async (uri, { windowId, tabId }) => {
      const tabRef: chrome.TabRef = {
        windowId: String(windowId),
        tabId: String(tabId),
      };
      const tab = await getTab(tabRef, options);
      const text = view.formatTabContent(tab);
      return {
        contents: [
          {
            uri: uri.href,
            name: tab.title,
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
