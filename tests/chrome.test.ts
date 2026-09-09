import vm from "node:vm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const executeJXA = vi.fn();

vi.mock("../src/browser/osascript.js", () => ({ executeJXA }));

const { chromeBrowser } = await import("../src/browser/chrome.js");

function runJXAWithApplication(application: object) {
  executeJXA.mockImplementation(async (script: string) => {
    const Application = () => application;
    return String(vm.runInNewContext(script, { Application }));
  });
}

function makeTab(id: number, title: string, url: string) {
  return {
    id: () => id,
    title: () => title,
    url: () => url,
  };
}

describe("chromeBrowser JXA callers", () => {
  beforeEach(() => {
    executeJXA.mockReset();
  });

  test("lists HTTP tabs and preserves JSON special characters", async () => {
    const tabs = [
      makeTab(42, 'A \\ "quoted"\ntitle', "https://example.test/?q=あ"),
      makeTab(43, "ignored", "chrome://settings"),
    ];
    runJXAWithApplication({
      windows: () => [{ id: () => 7, tabs: () => tabs }],
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
