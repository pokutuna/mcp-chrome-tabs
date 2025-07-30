import { test as base, expect, devices } from "@playwright/test";
import { getInterface } from "../../src/browser/browser.js";

type MyFixtures = {
  applicationName: string;
};

const test = base.extend<MyFixtures>({
  context: async ({ playwright, browserName }, use) => {
    const context = await playwright[browserName].launchPersistentContext(
      "./tests/integration/chrome-profile",
      {
        // channel: "chrome",
        headless: false,
        ...devices["Desktop Chrome"],
      }
    );

    await use(context);

    await context.close();
  },
  applicationName: async ({ playwright, browserName }, use) => {
    const path =
      playwright[browserName].executablePath().split(".app")[0] + ".app";
    await use(path);
  },
});

test("getTabList", async ({ context, applicationName }) => {
  const pages = [
    "http://example.com",
    "https://github.com/pokutuna/mcp-chrome-tabs",
  ];
  for (const url of pages) {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }

  const browserInterface = getInterface("chrome");
  const tabs = await browserInterface.getTabList(applicationName);

  expect(tabs.length).toBeGreaterThanOrEqual(2);
  expect(tabs.find((t) => t.url.includes("example.com"))).toBeDefined();
  expect(
    tabs.find((t) => t.url.includes("github.com/pokutuna/mcp-chrome-tabs"))
  ).toBeDefined();
});

test("getTabContent with reference", async ({ context, applicationName }) => {
  const page = await context.newPage();
  await page.goto("http://example.com", { waitUntil: "domcontentloaded" });

  const browserInterface = getInterface("chrome");
  const tabs = await browserInterface.getTabList(applicationName);
  const tab = tabs.find((t) => t.url.includes("example.com"));
  expect(tab).toBeDefined();

  const content = await browserInterface.getPageContent(applicationName, {
    windowId: tab!.windowId,
    tabId: tab!.tabId,
  });
  expect(content).toHaveProperty("title");
  expect(content).toHaveProperty("url");
  expect(content).toHaveProperty("content");
});

test("getTabContent without reference", async ({
  context,
  applicationName,
}) => {
  const page = await context.newPage();
  await page.goto("http://example.com", { waitUntil: "domcontentloaded" });

  const browserInterface = getInterface("chrome");
  const content = await browserInterface.getPageContent(applicationName, null);
  expect(content).toHaveProperty("title");
  expect(content).toHaveProperty("url");
  expect(content).toHaveProperty("content");
});

test("openURL", async ({ applicationName }) => {
  const browserInterface = getInterface("chrome");
  await browserInterface.openURL(
    applicationName,
    "https://github.com/trending"
  );
  const tabs = await browserInterface.getTabList(applicationName);
  expect(tabs.some((t) => t.url.includes("github.com/trending"))).toBe(true);
});
