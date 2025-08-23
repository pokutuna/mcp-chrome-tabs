import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp.js";
import type {
  Tab,
  TabContent,
  BrowserInterface,
} from "../src/browser/browser.js";

// Mock the getInterface function from browser.js
const mockBrowserInterface: BrowserInterface = {
  getTabList: vi.fn(),
  getPageContent: vi.fn(),
  openURL: vi.fn(),
};

vi.mock("../src/browser/browser.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    getInterface: vi.fn(() => mockBrowserInterface),
  };
});

const mockTabs: Tab[] = [
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

const mockPageContent: TabContent = {
  title: "Example Page",
  url: "https://example.com/page1",
  content: `<!DOCTYPE html>
<html>
<head>
  <title>Example Page</title>
</head>
<body>
  <h1>Example</h1>
  <p>This is test content.</p>
</body>
</html>`,
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
      browser: "chrome" as const,
      excludeHosts: [],
      checkInterval: 0, // Disable periodic updates in tests
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

  describe("list_tabs tool", () => {
    it("should return all tabs when no domains are excluded", async () => {
      vi.mocked(mockBrowserInterface.getTabList).mockResolvedValue(mockTabs);

      const result = await client.callTool({
        name: "list_tabs",
        arguments: {},
      });

      expect(result.content).toHaveLength(1);
      const text = (result.content as any)[0].text;
      expect(text).toContain("### Current Tabs (3 tabs exists)");
      expect(text).toContain("ID:1001:2001 Example Page (example.com)");
      expect(text).toContain("ID:1001:2002 GitHub (github.com)");
      expect(text).toContain("ID:1002:2003 Test Site (test.com)");
    });

    it("should include full URLs when includeUrl is true", async () => {
      vi.mocked(mockBrowserInterface.getTabList).mockResolvedValue(mockTabs);

      const result = await client.callTool({
        name: "list_tabs",
        arguments: { includeUrl: true },
      });

      expect(result.content).toHaveLength(1);
      const text = (result.content as any)[0].text;
      expect(text).toContain("### Current Tabs (3 tabs exists)");
      expect(text).toContain(
        "ID:1001:2001 [Example Page](https://example.com/page1)"
      );
      expect(text).toContain(
        "ID:1001:2002 [GitHub](https://github.com/user/repo)"
      );
      expect(text).toContain("ID:1002:2003 [Test Site](https://test.com/page)");
    });

    it("should filter out excluded domains", async () => {
      // Create server with excluded domains
      const options = {
        applicationName: "Google Chrome",
        browser: "chrome" as const,
        excludeHosts: ["github.com"],
        checkInterval: 0, // Disable periodic updates in tests
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

      vi.mocked(mockBrowserInterface.getTabList).mockResolvedValue(mockTabs);

      const result = await filteredClient.callTool({
        name: "list_tabs",
        arguments: {},
      });

      const text = (result.content as any)[0].text;
      expect(text).toContain("### Current Tabs (2 tabs exists)"); // github.com tab should be filtered out
      expect(text).not.toContain("github.com");
      expect(text).toContain("example.com");
      expect(text).toContain("test.com");
    });
  });

  describe("read_tab_content tool", () => {
    it("should get page content for valid tab", async () => {
      vi.mocked(mockBrowserInterface.getTabList).mockResolvedValue(mockTabs);
      vi.mocked(mockBrowserInterface.getPageContent).mockResolvedValue(
        mockPageContent
      );

      const result = await client.callTool({
        name: "read_tab_content",
        arguments: {
          id: "ID:1001:2001",
        },
      });

      expect(result.content).toHaveLength(1);
      const text = (result.content as any)[0].text;
      expect(text).toContain("---");
      expect(text).toContain(mockPageContent.title);
      expect(text).toContain("## Example");
      expect(text).toContain("This is test content.");
    });

    it("should get content from active tab when no id provided", async () => {
      vi.mocked(mockBrowserInterface.getPageContent).mockResolvedValue(
        mockPageContent
      );

      const result = await client.callTool({
        name: "read_tab_content",
        arguments: {},
      });

      expect(result.content).toHaveLength(1);
      const text = (result.content as any)[0].text;
      expect(text).toContain("---");
      expect(text).toContain(mockPageContent.title);
      expect(text).toContain("## Example");
      expect(text).toContain("This is test content.");
    });

    it("should reject content from excluded domains", async () => {
      // Create server with excluded domains
      const options = {
        applicationName: "Google Chrome",
        browser: "chrome" as const,
        excludeHosts: ["example.com"],
        checkInterval: 0, // Disable periodic updates in tests
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

      vi.mocked(mockBrowserInterface.getTabList).mockResolvedValue(mockTabs);
      vi.mocked(mockBrowserInterface.getPageContent).mockResolvedValue(
        mockPageContent
      );

      const result = await filteredClient.callTool({
        name: "read_tab_content",
        arguments: {
          id: "ID:1001:2001",
        },
      });

      expect(result.isError).toBe(true);
      expect((result.content as any)[0].text).toContain(
        "Content not available for excluded host"
      );
    });
  });

  describe("open_in_new_tab tool", () => {
    it("should open URL with correct application name", async () => {
      vi.mocked(mockBrowserInterface.openURL).mockResolvedValue({
        windowId: "123",
        tabId: "456",
      });

      const result = await client.callTool({
        name: "open_in_new_tab",
        arguments: {
          url: "https://example.com",
        },
      });

      expect(vi.mocked(mockBrowserInterface.openURL)).toHaveBeenCalledWith(
        "Google Chrome",
        "https://example.com"
      );
      expect(result.content).toHaveLength(1);
      expect((result.content as any)[0]).toEqual({
        type: "text",
        text: "Successfully opened URL in new tab. Tab: `ID:123:456`",
      });
    });
  });

  describe("Resources", () => {
    describe("current_tab resource", () => {
      it("should return content of active tab", async () => {
        vi.mocked(mockBrowserInterface.getPageContent).mockResolvedValue(
          mockPageContent
        );

        const result = await client.readResource({
          uri: "tab://current",
        });

        expect(result.contents).toHaveLength(1);
        const content = result.contents[0];
        expect(content.uri).toBe("tab://current");
        expect(content.name).toBe(`${mockPageContent.title} (example.com)`);
        expect(content.mimeType).toBe("text/markdown");
        expect(content.text).toContain("---");
        expect(content.text).toContain("title: " + mockPageContent.title);
        expect(content.text).toContain("## Example");
        expect(content.text).toContain("This is test content.");
      });

      it("should reject content from excluded domains", async () => {
        // Create server with excluded domains
        const options = {
          applicationName: "Google Chrome",
          browser: "chrome" as const,
          excludeHosts: ["example.com"],
          checkInterval: 0,
        };
        const filteredServer = await createMcpServer(options);

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

        vi.mocked(mockBrowserInterface.getPageContent).mockResolvedValue(
          mockPageContent
        );

        await expect(
          filteredClient.readResource({
            uri: "tab://current",
          })
        ).rejects.toThrow("Content not available for excluded host");
      });
    });

    describe("tabs resource template", () => {
      it("should return content of specific tab", async () => {
        vi.mocked(mockBrowserInterface.getPageContent).mockResolvedValue(
          mockPageContent
        );

        const result = await client.readResource({
          uri: "tab://1001/2001",
        });

        expect(result.contents).toHaveLength(1);
        const content = result.contents[0];
        expect(content.uri).toBe("tab://1001/2001");
        expect(content.name).toBe(`${mockPageContent.title} (example.com)`);
        expect(content.mimeType).toBe("text/markdown");
        expect(content.text).toContain("---");
        expect(content.text).toContain("title: " + mockPageContent.title);
        expect(content.text).toContain("## Example");
        expect(content.text).toContain("This is test content.");
      });

      it("should reject content from excluded domains", async () => {
        // Create server with excluded domains
        const options = {
          applicationName: "Google Chrome",
          browser: "chrome" as const,
          excludeHosts: ["example.com"],
          checkInterval: 0,
        };
        const filteredServer = await createMcpServer(options);

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

        vi.mocked(mockBrowserInterface.getPageContent).mockResolvedValue(
          mockPageContent
        );

        await expect(
          filteredClient.readResource({
            uri: "tab://1001/2001",
          })
        ).rejects.toThrow("Content not available for excluded host");
      });
    });

    describe("resource listing", () => {
      it("should list available resources", async () => {
        vi.mocked(mockBrowserInterface.getTabList).mockResolvedValue(mockTabs);

        const result = await client.listResources();

        // Should have current_tab resource plus individual tab resources from template
        expect(result.resources.length).toBeGreaterThanOrEqual(1);

        // Check current_tab resource
        const currentTabResource = result.resources.find(
          (r) => r.uri === "tab://current"
        );
        expect(currentTabResource).toBeDefined();
        expect(currentTabResource?.name).toBe("current_tab");
        expect(currentTabResource?.mimeType).toBe("text/markdown");

        // Check that tab resources are generated from template (should be mockTabs.length individual tab resources)
        const tabResources = result.resources.filter(
          (r) => r.uri?.startsWith("tab://") && r.uri !== "tab://current"
        );
        expect(tabResources).toHaveLength(mockTabs.length);

        // Verify first tab resource
        const firstTabResource = tabResources[0];
        expect(firstTabResource.name).toBe(
          `${mockTabs[0].title} (example.com)`
        );
        expect(firstTabResource.mimeType).toBe("text/markdown");
      });

      it("should list tab resources from template", async () => {
        vi.mocked(mockBrowserInterface.getTabList).mockResolvedValue(mockTabs);

        const result = await client.listResources();

        // Template should generate individual tab resources
        const tabResources = result.resources.filter(
          (r) => r.uri?.startsWith("tab://") && r.uri !== "tab://current"
        );
        expect(tabResources).toHaveLength(mockTabs.length);

        // Verify tab resources match mock data
        tabResources.forEach((resource, index) => {
          const expectedDomain = new URL(mockTabs[index].url).hostname;
          expect(resource.name).toBe(
            `${mockTabs[index].title} (${expectedDomain})`
          );
          expect(resource.mimeType).toBe("text/markdown");
          expect(resource.uri).toBe(
            `tab://${mockTabs[index].windowId}/${mockTabs[index].tabId}`
          );
        });
      });

      it("should filter resources by excluded domains", async () => {
        // Create server with excluded domains
        const options = {
          applicationName: "Google Chrome",
          browser: "chrome" as const,
          excludeHosts: ["github.com"],
          checkInterval: 0,
        };
        const filteredServer = await createMcpServer(options);

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

        vi.mocked(mockBrowserInterface.getTabList).mockResolvedValue(mockTabs);

        const result = await filteredClient.listResources();

        // Should have current_tab resource plus filtered tab resources
        expect(result.resources.length).toBeGreaterThanOrEqual(1);

        // Verify current_tab resource exists
        const currentTabResource = result.resources.find(
          (r) => r.uri === "tab://current"
        );
        expect(currentTabResource).toBeDefined();

        // Check filtered tab resources - github.com should be excluded
        const tabResources = result.resources.filter(
          (r) => r.uri?.startsWith("tab://") && r.uri !== "tab://current"
        );
        // Should have 2 tabs (example.com and test.com), github.com is excluded
        expect(tabResources).toHaveLength(2);

        // Verify github.com tab is not in the list
        const githubTab = tabResources.find((r) => r.name === "GitHub");
        expect(githubTab).toBeUndefined();
      });
    });
  });
});
