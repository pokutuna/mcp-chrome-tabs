import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp.js";
import type { ChromeTab, PageContent } from "../src/chrome.js";

// Mock chrome module
vi.mock("../src/chrome.js", () => ({
  getChromeTabList: vi.fn(),
  getPageContent: vi.fn(),
  openURL: vi.fn(),
}));

const mockTabs: ChromeTab[] = [
  {
    windowId: "1001",
    tabId: "2001",
    title: "Example Page",
    url: "https://example.com/page1",
  },
  {
    windowId: "1001",
    tabId: "2002",
    title: "GitHub",
    url: "https://github.com/user/repo",
  },
  {
    windowId: "1002",
    tabId: "2003",
    title: "Test Site",
    url: "https://test.com/page",
  },
];

const mockPageContent: PageContent = {
  title: "Example Page",
  url: "https://example.com/page1",
  content: "# Example\n\nThis is test content.",
};

describe("MCP Server", () => {
  let client: Client;
  let server: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create test client
    client = new Client({
      name: "test client",
      version: "0.1.0",
    });

    // Create server
    const options = {
      applicationName: "Google Chrome",
      ignoreDomains: [],
    };
    server = await createMcpServer(options);

    // Connect client and server via in-memory transport
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  describe("chrome_list_tabs tool", () => {
    it("should return all tabs when no domains are ignored", async () => {
      const { getChromeTabList } = await import("../src/chrome.js");
      vi.mocked(getChromeTabList).mockResolvedValue(mockTabs);

      const result = await client.callTool({
        name: "chrome_list_tabs",
        arguments: {},
      });

      expect(result.content).toHaveLength(1);
      const text = (result.content as any)[0].text;
      expect(text).toContain("### Current Tabs (3 tabs exists)");
      expect(text).toContain(
        "ID:1001:2001 [Example Page](https://example.com/page1)",
      );
      expect(text).toContain(
        "ID:1001:2002 [GitHub](https://github.com/user/repo)",
      );
      expect(text).toContain("ID:1002:2003 [Test Site](https://test.com/page)");
    });

    it("should filter out ignored domains", async () => {
      // Create server with ignored domains
      const options = {
        applicationName: "Google Chrome",
        ignoreDomains: ["github.com"],
      };
      const filteredServer = await createMcpServer(options);

      // Create new client for filtered server
      const filteredClient = new Client({
        name: "test client",
        version: "0.1.0",
      });

      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      await Promise.all([
        filteredClient.connect(clientTransport),
        filteredServer.connect(serverTransport),
      ]);

      const { getChromeTabList } = await import("../src/chrome.js");
      vi.mocked(getChromeTabList).mockResolvedValue(mockTabs);

      const result = await filteredClient.callTool({
        name: "chrome_list_tabs",
        arguments: {},
      });

      const text = (result.content as any)[0].text;
      expect(text).toContain("### Current Tabs (2 tabs exists)"); // github.com tab should be filtered out
      expect(text).not.toContain("github.com");
      expect(text).toContain("example.com");
      expect(text).toContain("test.com");
    });
  });

  describe("chrome_read_tab_content tool", () => {
    it("should get page content for valid tab", async () => {
      const { getPageContent, getChromeTabList } = await import(
        "../src/chrome.js"
      );
      vi.mocked(getChromeTabList).mockResolvedValue(mockTabs);
      vi.mocked(getPageContent).mockResolvedValue(mockPageContent);

      const result = await client.callTool({
        name: "chrome_read_tab_content",
        arguments: {
          tabId: "ID:1001:2001",
        },
      });

      expect(result.content).toHaveLength(1);
      const text = (result.content as any)[0].text;
      expect(text).toContain("---");
      expect(text).toContain(mockPageContent.title);
      expect(text).toContain(mockPageContent.content);
    });

    it("should get content from active tab when no tabId provided", async () => {
      const { getPageContent } = await import("../src/chrome.js");
      vi.mocked(getPageContent).mockResolvedValue(mockPageContent);

      const result = await client.callTool({
        name: "chrome_read_tab_content",
        arguments: {},
      });

      expect(result.content).toHaveLength(1);
      const text = (result.content as any)[0].text;
      expect(text).toContain("---");
      expect(text).toContain(mockPageContent.title);
      expect(text).toContain(mockPageContent.content);
    });

    it("should reject content from ignored domains", async () => {
      // Create server with ignored domains
      const options = {
        applicationName: "Google Chrome",
        ignoreDomains: ["example.com"],
      };
      const filteredServer = await createMcpServer(options);

      // Create new client for filtered server
      const filteredClient = new Client({
        name: "test client",
        version: "0.1.0",
      });

      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      await Promise.all([
        filteredClient.connect(clientTransport),
        filteredServer.connect(serverTransport),
      ]);

      const { getPageContent, getChromeTabList } = await import(
        "../src/chrome.js"
      );
      vi.mocked(getChromeTabList).mockResolvedValue(mockTabs);
      vi.mocked(getPageContent).mockResolvedValue(mockPageContent);

      const result = await filteredClient.callTool({
        name: "chrome_read_tab_content",
        arguments: {
          tabId: "ID:1001:2001",
        },
      });

      expect(result.isError).toBe(true);
      expect((result.content as any)[0].text).toContain(
        "Content not available for ignored domain",
      );
    });
  });

  describe("chrome_open_url tool", () => {
    it("should open URL with correct application name", async () => {
      const { openURL } = await import("../src/chrome.js");
      vi.mocked(openURL).mockResolvedValue();

      const result = await client.callTool({
        name: "chrome_open_url",
        arguments: {
          url: "https://example.com",
        },
      });

      expect(vi.mocked(openURL)).toHaveBeenCalledWith(
        "Google Chrome",
        "https://example.com",
      );
      expect(result.content).toHaveLength(1);
      expect((result.content as any)[0]).toEqual({
        type: "text",
        text: "Successfully opened the URL",
      });
    });
  });
});
