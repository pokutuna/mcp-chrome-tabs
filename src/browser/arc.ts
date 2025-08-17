import type { BrowserInterface, TabRef, Tab, TabContent } from "./browser.js";
import {
  executeAppleScript,
  executeTabCreationScript,
  separator,
} from "./osascript.js";

/*
Arc browser implementation notes
- Tab/Window IDs are UUIDs (unlike Chrome's numeric IDs)
- The return value of "execute javascript" may be wrapped in "..." and escaped (e.g., \u003C), so decode it with JSON.parse
- Directly telling the active tab (front window/active tab) can fail depending on the environment;
  even when unspecified, first resolve the active tab's windowId/tabId and execute via the ID-targeted path for stability
*/

async function getArcTabList(applicationName: string): Promise<Tab[]> {
  const sep = separator();
  const appleScript = `
    tell application "${applicationName}"
      set output to ""
      repeat with aWindow in (every window)
        set windowId to id of aWindow
        repeat with aTab in (every tab of aWindow)
          set tabId to id of aTab
          set tabTitle to title of aTab
          set tabURL to URL of aTab
          set output to output & windowId & "${sep}" & tabId & "${sep}" & tabTitle & "${sep}" & tabURL & "\\n"
        end repeat
      end repeat
      return output
    end tell
  `;

  const result = await executeAppleScript(appleScript);
  const lines = result.trim().split("\n");
  const tabs: Tab[] = [];
  for (const line of lines) {
    const [wId, tId, title, url] = line.split(sep);
    if (!/^https?:\/\//.test(url)) continue;

    tabs.push({
      windowId: wId,
      tabId: tId,
      title: title.trim(),
      url: url.trim(),
    });
  }
  return tabs;
}

async function getActiveTabRef(applicationName: string): Promise<TabRef> {
  const sep = separator();
  const appleScript = `
    try
      tell application "${applicationName}"
        set wId to id of front window
        set tId to id of active tab of front window
        return wId & "${sep}" & tId
      end tell
    on error errMsg
      return "ERROR" & "${sep}" & errMsg
    end try
  `;
  const result = await executeAppleScript(appleScript);
  if (result.startsWith(`ERROR${sep}`)) {
    throw new Error(result.split(sep)[1]);
  }
  const [windowId, tabId] = result.split(sep);
  return { windowId: windowId.trim(), tabId: tabId.trim() };
}

async function getPageContent(
  applicationName: string,
  tab?: TabRef | null
): Promise<TabContent> {
  const sep = separator();
  const inner = `
    set tabTitle to title
    set tabURL to URL
    set tabContent to execute javascript "document.documentElement.outerHTML"
    return tabTitle & "${sep}" & tabURL & "${sep}" & tabContent
  `;

  const targetTab: TabRef = tab ?? (await getActiveTabRef(applicationName));

  const appleScript = `
    try
      tell application "${applicationName}"
        tell window id "${targetTab.windowId}"
          tell tab id "${targetTab.tabId}"
            with timeout of 3 seconds
              ${inner}
            end timeout
          end tell
        end tell
      end tell
    on error errMsg
      return "ERROR" & "${sep}" & errMsg
    end try
  `;

  const scriptResult = await executeAppleScript(appleScript);
  if (scriptResult.startsWith(`ERROR${sep}`)) {
    throw new Error(scriptResult.split(sep)[1]);
  }

  const parts = scriptResult.split(sep).map((part) => part.trim());
  if (parts.length < 3) {
    throw new Error("Failed to read the tab content");
  }

  const [title, url, rawContent] = parts;

  // Arc's "execute javascript" return string may be wrapped in "..." and escaped like \u003C.
  // In such cases, decode with JSON.parse to restore the raw HTML.
  let content = rawContent;
  if (content.startsWith('"') && content.endsWith('"')) {
    try {
      content = JSON.parse(content);
    } catch {
      // If decoding fails, return the value as-is
    }
  }

  return {
    title,
    url,
    content,
  };
}

async function openURL(applicationName: string, url: string): Promise<TabRef> {
  return executeTabCreationScript(
    applicationName,
    url,
    (escapedUrl, sep) => `
    tell application "${applicationName}"
      set newTab to (make new tab at end of tabs of window 1 with properties {URL:"${escapedUrl}"})
      set windowId to id of window 1
      set tabId to id of newTab
      return windowId & "${sep}" & tabId
    end tell
  `
  );
}

export const arcBrowser: BrowserInterface = {
  getTabList: getArcTabList,
  getPageContent,
  openURL,
};
