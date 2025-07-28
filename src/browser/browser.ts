export type Browser = "chrome" | "safari";

export type TabRef = { windowId: string; tabId: string };

export type Tab = TabRef & {
  title: string;
  url: string;
};

export type TabContent = {
  title: string;
  url: string;
  content: string;
};

export type BrowserInterface = {
  getTabList(applicationName: string): Promise<Tab[]>;
  getPageContent(
    applicationName: string,
    tab?: TabRef | null,
  ): Promise<TabContent>;
  openURL(applicationName: string, url: string): Promise<void>;
};

import { chromeBrowser } from "./chrome.js";
import { safariBrowser } from "./safari.js";

export function getInterface(browser: Browser): BrowserInterface {
  if (browser === "safari") {
    return safariBrowser;
  }
  return chromeBrowser;
}
