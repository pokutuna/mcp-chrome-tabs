import { execFile } from "child_process";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { promisify } from "util";
import TurndownService from "turndown";
import turndownPluginGfm from "turndown-plugin-gfm";

const execFileAsync = promisify(execFile);

export type TabRef = { windowIndex: number; tabIndex: number };

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

export async function getChromeTabList(): Promise<ChromeTab[]> {
  const sep = separator();
  const appleScript = `
    tell application "Google Chrome"
      set output to ""
      repeat with w from 1 to count of windows
        repeat with t from 1 to count of tabs of window w
          set windowIdx to w
          set tabIdx to t
          set tabTitle to title of tab t of window w
          set tabURL to URL of tab t of window w
          set output to output & windowIdx & "${sep}" & tabIdx & "${sep}" & tabTitle & "${sep}" & tabURL & "\\n"
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
      windowIndex: parseInt(wId, 10),
      tabIndex: parseInt(tId, 10),
      title: title.trim(),
      url: url.trim(),
    });
  }
  return tabs;
}

export async function getPageContent(
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
      tell application "Google Chrome"
        tell window ${tab.windowIndex}
          tell tab ${tab.tabIndex}
            ${inner}
          end tell
        end tell
        return "NOT_FOUND"
      end tell
  `
    : `
      tell application "Google Chrome"
        tell front window
          tell active tab
            ${inner}
          end tell
        end tell
        return "NOT_FOUND"
      end tell
    `;

  const result = await executeAppleScript(appleScript);
  if (result === "NOT_FOUND") throw new Error("Tab not found");

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

export async function openURL(url: string): Promise<void> {
  const escapedUrl = escapeAppleScript(url);
  const appleScript = `
    tell application "Google Chrome"
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
        timeout: 10 * 1000,
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
