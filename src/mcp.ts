import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as chrome from "./chrome.js";
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

function formatTabRef(tab: chrome.ChromeTab): string {
  return `ID:${tab.windowId}:${tab.tabId}`;
}

function parseTabRef(tabRef: string): chrome.TabRef | null {
  const match = tabRef.match(/ID:(\d+):(\d+)$/);
  if (!match) return null;
  const windowId = match[1];
  const tabId = match[2];
  return { windowId, tabId };
}

async function packageVersion(): Promise<string> {
  const packageJsonText = await readFile(
    join(dirname(fileURLToPath(import.meta.url)), "../package.json"),
    "utf8"
  );
  const packageJson = JSON.parse(packageJsonText);
  return packageJson.version;
}

export async function createMcpServer(): Promise<McpServer> {
  const server = new McpServer(
    {
      name: "chrome-tabs",
      version: await packageVersion(),
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
        `- ${formatTabRef(t)} [${t.title}](${t.url})`;
      const list = tabs.map(formatter).join("\n");
      const header = `### Current Tabs (${tabs.length} tabs exists)\n`;
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
    "chrome_read_tab_content",
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
      const tabRef = tabId ? parseTabRef(tabId) : null;
      const page = await chrome.getPageContent(tabRef);
      const content = `---\n${page.title}\n---\n\n${page.content}`;
      return {
        content: [
          {
            type: "text",
            text: content,
          },
        ],
      };
    }
  );

  server.registerTool(
    "chrome_open_url",
    {
      description: "Open a URL in user's Chrome browser",
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
            text: `Successfully opened the URL`,
          },
        ],
      };
    }
  );

  return server;
}
