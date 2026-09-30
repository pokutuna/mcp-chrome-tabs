import type { BrowserInterface, TabRef, Tab, TabContent } from "./browser.js";
import { executeJXA } from "./osascript.js";

/*
Why JXA instead of AppleScript:

When multiple processes share the same bundle id (e.g., the user's Google Chrome
and a headless Chrome launched by Playwright MCP), AppleScript's
`tell application "Google Chrome"` resolves to the newest-launched process,
which may not be the user's foreground Chrome.

JXA has been observed to resolve `Application("Google Chrome")` to the
oldest-launched process, which usually points to the user's primary Chrome.
This is a startup-order heuristic: if the headless process starts first, it is
selected instead. There is no public API to target a specific PID without ObjC
bridging, so we rely on this behavior documented at
https://www.deanishe.net/snippet/multiple-app-instances/
*/

// Embeds a value into the JXA source as a JSON literal, so that user input
// cannot break out of the surrounding script syntax.
function jsonLiteral(value: unknown): string {
  return JSON.stringify(value);
}

async function getChromeTabList(applicationName: string): Promise<Tab[]> {
  const script = `
    const app = Application(${jsonLiteral(applicationName)});
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

// JXA that binds targetWindow and targetTab to the given tab, or to the first
// window's active tab that is not blank
function resolveTargetTab(tab?: TabRef | null): string {
  return `
    const target = ${tab ? jsonLiteral(tab) : "null"};
    let targetWindow;
    let targetTab;
    if (target) {
      targetWindow = app.windows.byId(Number(target.windowId));
      targetTab = targetWindow.tabs.byId(Number(target.tabId));
    } else {
      for (const w of app.windows()) {
        const t = w.activeTab();
        if (t.url() !== "about:blank") {
          targetWindow = w;
          targetTab = t;
          break;
        }
      }
      if (!targetTab) throw new Error("No active tab found");
    }
  `;
}

async function getTabInfo(
  applicationName: string,
  tab?: TabRef | null
): Promise<Tab> {
  const script = `
    const app = Application(${jsonLiteral(applicationName)});
    ${resolveTargetTab(tab)}
    JSON.stringify({
      windowId: String(targetWindow.id()),
      tabId: String(targetTab.id()),
      title: targetTab.title(),
      url: targetTab.url(),
    });
  `;

  const result = await executeJXA(script);
  return JSON.parse(result) as Tab;
}

async function getPageContent(
  applicationName: string,
  tab?: TabRef | null
): Promise<TabContent> {
  const script = `
    const app = Application(${jsonLiteral(applicationName)});
    ${resolveTargetTab(tab)}

    // Chrome's "execute javascript" may hang on suspended tabs. JXA cannot
    // express AppleScript's "with timeout" block, so use a short process
    // timeout and do not retry this operation.

    const result = {
      title: targetTab.title(),
      url: targetTab.url(),
      content: app.execute(targetTab, { javascript: "document.documentElement.outerHTML" }),
    };
    JSON.stringify(result);
  `;

  const scriptResult = await executeJXA(script, {
    timeout: 3 * 1000,
    maxRetries: 0,
  });
  const parsed = JSON.parse(scriptResult) as TabContent;
  return parsed;
}

async function openURL(applicationName: string, url: string): Promise<TabRef> {
  const script = `
    const app = Application(${jsonLiteral(applicationName)});
    const win = app.windows[0];
    const newTab = app.Tab({ url: ${jsonLiteral(url)} });
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
  getTabInfo,
  getPageContent,
  openURL,
};
