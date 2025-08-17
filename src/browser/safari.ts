import type { BrowserInterface, TabRef, Tab, TabContent } from "./browser.js";
import {
  escapeAppleScript,
  executeAppleScript,
  separator,
} from "./osascript.js";

async function getSafariTabList(applicationName: string): Promise<Tab[]> {
  const sep = separator();
  const appleScript = `
    tell application "${applicationName}"
      set output to ""
      repeat with aWindow in (every window)
        set windowId to id of aWindow
        repeat with aTab in (every tab of aWindow)
          set tabIndex to index of aTab
          set tabTitle to name of aTab
          set tabURL to URL of aTab
          set output to output & windowId & "${sep}" & tabIndex & "${sep}" & tabTitle & "${sep}" & tabURL & "\\n"
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

    // Note: Safari tab IDs are volatile indices that change when tabs are closed
    // Unlike Chrome, Safari doesn't provide stable unique tab identifiers
    tabs.push({
      windowId: wId,
      tabId: tId,
      title: title.trim(),
      url: url.trim(),
    });
  }
  return tabs;
}

async function getPageContent(
  applicationName: string,
  tab?: TabRef | null
): Promise<TabContent> {
  const sep = separator();
  const inner = `
    set tabTitle to name
    set tabURL to URL
    set tabContent to do JavaScript "document.documentElement.outerHTML"
    return tabTitle & "${sep}" & tabURL & "${sep}" & tabContent
  `;
  const appleScript = tab
    ? `
      try
        tell application "${applicationName}"
          tell window id "${tab.windowId}"
            tell tab ${tab.tabId}
              with timeout of 3 seconds
                ${inner}
              end timeout
            end tell
          end tell
        end tell
      on error errMsg
        return "ERROR" & "${sep}" & errMsg
      end try
    `
    : `
      try
        tell application "${applicationName}"
          tell front window
            set t to current tab
            if URL of t is not "about:blank" then
              tell t
                with timeout of 3 seconds
                  ${inner}
                end timeout
              end tell
            else
              error "No active tab found"
            end if
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

  const [title, url, content] = parts;

  return {
    title,
    url,
    content,
  };
}

async function openURL(applicationName: string, url: string): Promise<TabRef> {
  const escapedUrl = escapeAppleScript(url);
  const sep = separator();
  const appleScript = `
    tell application "${applicationName}"
      tell front window
        set newTab to (make new tab with properties {URL:"${escapedUrl}"})
        set windowId to id of (front window)
        set tabIndex to index of newTab
        return windowId & "${sep}" & tabIndex
      end tell
    end tell
  `;
  const result = await executeAppleScript(appleScript);
  const [windowId, tabId] = result.trim().split(sep);
  return { windowId, tabId };
}

export const safariBrowser: BrowserInterface = {
  getTabList: getSafariTabList,
  getPageContent,
  openURL,
};
