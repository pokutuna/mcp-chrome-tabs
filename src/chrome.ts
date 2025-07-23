import { execFile } from "child_process";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { promisify } from "util";
import TurndownService from "turndown";
import turndownPluginGfm from "turndown-plugin-gfm";

const execFileAsync = promisify(execFile);

export type TabRef = { windowId: string; tabId: string };

export type ChromeTab = TabRef & {
  title: string;
  url: string;
};

export type PageContent = {
  title: string;
  url: string;
  content: string;
};

function escapeAppleScript(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

export async function getChromeTabList(
  applicationName: string
): Promise<ChromeTab[]> {
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
  const tabs: ChromeTab[] = [];
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

export async function getPageContent(
  applicationName: string,
  tab?: TabRef | null
): Promise<PageContent> {
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

export async function openURL(
  applicationName: string,
  url: string
): Promise<void> {
  const escapedUrl = escapeAppleScript(url);
  const appleScript = `
    tell application "${applicationName}"
      open location "${escapedUrl}"
    end tell
  `;
  await executeAppleScript(appleScript);
}

async function retry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    retryDelay?: number;
  }
): Promise<T> {
  const { maxRetries = 2, retryDelay = 1000 } = options || {};
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (attempt === maxRetries) {
        console.error("retry failed after maximum attempts:", error);
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay * Math.pow(2, attempt))
      );
    }
  }
  throw new Error("unreachable");
}

async function executeAppleScript(script: string): Promise<string> {
  return retry(async () => {
    const { stdout, stderr } = await execFileAsync(
      "osascript",
      ["-e", script],
      {
        timeout: 5 * 1000,
        maxBuffer: 5 * 1024 * 1024, // 5MB
      }
    );
    if (stderr) console.error("AppleScript stderr:", stderr);
    return stdout.trim();
  });
}

function separator(): string {
  const uniqueId = Math.random().toString(36).substring(2);
  return `<|SEP:${uniqueId}|>`;
}
