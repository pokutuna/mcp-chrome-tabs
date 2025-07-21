import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as chrome from "./chrome.js";

function toTabId(tab: chrome.ChromeTab): string {
  return `id:${tab.windowIndex}:${tab.tabIndex}`;
}

function parseTabId(tabId: string): chrome.TabRef | null {
  const match = tabId.match(/^id:(\d+):(\d+)$/);
  if (!match) return null;
  const windowIndex = parseInt(match[1], 10);
  const tabIndex = parseInt(match[2], 10);
  return { windowIndex, tabIndex };
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "chrome-tabs",
      version: "0.1.0",
    }
    /* TODO: {
      capabilities: { resources: {} },
      debouncedNotificationMethods: ["notifications/resources/list_changed"],
    }*/
  );

  server.registerTool(
    "chrome_list_tabs",
    {
      description: "List all open Chrome tabs",
      inputSchema: {},
    },
    async () => {
      const tabs = await chrome.getChromeTabList();
      const formatter = (t: chrome.ChromeTab) =>
        `- ${toTabId(t)}: [${t.title}](${t.url})`;
      const list = tabs.map(formatter).join("\n");
      const header = `### Open Chrome Tabs\n\n${tabs.length} tabs found:\n`;
      return {
        content: [
          {
            type: "text",
            text: header + list,
          },
        ],
      };
    }
  );

  server.registerTool(
    "chrome_get_page_content",
    {
      description:
        "Get readable content from a Chrome tab. If tabId is omitted, uses the currently active tab.",
      inputSchema: {
        tabId: z
          .string()
          .optional()
          .describe(
            "Tab ID in the format `id:{windowIndex}:{tabIndex}`. If omitted, uses the currently active tab."
          ),
      },
    },
    async (args) => {
      const { tabId } = args;
      const tabRef = tabId ? parseTabId(tabId) : null;
      const pageContent = await chrome.getPageContent(tabRef);
      return {
        content: [
          {
            type: "text",
            text: pageContent.content,
          },
        ],
      };
    }
  );

  server.registerTool(
    "chrome_open_url",
    {
      description: "Open a URL in Chrome",
      inputSchema: {
        url: z.string().url().describe("URL to open in Chrome"),
      },
    },
    async (args) => {
      const { url } = args;
      await chrome.openURL(url);

      return {
        content: [
          {
            type: "text",
            text: `Successfully opened URL: ${url}`,
          },
        ],
      };
    }
  );

  return server;
}
