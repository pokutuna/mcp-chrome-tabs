import type { BrowserInterface, TabRef, Tab, TabContent } from "./browser.js";
import { executeJXA, jsonLiteral } from "./osascript.js";

/*
Arc browser implementation notes
- Tab/Window IDs are UUIDs (unlike Chrome's numeric IDs)
- The return value of "execute javascript" may be wrapped in "..." and escaped (e.g., <), so decode it with JSON.parse
- Operating on the active tab directly can fail depending on the environment,
  so the active tab is first resolved to its IDs and then looked up by ID
- The ID of a tab created by "make new tab" cannot be read, so openURL
  returns the active tab, which is the new one
*/

async function getArcTabList(applicationName: string): Promise<Tab[]> {
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
          url: t.url() ?? "",
        });
      }
    }
    JSON.stringify(out);
  `;

  const result = await executeJXA(script);
  const parsed = JSON.parse(result) as Tab[];
  return parsed.filter((t) => /^https?:\/\//.test(t.url));
}

// JXA that binds targetWindow and targetTab to the given tab, or to the front
// window's active tab
function resolveTargetTab(tab?: TabRef | null): string {
  return `
    let target = ${tab ? jsonLiteral(tab) : "null"};
    if (!target) {
      const front = app.windows[0];
      target = { windowId: front.id(), tabId: front.activeTab().id() };
    }
    const targetWindow = app.windows.byId(String(target.windowId));
    const targetTab = targetWindow.tabs.byId(String(target.tabId));
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
      url: targetTab.url() ?? "",
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

    // As with Chrome, JavaScript in a suspended tab may never return, so the
    // caller uses a short process timeout and does not retry.
    JSON.stringify({
      title: targetTab.title(),
      url: targetTab.url() ?? "",
      content: app.execute(targetTab, {
        javascript: "document.documentElement.outerHTML",
      }),
    });
  `;

  const result = await executeJXA(script, {
    timeout: 3 * 1000,
    maxRetries: 0,
  });
  const parsed = JSON.parse(result) as TabContent;

  // Arc's "execute javascript" return string may be wrapped in "..." and escaped like <.
  // In such cases, decode with JSON.parse to restore the raw HTML.
  let content = parsed.content;
  if (content.startsWith('"') && content.endsWith('"')) {
    try {
      content = JSON.parse(content);
    } catch {
      // If decoding fails, return the value as-is
    }
  }
  return { ...parsed, content };
}

async function openURL(applicationName: string, url: string): Promise<TabRef> {
  const script = `
    const app = Application(${jsonLiteral(applicationName)});
    const win = app.windows[0];
    win.tabs.push(app.Tab({ url: ${jsonLiteral(url)} }));
    JSON.stringify({
      windowId: String(win.id()),
      tabId: String(win.activeTab().id()),
    });
  `;

  const result = await executeJXA(script);
  return JSON.parse(result) as TabRef;
}

export const arcBrowser: BrowserInterface = {
  getTabList: getArcTabList,
  getTabInfo,
  getPageContent,
  openURL,
};
