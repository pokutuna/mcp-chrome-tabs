import { Tab, TabRef, TabContent } from "./chrome.js";
export declare function formatTabRef(tab: Tab): string;
export declare function parseTabRef(tabRef: string): TabRef | null;
export declare function formatList(tabs: Tab[]): string;
export declare function formatListItem(tab: Tab): string;
export declare function formatTabContent(tab: TabContent): string;
export declare const uriTemplate = "tab://{windowId}/{tabId}";
export declare function formatUri(ref: TabRef): string;
