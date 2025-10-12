import { describe, it, expect } from "vitest";
import { runDefuddleInWorker } from "../src/util.js";

describe("runDefuddleInWorker", () => {
  it("should extract content from HTML using worker thread", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Test Page</title></head>
      <body>
        <h1>Test Heading</h1>
        <p>This is test content.</p>
      </body>
      </html>
    `;
    const url = "https://example.com/test";

    const content = await runDefuddleInWorker(html, url, 10000);

    expect(content).toBeTruthy();
    expect(content).toContain("Test Heading");
    expect(content).toContain("This is test content");
  });

  it("should handle empty HTML gracefully", async () => {
    // Empty HTML should be processed successfully (may return empty string)
    const html = "";
    const url = "https://example.com/empty";

    const content = await runDefuddleInWorker(html, url, 10000);
    expect(typeof content).toBe("string");
  });

  it("should timeout when processing takes too long", async () => {
    // Use a very large HTML to trigger timeout with short timeout duration
    const html =
      "<html><body>" + "<div>content</div>".repeat(100000) + "</body></html>";
    const url = "https://example.com/large";

    await expect(
      runDefuddleInWorker(html, url, 100) // 100ms timeout
    ).rejects.toThrow(/Worker timeout/);
  });

  it("should process multiple requests concurrently", async () => {
    const html1 = `
      <!DOCTYPE html>
      <html>
      <head><title>Page 1</title></head>
      <body>
        <article>
          <h1>Page 1</h1>
          <p>Content for page 1</p>
        </article>
      </body>
      </html>
    `;
    const html2 = `
      <!DOCTYPE html>
      <html>
      <head><title>Page 2</title></head>
      <body>
        <article>
          <h1>Page 2</h1>
          <p>Content for page 2</p>
        </article>
      </body>
      </html>
    `;

    const [content1, content2] = await Promise.all([
      runDefuddleInWorker(html1, "https://example.com/1", 10000),
      runDefuddleInWorker(html2, "https://example.com/2", 10000),
    ]);

    expect(content1).toContain("page 1");
    expect(content2).toContain("page 2");
  });
});
