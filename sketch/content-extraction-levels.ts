#!/usr/bin/env tsx

/**
 * Content Extraction Levels Verification Script
 *
 * Issue#9 の準備実装として、defuddle で取得できるコンテンツのバリエーションを検証する
 * 3つの異なる抽出レベルでのコンテンツを比較する:
 * - auto: defuddle による自動抽出 (現在の動作)
 * - text: DOM の textContent による生テキスト抽出
 * - html: 完全な HTML ソース
 */

import { Defuddle } from "defuddle/node";
import { JSDOM } from "jsdom";

interface ContentResult {
  level: "auto" | "text" | "html";
  content: string;
  size: number;
  preview: string;
}

/**
 * 異なる抽出レベルでコンテンツを処理する
 */
async function extractContentWithLevels(
  html: string,
  url: string
): Promise<ContentResult[]> {
  const results: ContentResult[] = [];

  // Level: auto (defuddle)
  try {
    const defuddleResult = await Defuddle(html, url, { markdown: true });
    const autoContent = defuddleResult?.content || "";
    results.push({
      level: "auto",
      content: autoContent,
      size: autoContent.length,
      preview: autoContent, // 全文表示
    });
  } catch (error) {
    const errorMessage = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
    results.push({
      level: "auto",
      content: errorMessage,
      size: 0,
      preview: errorMessage,
    });
  }

  // Level: text (textContent)
  try {
    const dom = new JSDOM(html);
    const textContent = dom.window.document.body?.textContent || "";
    results.push({
      level: "text",
      content: textContent,
      size: textContent.length,
      preview: textContent, // 全文表示
    });
  } catch (error) {
    const errorMessage = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
    results.push({
      level: "text",
      content: errorMessage,
      size: 0,
      preview: errorMessage,
    });
  }

  // Level: html (full HTML)
  const htmlContent = html;
  results.push({
    level: "html",
    content: htmlContent,
    size: htmlContent.length,
    preview:
      htmlContent.slice(0, 200) + (htmlContent.length > 200 ? "..." : ""), // preview のみ
  });

  return results;
}

/**
 * 現在のアクティブタブからコンテンツを取得する
 */
async function getCurrentTabContent(
  applicationName: string = "Google Chrome"
): Promise<{ title: string; url: string; html: string } | null> {
  try {
    const { chromeBrowser } = await import("../src/browser/chrome.js");
    const { title, url, content } = await chromeBrowser.getPageContent(
      applicationName,
      null
    );
    return { title, url, html: content };
  } catch (error) {
    console.error("❌ Error getting current tab content:", error);
    return null;
  }
}

/**
 * 結果を表示する
 */
function displayResults(sampleName: string, results: ContentResult[]): void {
  console.log(`\n━━━ ${sampleName} ━━━`);

  results.forEach((result) => {
    console.log(`\n📄 Level: ${result.level.toUpperCase()}`);
    console.log(`📏 Size: ${result.size} characters`);

    if (result.level === "html") {
      console.log(`👀 Preview:`);
      console.log(result.preview);
    } else {
      console.log(`📄 Content:`);
      console.log(result.preview); // auto と text は全文
    }

    console.log(`${"─".repeat(50)}`);
  });

  // サイズ比較
  const autoSize = results.find((r) => r.level === "auto")?.size || 0;
  const textSize = results.find((r) => r.level === "text")?.size || 0;
  const htmlSize = results.find((r) => r.level === "html")?.size || 0;

  console.log(`\n📊 Size Comparison:`);
  console.log(
    `   auto: ${autoSize} chars (${((autoSize / htmlSize) * 100).toFixed(1)}% of HTML)`
  );
  console.log(
    `   text: ${textSize} chars (${((textSize / htmlSize) * 100).toFixed(1)}% of HTML)`
  );
  console.log(`   html: ${htmlSize} chars (100.0% of HTML)`);
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  console.log("🔍 Content Extraction Levels Verification");
  console.log("Testing different content extraction approaches for issue#9\n");

  // 現在のタブからコンテンツを取得
  console.log("📱 Getting content from current tab...");
  const currentTab = await getCurrentTabContent();

  if (!currentTab) {
    console.error("❌ Could not get current tab content.");
    console.error("Please make sure:");
    console.error("   1. Chrome is running with an active tab");
    console.error(
      "   2. 'Allow JavaScript from Apple Events' is enabled in Chrome"
    );
    console.error("   3. The tab is not suspended or blank");
    process.exit(1);
  }

  console.log(`🌐 Current tab: ${currentTab.title}`);
  console.log(`🔗 URL: ${currentTab.url}\n`);

  try {
    const results = await extractContentWithLevels(
      currentTab.html,
      currentTab.url
    );
    displayResults("Current Tab", results);
  } catch (error) {
    console.error("❌ Error processing current tab:", error);
    process.exit(1);
  }

  console.log("\n✨ Verification complete!");
  console.log("\n💡 Key Observations:");
  console.log(
    "   - 'auto' level provides clean, readable content but may miss some information"
  );
  console.log(
    "   - 'text' level gives raw text without formatting, useful for fallback"
  );
  console.log(
    "   - 'html' level provides complete content but requires client-side processing"
  );
  console.log("\n📋 Next Steps:");
  console.log(
    "   1. Implement content_level parameter in read_tab_content tool"
  );
  console.log("   2. Add proper error handling for each extraction method");
  console.log("   3. Consider HTML sanitization for security");
  console.log("   4. Update tool schema and documentation");
}

// スクリプトとして直接実行された場合のみ main を呼び出す
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
}

export { extractContentWithLevels, getCurrentTabContent };
