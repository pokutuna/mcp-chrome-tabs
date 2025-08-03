import type { Tab, TabRef, TabContent } from "./browser/browser.js";

export function formatTabRef(tab: Tab): string {
  return `ID:${tab.windowId}:${tab.tabId}`;
}

export function parseTabRef(tabRef: string): TabRef | null {
  const match = tabRef.match(/ID:(\d+):(\d+)$/);
  if (!match) return null;
  const windowId = match[1];
  const tabId = match[2];
  return { windowId, tabId };
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
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
    return `- ${formatTabRef(tab)} ${tab.title} (${getDomain(tab.url)})`;
  }
}

export function formatTabContent(tab: TabContent): string {
  return `
---
title: ${tab.title}
---
${tab.content}
`.trimStart();
}

export const uriTemplate = "tab://{windowId}/{tabId}";

export function formatUri(ref: TabRef): string {
  // TODO give domain & title for incremental search
  return `tab://${ref.windowId}/${ref.tabId}`;
}
