import type { Tab, TabRef, TabContent } from "./browser/browser.js";

export function formatTabRef(tab: Tab): string {
  return `ID:${tab.windowId}:${tab.tabId}`;
}

export function parseTabRef(tabRef: string): TabRef | null {
  const match = tabRef.match(/^ID:([^:]+):([^:]+)$/);
  if (!match) return null;
  const windowId = match[1];
  const tabId = match[2];
  return { windowId, tabId };
}

function getDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    return url;
  }
}

export function formatTabName(tab: { title: string; url: string }): string {
  return `${tab.title} (${getDomain(tab.url)})`;
}

export function formatList(tabs: Tab[], includeUrl: boolean = false): string {
  const list = tabs.map((tab) => formatListItem(tab, includeUrl)).join("\n");
  const header = `### Current Tabs (${tabs.length} tabs exists)\n`;
  return header + list;
}

export function formatListItem(tab: Tab, includeUrl: boolean = false): string {
  if (includeUrl) {
    return `- ${formatTabRef(tab)} [${tab.title}](${tab.url})`;
  } else {
    return `- ${formatTabRef(tab)} ${formatTabName(tab)}`;
  }
}

type FrontMatter = { key: string; value: string | number | boolean };

export function formatTabContent(
  tab: TabContent,
  startIndex: number = 0,
  maxContentChars?: number
): string {
  const frontMatters: FrontMatter[] = [
    { key: "url", value: tab.url },
    { key: "title", value: tab.title },
  ];
  let content = tab.content;

  if (startIndex > 0) {
    content = content.slice(startIndex);
    frontMatters.push({ key: "startIndex", value: startIndex });
  }
  const truncation =
    maxContentChars !== undefined && content.length > maxContentChars;
  if (truncation) {
    content = content.slice(0, maxContentChars);
    const nextStart = startIndex + maxContentChars;
    content += `\n\n<ERROR>Content truncated. Read with startIndex of ${nextStart} to get more content.</ERROR>`;
    frontMatters.push({ key: "truncated", value: truncation });
  }

  const frontMatterText = frontMatters
    .map(({ key, value }) => `${key}: ${value}`)
    .join("\n");

  return ["---", frontMatterText, "---", content].join("\n");
}

export const uriTemplate = "tab://{windowId}/{tabId}";

export function formatUri(ref: TabRef): string {
  return `tab://${ref.windowId}/${ref.tabId}`;
}
