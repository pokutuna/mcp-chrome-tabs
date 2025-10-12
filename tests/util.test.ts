import { describe, it, expect } from "vitest";
import { withMockConsole, runDefuddleInWorker } from "../src/util.js";

describe("withMockConsole", () => {
  it("should capture console.log calls and return the result", async () => {
    const testFunction = async () => {
      console.log("test message", 123);
      console.log("another message");
      return "result";
    };

    const { result, logs } = await withMockConsole(testFunction);

    expect(result).toBe("result");
    expect(logs).toHaveLength(2);
    expect(logs[0]).toEqual(["test message", 123]);
    expect(logs[1]).toEqual(["another message"]);
  });

  it("should restore original console.log after execution", async () => {
    const originalLog = console.log;

    await withMockConsole(async () => {
      console.log("captured");
      return null;
    });

    expect(console.log).toBe(originalLog);
  });

  it("should restore console.log even if function throws", async () => {
    const originalLog = console.log;

    try {
      await withMockConsole(async () => {
        console.log("before error");
        throw new Error("test error");
      });
    } catch (error) {
      // Expected to throw
    }

    expect(console.log).toBe(originalLog);
  });

  it("should propagate errors from the wrapped function", async () => {
    const testFunction = async () => {
      console.log("before error", "arg");
      throw new Error("test error");
    };
    await expect(withMockConsole(testFunction)).rejects.toThrow("test error");
  });

  it("should handle functions with no console.log calls", async () => {
    const { result, logs } = await withMockConsole(async () => {
      return "no logs";
    });

    expect(result).toBe("no logs");
    expect(logs).toHaveLength(0);
  });
});

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

  it("should handle errors from worker thread", async () => {
    // Empty HTML should still work, but if Defuddle fails it should propagate
    const html = "";
    const url = "https://example.com/empty";

    // Should either return content or throw an error
    try {
      const content = await runDefuddleInWorker(html, url, 10000);
      expect(typeof content).toBe("string");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
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
