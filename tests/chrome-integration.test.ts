import { test, expect } from "@playwright/test";
import { chromium, BrowserContext } from "playwright";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import { getChromeTabList, getPageContent, openURL } from "../src/chrome.js";

const execFileAsync = promisify(execFile);

/**
 * Chrome の統合テスト
 * 専用の Chrome プロファイルを使用してメインの Chrome をブロックしない
 */
test.describe("Chrome Integration Tests", () => {
  let context: BrowserContext;
  let testProfilePath: string;
  let chromeExecutablePath: string;

  test.beforeAll(async () => {
    // テスト用の固定プロファイル使用（Apple Events 設定を維持）
    testProfilePath = path.join(process.cwd(), "tests", "chrome-profile");

    // Chrome の実行可能ファイルパスを取得
    chromeExecutablePath =
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

    // Playwright で Chrome を起動 (テスト用プロファイル使用)
    context = await chromium.launchPersistentContext(testProfilePath, {
      executablePath: chromeExecutablePath,
      args: [
        "--no-default-browser-check",
        "--no-first-run",
        "--disable-default-apps",
        "--disable-extensions",
        "--remote-debugging-port=9222", // デバッグポート
        "--enable-apple-script", // Apple Events を有効化を試す
      ],
      headless: true, // headless モードで試してみる
    });
  });

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }

    // 固定プロファイルはクリーンアップしない（Apple Events 設定を保持）
    console.log("Chrome profile preserved at:", testProfilePath);
  });

  test("getChromeTabList should return tabs from multiple windows", async () => {
    // 第1ウィンドウに2つのタブを開く
    const page1_1 = await context.newPage();
    await page1_1.goto("http://example.com");
    await page1_1.waitForLoadState("networkidle");

    const page1_2 = await context.newPage();
    await page1_2.goto(
      "https://docs.anthropic.com/en/docs/claude-code/overview",
    );
    await page1_2.waitForLoadState("networkidle");

    // 第2ウィンドウを新しく作成して2つのタブを開く
    const context2 = await context.browser()?.newContext();
    if (!context2) throw new Error("Failed to create second context");

    const page2_1 = await context2.newPage();
    await page2_1.goto("https://cloud.google.com/vertex-ai/docs");
    await page2_1.waitForLoadState("networkidle");

    const page2_2 = await context2.newPage();
    await page2_2.goto("https://github.com/pokutuna/mcp-chrome-tabs");
    await page2_2.waitForLoadState("networkidle");

    const applicationName = "Google Chrome";

    // タブリストを取得
    const tabs = await getChromeTabList(applicationName);

    // 検証: 合計4つのタブが存在すること
    expect(tabs.length).toBeGreaterThanOrEqual(4);

    // 各ページが存在することを確認
    const exampleTab = tabs.find((tab) => tab.url.includes("example.com"));
    const anthropicTab = tabs.find((tab) =>
      tab.url.includes("docs.anthropic.com"),
    );
    const vertexTab = tabs.find((tab) => tab.url.includes("cloud.google.com"));
    const githubTab = tabs.find((tab) =>
      tab.url.includes("github.com/pokutuna"),
    );

    expect(exampleTab).toBeDefined();
    expect(anthropicTab).toBeDefined();
    expect(vertexTab).toBeDefined();
    expect(githubTab).toBeDefined();

    // タイトルの検証
    expect(exampleTab?.title).toContain("Example");
    expect(anthropicTab?.title).toContain("Claude Code");
    expect(vertexTab?.title).toContain("Vertex AI");
    expect(githubTab?.title).toContain("mcp-chrome-tabs");

    // 第2ウィンドウをクリーンアップ
    await context2.close();
  });

  test("getPageContent should extract content from test Chrome tab", async () => {
    // テスト用ページを開く
    const page = await context.newPage();
    await page.goto("http://example.com");
    await page.waitForLoadState("networkidle");

    const applicationName = "Google Chrome";

    // アクティブタブのコンテンツを取得
    const content = await getPageContent(applicationName);

    // 検証: URL とタイトルのみチェック
    expect(content.title).toContain("Example");
    expect(content.url).toBe("http://example.com/");
    expect(content.content).toBeTruthy(); // コンテンツが存在すること
  });

  test("getPageContent should work with specific tab reference", async () => {
    // 複数のテスト用ページを開く
    const page1 = await context.newPage();
    await page1.goto("https://docs.anthropic.com/en/docs/claude-code/overview");
    await page1.waitForLoadState("networkidle");

    const page2 = await context.newPage();
    await page2.goto("https://cloud.google.com/vertex-ai/docs");
    await page2.waitForLoadState("networkidle");

    const applicationName = "Google Chrome";

    // タブリストを取得
    const tabs = await getChromeTabList(applicationName);
    const vertexTab = tabs.find((tab) => tab.url.includes("cloud.google.com"));

    expect(vertexTab).toBeDefined();

    // 特定のタブのコンテンツを取得
    const content = await getPageContent(applicationName, vertexTab);

    // 検証: URL のみチェック（コンテンツは動的なため）
    expect(content.url).toContain("cloud.google.com");
    expect(content.content).toBeTruthy(); // コンテンツが存在すること
  });

  test("openURL should open new tab in test Chrome instance", async () => {
    const applicationName = "Google Chrome";
    const testUrl = "https://github.com/pokutuna/mcp-chrome-tabs";

    // 初期のタブ数を取得
    const initialTabs = await getChromeTabList(applicationName);
    const initialCount = initialTabs.length;

    // 新しい URL を開く
    await openURL(applicationName, testUrl);

    // 少し待ってからタブリストを再取得
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const updatedTabs = await getChromeTabList(applicationName);

    // 検証
    expect(updatedTabs.length).toBeGreaterThan(initialCount);
    const newTab = updatedTabs.find((tab) =>
      tab.url.includes("github.com/pokutuna"),
    );
    expect(newTab).toBeDefined();
    expect(newTab?.title).toContain("mcp-chrome-tabs");
  });

  test("should handle errors gracefully when tab is suspended", async () => {
    const applicationName = "Google Chrome";

    // 存在しないタブ ID でコンテンツ取得を試行
    const fakeTabRef = { windowId: "999", tabId: "999" };

    await expect(async () => {
      await getPageContent(applicationName, fakeTabRef);
    }).rejects.toThrow();
  });
});
