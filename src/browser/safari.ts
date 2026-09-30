import type { BrowserInterface, TabRef, Tab, TabContent } from "./browser.js";
import { bindApplication, executeJXA, jsonLiteral } from "./osascript.js";

/*
Safari implementation notes
- Safari tabs have no ID. tabId is the tab's 1-based index in its window, so
  it shifts when tabs before it are closed or moved. This also applies between
  getTabInfo and getPageContent: if the order changes in between, the page
  read may be another tab, and an excluded host is then caught only by the
  check after reading. Without a tab ID this cannot be ruled out, and it is
  accepted while Safari support is experimental.
- The active tab is the front window's current tab.
- Reading page content requires Develop > Allow JavaScript from Apple Events.
*/

async function getSafariTabList(applicationName: string): Promise<Tab[]> {
  const script = `
    ${bindApplication(applicationName)}
    const out = [];
    // The active tab is the front window's current tab, and windows come
    // front to back
    let front = true;
    for (const w of app.windows()) {
      const windowId = String(w.id());
      const currentIndex = front ? w.currentTab().index() : 0;
      front = false;
      for (const t of w.tabs()) {
        const index = t.index();
        out.push({
          windowId,
          tabId: String(index),
          title: t.name(),
          url: t.url() ?? "",
          active: index === currentIndex,
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
// window's current tab
function resolveTargetTab(tab?: TabRef | null): string {
  return `
    const target = ${tab ? jsonLiteral(tab) : "null"};
    let targetWindow;
    let targetTab;
    if (target) {
      targetWindow = app.windows.byId(Number(target.windowId));
      targetTab = targetWindow.tabs[Number(target.tabId) - 1];
    } else {
      targetWindow = app.windows[0];
      targetTab = targetWindow.currentTab();
      if ((targetTab.url() ?? "about:blank") === "about:blank") {
        throw new Error("No active tab found");
      }
    }
  `;
}

async function getTabInfo(
  applicationName: string,
  tab?: TabRef | null
): Promise<Tab> {
  const script = `
    ${bindApplication(applicationName)}
    ${resolveTargetTab(tab)}
    JSON.stringify({
      windowId: String(targetWindow.id()),
      tabId: String(targetTab.index()),
      title: targetTab.name(),
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
    ${bindApplication(applicationName)}
    ${resolveTargetTab(tab)}

    // As with Chrome, JavaScript in a suspended tab may never return, so the
    // caller uses a short process timeout and does not retry.
    JSON.stringify({
      title: targetTab.name(),
      url: targetTab.url() ?? "",
      content: app.doJavaScript("document.documentElement.outerHTML", {
        in: targetTab,
      }),
    });
  `;

  const result = await executeJXA(script, {
    timeout: 3 * 1000,
    maxRetries: 0,
  });
  return JSON.parse(result) as TabContent;
}

async function openURL(applicationName: string, url: string): Promise<TabRef> {
  const script = `
    ${bindApplication(applicationName, { launch: true })}
    const win = app.windows[0];
    const newTab = app.Tab({ url: ${jsonLiteral(url)} });
    win.tabs.push(newTab);
    // Unlike Chrome, Safari leaves a new tab in the background
    win.currentTab = newTab;
    JSON.stringify({
      windowId: String(win.id()),
      tabId: String(newTab.index()),
    });
  `;

  const result = await executeJXA(script);
  return JSON.parse(result) as TabRef;
}

export const safariBrowser: BrowserInterface = {
  getTabList: getSafariTabList,
  getTabInfo,
  getPageContent,
  openURL,
};
