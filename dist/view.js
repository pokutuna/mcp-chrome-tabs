export function formatTabRef(tab) {
    return `ID:${tab.windowId}:${tab.tabId}`;
}
export function parseTabRef(tabRef) {
    const match = tabRef.match(/ID:(\d+):(\d+)$/);
    if (!match)
        return null;
    const windowId = match[1];
    const tabId = match[2];
    return { windowId, tabId };
}
function truncateUrl(tab, over = 120) {
    const url = tab.url;
    if (url.length <= over)
        return url;
    return url.slice(0, over) + "...";
}
export function formatList(tabs) {
    const list = tabs.map(formatListItem).join("\n");
    const header = `### Current Tabs (${tabs.length} tabs exists)\n`;
    return header + list;
}
export function formatListItem(tab) {
    return `- ${formatTabRef(tab)} [${tab.title}](${truncateUrl(tab)})`;
}
export function formatTabContent(tab) {
    return `
---
title: ${tab.title}
---
${tab.content}
`.trimStart();
}
export const uriTemplate = "tab://{windowId}/{tabId}";
export function formatUri(ref) {
    // TODO give domain & title for incremental search
    return `tab://${ref.windowId}/${ref.tabId}`;
}
