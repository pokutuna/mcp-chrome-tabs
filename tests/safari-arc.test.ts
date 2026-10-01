import vm from "node:vm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const executeJXA = vi.fn();

vi.mock("../src/browser/osascript.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/browser/osascript.js")>()),
  executeJXA,
}));

const { safariBrowser } = await import("../src/browser/safari.js");
const { arcBrowser } = await import("../src/browser/arc.js");

function runJXAWithApplication(application: object) {
  executeJXA.mockImplementation(async (script: string) => {
    const Application = () => ({ running: () => true, ...application });
    return String(vm.runInNewContext(script, { Application }));
  });
}

// Array-like windows collection that can also be called and looked up by ID,
// as JXA element collections can
function windowCollection<W extends { id: () => unknown }>(windows: W[]) {
  return Object.assign(() => windows, windows, {
    byId: (id: unknown) => windows.find((w) => w.id() === id),
  });
}

describe("safariBrowser JXA callers", () => {
  function makeTab(index: number, name: string, url: string | null) {
    return { index: () => index, name: () => name, url: () => url };
  }

  beforeEach(() => {
    executeJXA.mockReset();
  });

  test("lists HTTP tabs with their 1-based index as the tab ID", async () => {
    const tabs = [
      makeTab(1, 'A "quoted" title', "https://example.test/?q=あ"),
      makeTab(2, "Favorites", null),
      makeTab(3, "Local", "file:///tmp/a.html"),
    ];
    runJXAWithApplication({
      windows: windowCollection([
        { id: () => 7, tabs: () => tabs, currentTab: () => tabs[0] },
      ]),
    });

    await expect(safariBrowser.getTabList("Safari")).resolves.toEqual([
      {
        windowId: "7",
        tabId: "1",
        title: 'A "quoted" title',
        url: "https://example.test/?q=あ",
        active: true,
      },
    ]);
  });

  test("reads a tab by window ID and index with a short non-retrying timeout", async () => {
    const tab = makeTab(2, "Second", "https://second.test");
    const doJavaScript = vi.fn((_code: string, opts: { in: object }) =>
      opts.in === tab ? "<second>" : "<other>"
    );
    runJXAWithApplication({
      windows: windowCollection([
        { id: () => 5, tabs: [makeTab(1, "First", "https://first.test"), tab] },
      ]),
      doJavaScript,
    });

    await expect(
      safariBrowser.getPageContent("Safari", { windowId: "5", tabId: "2" })
    ).resolves.toEqual({
      title: "Second",
      url: "https://second.test",
      content: "<second>",
    });
    expect(executeJXA.mock.calls[0][1]).toEqual({
      timeout: 3000,
      maxRetries: 0,
    });
  });

  test("resolves the current tab without running JavaScript in it", async () => {
    const doJavaScript = vi.fn();
    runJXAWithApplication({
      windows: windowCollection([
        {
          id: () => 5,
          currentTab: () => makeTab(3, "Current", "https://current.test"),
        },
      ]),
      doJavaScript,
    });

    await expect(safariBrowser.getTabInfo("Safari")).resolves.toEqual({
      windowId: "5",
      tabId: "3",
      title: "Current",
      url: "https://current.test",
    });
    expect(doJavaScript).not.toHaveBeenCalled();
  });

  test("reports no active tab for an empty current tab", async () => {
    runJXAWithApplication({
      windows: windowCollection([
        { id: () => 5, currentTab: () => makeTab(1, "", null) },
      ]),
    });

    await expect(safariBrowser.getTabInfo("Safari")).rejects.toThrow(
      "No active tab found"
    );
  });

  test("opens a URL and returns the new tab's index", async () => {
    const newTab = makeTab(4, "", "");
    const push = vi.fn();
    const win: { id: () => number; tabs: object; currentTab?: object } = {
      id: () => 8,
      tabs: { push },
    };
    runJXAWithApplication({
      windows: windowCollection([win]),
      Tab: (properties: { url: string }) => {
        expect(properties.url).toBe('https://example.test/?q="あ"');
        return newTab;
      },
    });

    await expect(
      safariBrowser.openURL("Safari", 'https://example.test/?q="あ"')
    ).resolves.toEqual({ windowId: "8", tabId: "4" });
    expect(push).toHaveBeenCalledWith(newTab);
    expect(win.currentTab).toBe(newTab);
  });
});

describe("arcBrowser JXA callers", () => {
  function makeTab(id: string, title: string, url: string) {
    return { id: () => id, title: () => title, url: () => url };
  }

  // Arc cannot resolve the references that windows(), tabs() or activeTab()
  // return, so the collections here can only be indexed or looked up by ID,
  // and calling activeTab fails
  function elements<E extends { id: () => string }>(items: E[]) {
    return {
      ...items,
      length: items.length,
      byId: (id: string) => items.find((item) => item.id() === id),
    };
  }

  function makeWindow(id: string, tabs: ReturnType<typeof makeTab>[]) {
    return {
      id: () => id,
      activeTab: Object.assign(() => {
        throw new Error("Can't convert types. (-1700)");
      }, tabs[0]),
      tabs: { ...elements(tabs), push: vi.fn() },
    };
  }

  beforeEach(() => {
    executeJXA.mockReset();
  });

  test("lists HTTP tabs by their UUIDs", async () => {
    runJXAWithApplication({
      windows: elements([
        makeWindow("w-1", [
          makeTab("t-1", "Example", "https://example.test"),
          makeTab("t-2", "Settings", "arc://settings"),
        ]),
      ]),
    });

    await expect(arcBrowser.getTabList("Arc")).resolves.toEqual([
      {
        windowId: "w-1",
        tabId: "t-1",
        title: "Example",
        url: "https://example.test",
        active: true,
      },
    ]);
  });

  test("reads the active tab by its resolved IDs and decodes quoted HTML", async () => {
    const active = makeTab("t-1", "Active", "https://active.test");
    const execute = vi.fn((tab: object) =>
      tab === active ? JSON.stringify("<p><active</p>") : "<other>"
    );
    runJXAWithApplication({
      windows: elements([makeWindow("w-1", [active])]),
      execute,
    });

    await expect(arcBrowser.getPageContent("Arc")).resolves.toEqual({
      title: "Active",
      url: "https://active.test",
      content: "<p><active</p>",
    });
    expect(executeJXA.mock.calls[0][1]).toEqual({
      timeout: 3000,
      maxRetries: 0,
    });
  });

  test("resolves a tab by ID without running JavaScript in it", async () => {
    const execute = vi.fn();
    runJXAWithApplication({
      windows: elements([
        makeWindow("w-1", [
          makeTab("t-1", "First", "https://first.test"),
          makeTab("t-2", "Second", "https://second.test"),
        ]),
      ]),
      execute,
    });

    await expect(
      arcBrowser.getTabInfo("Arc", { windowId: "w-1", tabId: "t-2" })
    ).resolves.toEqual({
      windowId: "w-1",
      tabId: "t-2",
      title: "Second",
      url: "https://second.test",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  test("opens a URL and returns the active tab, which is the new one", async () => {
    const newTab = makeTab("t-9", "", "");
    const win = makeWindow("w-1", [newTab]);
    const created = {};
    runJXAWithApplication({
      windows: elements([win]),
      Tab: (properties: { url: string }) => {
        expect(properties.url).toBe('https://example.test/?q="あ"');
        return created;
      },
    });

    await expect(
      arcBrowser.openURL("Arc", 'https://example.test/?q="あ"')
    ).resolves.toEqual({ windowId: "w-1", tabId: "t-9" });
    expect(win.tabs.push).toHaveBeenCalledWith(created);
  });
});
