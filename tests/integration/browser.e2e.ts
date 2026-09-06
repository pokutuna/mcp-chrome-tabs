import { test as base, expect, devices } from "@playwright/test";
import { getInterface, BrowserInterface } from "../../src/browser/browser.js";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type MyFixtures = {
  applicationName: string;
  browserInterface: BrowserInterface;
  testMarker: string;
};

function appBundlePath(executablePath: string): string {
  const macOSDirectory = path.dirname(executablePath);
  const contentsDirectory = path.dirname(macOSDirectory);
  return path.resolve(path.dirname(contentsDirectory));
}

async function assertBrowserIsNotRunning(
  executablePath: string
): Promise<void> {
  const executableName = path.basename(executablePath);
  try {
    await execFileAsync("pgrep", ["-x", executableName]);
  } catch (error: unknown) {
    // pgrep exits with status 1 when no process matches.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 1
    ) {
      return;
    }
    throw new Error(
      `Unable to check whether ${executableName} is running before the E2E test. ` +
        "Run this test on macOS with pgrep available.",
      { cause: error }
    );
  }

  throw new Error(
    `${executableName} is already running. Quit the Playwright test browser before ` +
      "running the browser integration tests; normal Google Chrome can remain open."
  );
}

async function getBundledBrowserExecutable(
  executablePath: string
): Promise<string> {
  try {
    await access(executablePath);
  } catch (error: unknown) {
    throw new Error(
      `Playwright's bundled Chromium browser was not found at ${executablePath}. ` +
        "Install it with `npx playwright install chromium` before running E2E tests.",
      { cause: error }
    );
  }
  return executablePath;
}

// The E2E fixture targets Chrome; Safari and Arc require browser-specific manual checks.
const test = base.extend<MyFixtures>({
  context: async ({ playwright, headless, testMarker }, use) => {
    const executablePath = await getBundledBrowserExecutable(
      playwright.chromium.executablePath()
    );
    await assertBrowserIsNotRunning(executablePath);
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const profilePath = path.resolve(__dirname, "chrome-profile");
    const context = await playwright.chromium.launchPersistentContext(
      profilePath, // Preferences enables JavaScript from Apple Events
      {
        ...devices["Desktop Chrome"],
        executablePath,
        headless,
      }
    );
    try {
      const markerUrl = `https://mcp-chrome-tabs-e2e.invalid/${encodeURIComponent(testMarker)}`;
      await context.route(markerUrl, (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: `<title>${testMarker}</title><p>E2E marker</p>`,
        })
      );
      const markerPage = await context.newPage();
      await markerPage.goto(markerUrl, { waitUntil: "domcontentloaded" });
      await markerPage.bringToFront();
      await use(context);
    } finally {
      await context.close();
    }
  },
  browserInterface: async ({ context, applicationName, testMarker }, use) => {
    const browser = getInterface("chrome");
    const tabs = await browser.getTabList(applicationName);
    const markerUrl = `https://mcp-chrome-tabs-e2e.invalid/${encodeURIComponent(testMarker)}`;
    if (
      !context.pages().some((page) => page.url() === markerUrl) ||
      !tabs.some((tab) => tab.url === markerUrl)
    ) {
      throw new Error(
        `Test Chrome marker ${testMarker} was not found through getTabList; ` +
          "refusing to operate on an unknown Chrome process."
      );
    }
    await use(browser);
  },
  applicationName: async ({ playwright }, use) => {
    await use(appBundlePath(playwright.chromium.executablePath()));
  },
  testMarker: async ({}, use) => {
    await use(`mcp-chrome-tabs-e2e-${process.pid}-${Date.now()}`);
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
  const tabRef = await browserInterface.openURL(
    applicationName,
    "https://github.com/trending"
  );

  // Verify that openURL returns a TabRef with windowId and tabId
  expect(tabRef).toHaveProperty("windowId");
  expect(tabRef).toHaveProperty("tabId");
  expect(typeof tabRef.windowId).toBe("string");
  expect(typeof tabRef.tabId).toBe("string");

  await expect(async () => {
    const tabs = await browserInterface.getTabList(applicationName);
    // Verify the tab exists in the tab list
    expect(tabs.some((t) => t.url.includes("github.com/trending"))).toBe(true);

    // Verify the returned TabRef matches a tab in the list
    const matchingTab = tabs.find(
      (t) => t.windowId === tabRef.windowId && t.tabId === tabRef.tabId
    );
    expect(matchingTab).toBeDefined();
    expect(matchingTab?.url).toContain("github.com/trending");
  }).toPass();

  // Test that we can immediately read content from the returned tab reference
  const content = await browserInterface.getPageContent(
    applicationName,
    tabRef
  );
  expect(content).toHaveProperty("title");
  expect(content).toHaveProperty("url");
  expect(content).toHaveProperty("content");
  expect(content.url).toContain("github.com/trending");
});
