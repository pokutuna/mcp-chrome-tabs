import { Tab, TabRef, TabContent } from "./chrome.js";

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

function truncateUrl(tab: Tab, over: number = 120): string {
  const url = tab.url;
  if (url.length <= over) return url;
  return url.slice(0, over) + "...";
}

export function formatList(tabs: Tab[]): string {
  const list = tabs.map(formatListItem).join("\n");
  const header = `### Current Tabs (${tabs.length} tabs exists)\n`;
  return header + list;
}

export function formatListItem(tab: Tab): string {
  return `- ${formatTabRef(tab)} [${tab.title}](${truncateUrl(tab)})`;
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
