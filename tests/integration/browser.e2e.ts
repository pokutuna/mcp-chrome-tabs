import { test as base, expect, devices } from "@playwright/test";
import { getInterface, BrowserInterface } from "../../src/browser/browser.js";
import path from "path";
import { fileURLToPath } from "url";

type MyFixtures = {
  applicationName: string;
  browserInterface: BrowserInterface;
};

// Note: Safari support could be implemented, but Playwright's webkit cannot execute AppleScript
const test = base.extend<MyFixtures>({
  context: async ({ playwright, browserName }, use) => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const profilePath = path.resolve(__dirname, "chrome-profile");
    const context = await playwright[browserName].launchPersistentContext(
      profilePath, // to keep AppleScript enabled
      {
        ...devices["Desktop Chrome"],
        channel: "chrome",
      }
    );
    await use(context);
    await context.close();
  },
  browserInterface: async ({}, use) => {
    const browser = getInterface("chrome");
    await use(browser);
  },
  applicationName: async ({}, use) => {
    await use("Google Chrome");
  },
});

test("getTabList", async ({ context, applicationName, browserInterface }) => {
  const pages = [
    "http://example.com",
    "https://github.com/pokutuna/mcp-chrome-tabs",
  ];
  for (const url of pages) {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }

  await expect(async () => {
    const tabs = await browserInterface.getTabList(applicationName);
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    expect(tabs.find((t) => t.url.includes("example.com"))).toBeDefined();
    expect(
      tabs.find((t) => t.url.includes("github.com/pokutuna/mcp-chrome-tabs"))
    ).toBeDefined();
  }).toPass();
});

test("getTabContent with reference", async ({
  context,
  applicationName,
  browserInterface,
}) => {
  const page = await context.newPage();
  await page.goto("http://example.com", { waitUntil: "domcontentloaded" });

  const tabs = await browserInterface.getTabList(applicationName);
  const tab = tabs.find((t) => t.url.includes("example.com"));
  expect(tab).toBeDefined();
  if (!tab) throw new Error("Tab not found");

  const content = await browserInterface.getPageContent(applicationName, {
    windowId: tab.windowId,
    tabId: tab.tabId,
  });
  expect(content).toHaveProperty("title");
  expect(content).toHaveProperty("url");
  expect(content).toHaveProperty("content");
});

test("getTabContent without reference", async ({
  context,
  applicationName,
  browserInterface,
}) => {
  const page = await context.newPage();
  await page.goto("http://example.com", { waitUntil: "domcontentloaded" });

  const content = await browserInterface.getPageContent(applicationName, null);
  expect(content).toHaveProperty("title");
  expect(content).toHaveProperty("url");
  expect(content).toHaveProperty("content");
});

test("openURL", async ({ applicationName, browserInterface }) => {
  await browserInterface.openURL(
    applicationName,
    "https://github.com/trending"
  );

  await expect(async () => {
    const tabs = await browserInterface.getTabList(applicationName);
    expect(tabs.some((t) => t.url.includes("github.com/trending"))).toBe(true);
  }).toPass();
});
