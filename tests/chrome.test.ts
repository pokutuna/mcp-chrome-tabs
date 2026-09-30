import vm from "node:vm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const executeJXA = vi.fn();

vi.mock("../src/browser/osascript.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/browser/osascript.js")>()),
  executeJXA,
}));

const { chromeBrowser } = await import("../src/browser/chrome.js");

function runJXAWithApplication(application: object) {
  executeJXA.mockImplementation(async (script: string) => {
    const Application = () => application;
    return String(vm.runInNewContext(script, { Application }));
  });
}

type MockTab = { id: number; title: string; url: string };

function makeTab(id: number, title: string, url: string) {
  return {
    id: () => id,
    title: () => title,
    url: () => url,
  };
}

// The tab list reads each property for all tabs at once; `snapshots` gives
// the tab set seen by each successive read, the last one repeating
function makeTabs(...snapshots: MockTab[][]) {
  let reads = 0;
  const current = () => snapshots[Math.min(reads++, snapshots.length - 1)];
  return {
    id: () => current().map((t) => t.id),
    title: () => current().map((t) => t.title),
    url: () => current().map((t) => t.url),
  };
}

describe("chromeBrowser JXA callers", () => {
  beforeEach(() => {
    executeJXA.mockReset();
  });

  test("lists HTTP tabs and preserves JSON special characters", async () => {
    const tabs = makeTabs([
      {
        id: 42,
        title: 'A \\ "quoted"\ntitle',
        url: "https://example.test/?q=あ",
      },
      { id: 43, title: "ignored", url: "chrome://settings" },
    ]);
    runJXAWithApplication({
      windows: () => [{ id: () => 7, tabs }],
    });

    await expect(chromeBrowser.getTabList("Google Chrome")).resolves.toEqual([
      {
        windowId: "7",
        tabId: "42",
        title: 'A \\ "quoted"\ntitle',
        url: "https://example.test/?q=あ",
      },
    ]);
    expect(executeJXA).toHaveBeenCalledTimes(1);
    expect(executeJXA.mock.calls[0][0]).toContain(
      'Application("Google Chrome")'
    );
  });

  test("rereads a window whose tabs changed between the property reads", async () => {
    const a = { id: 1, title: "A", url: "https://a.test" };
    const b = { id: 2, title: "B", url: "https://b.test" };
    // Tab A closes after the IDs were read, so the titles and URLs belong to
    // [B] while the IDs say [A, B]; the second pass sees [B] throughout
    const tabs = makeTabs([a, b], [b]);
    runJXAWithApplication({
      windows: () => [{ id: () => 7, tabs }],
    });

    await expect(chromeBrowser.getTabList("Google Chrome")).resolves.toEqual([
      { windowId: "7", tabId: "2", title: "B", url: "https://b.test" },
    ]);
  });

  test("gives up when the tabs keep changing", async () => {
    let n = 0;
    const tabs = {
      id: () => [++n],
      title: () => ["T"],
      url: () => ["https://t.test"],
    };
    runJXAWithApplication({
      windows: () => [{ id: () => 7, tabs }],
    });

    await expect(chromeBrowser.getTabList("Google Chrome")).rejects.toThrow(
      "Tabs kept changing while listing them"
    );
  });

  test("reads explicit and active tabs with a short non-retrying timeout", async () => {
    const explicitTab = makeTab(22, "Explicit", "https://explicit.test");
    const activeTab = makeTab(23, "Active", "https://active.test");
    const app = {
      windows: Object.assign(() => [{ activeTab: () => activeTab }], {
        byId: (id: number) => ({
          tabs: {
            byId: (tabId: number) =>
              id === 5 && tabId === 22 ? explicitTab : undefined,
          },
        }),
      }),
      execute: (tab: object) =>
        tab === explicitTab ? "<explicit>" : "<active>",
    };
    runJXAWithApplication(app);

    await expect(
      chromeBrowser.getPageContent("Google Chrome", {
        windowId: "5",
        tabId: "22",
      })
    ).resolves.toEqual({
      title: "Explicit",
      url: "https://explicit.test",
      content: "<explicit>",
    });
    await expect(
      chromeBrowser.getPageContent("Google Chrome")
    ).resolves.toEqual({
      title: "Active",
      url: "https://active.test",
      content: "<active>",
    });

    expect(executeJXA).toHaveBeenCalledTimes(2);
    expect(executeJXA.mock.calls[0][1]).toEqual({
      timeout: 3000,
      maxRetries: 0,
    });
    expect(executeJXA.mock.calls[1][1]).toEqual({
      timeout: 3000,
      maxRetries: 0,
    });
  });

  test("resolves a tab's IDs and URL without running JavaScript in it", async () => {
    const activeTab = makeTab(23, "Active", "https://active.test");
    const execute = vi.fn();
    runJXAWithApplication({
      windows: () => [{ id: () => 5, activeTab: () => activeTab }],
      execute,
    });

    await expect(chromeBrowser.getTabInfo("Google Chrome")).resolves.toEqual({
      windowId: "5",
      tabId: "23",
      title: "Active",
      url: "https://active.test",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  test("opens a URL with special characters and returns the created tab ID", async () => {
    const newTab = makeTab(99, "", "");
    const app = {
      windows: [
        {
          id: () => 8,
          tabs: { push: (tab: object) => expect(tab).toBe(newTab) },
        },
      ],
      Tab: (properties: { url: string }) => {
        expect(properties.url).toBe('https://example.test/?q="あ"');
        return newTab;
      },
    };
    runJXAWithApplication(app);

    await expect(
      chromeBrowser.openURL("Google Chrome", 'https://example.test/?q="あ"')
    ).resolves.toEqual({ windowId: "8", tabId: "99" });
  });
});
