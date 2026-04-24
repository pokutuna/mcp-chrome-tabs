import type { BrowserInterface, TabRef, Tab, TabContent } from "./browser.js";
import { executeJXA } from "./osascript.js";

/*
Why JXA instead of AppleScript:

When multiple processes share the same bundle id (e.g., the user's Google Chrome
and a headless Chrome launched by Playwright MCP), AppleScript's
`tell application "Google Chrome"` resolves to the newest-launched process,
which may not be the user's foreground Chrome.

JXA's `Application("Google Chrome")` resolves to the oldest-launched process
instead, which reliably points to the user's primary Chrome in the common case.
There is no public API to target a specific PID without ObjC bridging, so we
rely on this JXA behavior documented at https://www.deanishe.net/snippet/multiple-app-instances/
*/

function jsonStringLiteral(value: string): string {
  return JSON.stringify(value);
}

async function getChromeTabList(applicationName: string): Promise<Tab[]> {
  const script = `
    const app = Application(${jsonStringLiteral(applicationName)});
    const out = [];
    for (const w of app.windows()) {
      const windowId = String(w.id());
      for (const t of w.tabs()) {
        out.push({
          windowId,
          tabId: String(t.id()),
          title: t.title(),
          url: t.url(),
        });
      }
    }
    JSON.stringify(out);
  `;

  const result = await executeJXA(script);
  const parsed = JSON.parse(result) as Tab[];
  return parsed.filter((t) => /^https?:\/\//.test(t.url));
}

async function getPageContent(
  applicationName: string,
  tab?: TabRef | null
): Promise<TabContent> {
  const script = `
    const app = Application(${jsonStringLiteral(applicationName)});
    const target = ${tab ? jsonStringLiteral(JSON.stringify(tab)) : "null"};

    // Chrome's "execute javascript" may hang on suspended tabs. JXA cannot
    // express AppleScript's "with timeout" block, so we rely on osascript's
    // outer process timeout and the retry wrapper.
    let targetTab;
    if (target) {
      const t = JSON.parse(target);
      const win = app.windows.byId(Number(t.windowId));
      targetTab = win.tabs.byId(Number(t.tabId));
    } else {
      for (const w of app.windows()) {
        const t = w.activeTab();
        if (t.url() !== "about:blank") {
          targetTab = t;
          break;
        }
      }
      if (!targetTab) throw new Error("No active tab found");
    }

    const result = {
      title: targetTab.title(),
      url: targetTab.url(),
      content: app.execute(targetTab, { javascript: "document.documentElement.outerHTML" }),
    };
    JSON.stringify(result);
  `;

  const scriptResult = await executeJXA(script);
  const parsed = JSON.parse(scriptResult) as TabContent;
  return parsed;
}

async function openURL(applicationName: string, url: string): Promise<TabRef> {
  const script = `
    const app = Application(${jsonStringLiteral(applicationName)});
    const win = app.windows[0];
    const newTab = app.Tab({ url: ${jsonStringLiteral(url)} });
    win.tabs.push(newTab);
    JSON.stringify({
      windowId: String(win.id()),
      tabId: String(newTab.id()),
    });
  `;

  const result = await executeJXA(script);
  return JSON.parse(result) as TabRef;
}

export const chromeBrowser: BrowserInterface = {
  getTabList: getChromeTabList,
  getPageContent,
  openURL,
};
