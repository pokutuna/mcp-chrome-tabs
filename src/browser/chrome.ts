import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import turndownPluginGfm from "turndown-plugin-gfm";
import type { BrowserInterface, TabRef, Tab, TabContent } from "./browser.js";
import {
  escapeAppleScript,
  executeAppleScript,
  separator,
} from "./osascript.js";

async function getChromeTabList(applicationName: string): Promise<Tab[]> {
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
  const appleScript = tab
    ? `
      try
        tell application "${applicationName}"
          tell window id "${tab.windowId}"
            tell tab id "${tab.tabId}"
              (* Chrome によって suspend されたタブで js を実行すると動作が停止する
                 タイムアウトにより osascript コマンドの実行を retry したくないので
                 apple script 内で timeout をしてエラーを返すようにする *)
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
          repeat with w in windows
            tell w
              set t to tab (active tab index)
              if URL of t is not "about:blank" then
                tell t
                  ${inner}
                end tell
              end if
            end tell
          end repeat
          error "No active tab found"
        end tell
      on error errMsg
        return "ERROR" & "${sep}" & errMsg
      end try
    `;

  const result = await executeAppleScript(appleScript);
  if (result.startsWith(`ERROR${sep}`)) throw new Error(result.split(sep)[1]);

  const parts = result.split(sep).map((part) => part.trim());
  if (parts.length < 3) throw new Error("Failed to read the tab content");

  const [title, url, content] = parts;

  const dom = new JSDOM(content, { url });
  const reader = new Readability(dom.window.document, {
    charThreshold: 10,
  });
  const article = reader.parse();
  if (!article?.content) throw new Error("Failed to parse the page content");

  const turndownService = new TurndownService();
  turndownService.use(turndownPluginGfm.gfm);
  const md = turndownService.turndown(article.content);

  return {
    title,
    url,
    content: md,
  };
}

async function openURL(applicationName: string, url: string): Promise<void> {
  const escapedUrl = escapeAppleScript(url);
  const appleScript = `
    tell application "${applicationName}"
      open location "${escapedUrl}"
    end tell
  `;
  await executeAppleScript(appleScript);
}

export const chromeBrowser: BrowserInterface = {
  getTabList: getChromeTabList,
  getPageContent,
  openURL,
};
