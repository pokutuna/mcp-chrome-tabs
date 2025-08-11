export type Browser = "chrome" | "safari" | "arc";

export type TabRef = { windowId: string; tabId: string };

export type Tab = TabRef & {
  title: string;
  url: string;
};

export type TabContent = {
  title: string;
  url: string;
  content: string; // Raw HTML content
};

export type BrowserInterface = {
  getTabList(applicationName: string): Promise<Tab[]>;
  getPageContent(
    applicationName: string,
    tab?: TabRef | null
  ): Promise<TabContent>;
  openURL(applicationName: string, url: string): Promise<void>;
};

import { chromeBrowser } from "./chrome.js";
import { safariBrowser } from "./safari.js";
import { arcBrowser } from "./arc.js";

export function getInterface(browser: Browser): BrowserInterface {
  if (browser === "safari") {
    return safariBrowser;
  }
  if (browser === "arc") {
    return arcBrowser;
  }
  return chromeBrowser;
}
