import { describe, it, expect } from "vitest";
import { formatListForCli, formatTabContent } from "../src/view.js";
import type { Tab, TabContent } from "../src/browser/browser.js";

describe("formatTabContent", () => {
  const mockTab: TabContent = {
    title: "Test Page",
    url: "https://example.com/test",
    content:
      "This is a very long content that should be truncated when the content character limit is applied. ".repeat(
        100
      ),
  };

  const shortTab: TabContent = {
    title: "Short Page",
    url: "https://example.com/short",
    content: "This is short content.",
  };

  describe("basic functionality", () => {
    it("should format tab content without pagination", () => {
      const result = formatTabContent(shortTab);
      expect(result).toContain("---");
      expect(result).toContain("url: https://example.com/short");
      expect(result).toContain("title: Short Page");
      expect(result).toContain("This is short content.");
    });

    it("should format tab content with unlimited page size", () => {
      const result = formatTabContent(mockTab);
      expect(result).toContain("---");
      expect(result).toContain("url: https://example.com/test");
      expect(result).toContain("title: Test Page");
      expect(result).toContain("This is a very long content");
    });
  });

  describe("pagination functionality", () => {
    it("should not truncate content when under content limit", () => {
      const result = formatTabContent(shortTab, 0, 1000);
      expect(result).not.toContain("truncated:");
      expect(result).not.toContain("Content truncated");
      expect(result).toContain("This is short content.");
    });

    it("should truncate content when over content limit", () => {
      const result = formatTabContent(mockTab, 0, 100);
      expect(result).toContain("Content truncated");
      expect(result).toContain("truncated: true");
      expect(result).toContain("startIndex of 100");
    });

    it("should handle startIndex correctly", () => {
      const result = formatTabContent(mockTab, 50, 100);
      expect(result).toContain("startIndex: 50");
      expect(result).toContain("truncated: true");
      expect(result).toContain("startIndex of 150");
    });

    it("should handle startIndex with no truncation needed", () => {
      const result = formatTabContent(shortTab, 5, 1000);
      expect(result).toContain("startIndex: 5");
      expect(result).not.toContain("truncated:");
      expect(result).not.toContain("next_start");
    });

    it("should handle edge case where content exactly matches limit", () => {
      const exactTab: TabContent = {
        ...shortTab,
        content: "a".repeat(100),
      };
      const result = formatTabContent(exactTab, 0, 100);
      expect(result).not.toContain("Content truncated");
      expect(result).not.toContain("truncated:");
    });

    it("should work with startIndex at end of content", () => {
      const contentLength = shortTab.content.length;
      const result = formatTabContent(shortTab, contentLength, 1000);
      expect(result).toContain("startIndex: " + contentLength);
      expect(result).not.toContain("truncated:");
    });
  });

  describe("front matter", () => {
    it("should include startIndex when startIndex > 0", () => {
      const result = formatTabContent(shortTab, 5);
      expect(result).toContain("startIndex: 5");
      expect(result).not.toContain("truncated:");
    });

    it("should include truncated when content is actually truncated", () => {
      const result = formatTabContent(mockTab, 0, 100);
      expect(result).toContain("truncated: true");
    });

    it("should not include pagination metadata for simple case", () => {
      const result = formatTabContent(shortTab);
      expect(result).not.toContain("startIndex:");
      expect(result).not.toContain("truncated:");
    });

    it("should not include truncated when maxContentChars is specified but no truncation occurs", () => {
      const result = formatTabContent(shortTab, 0, 1000);
      expect(result).not.toContain("truncated:");
    });

    it("should include both startIndex and truncated when both apply", () => {
      const result = formatTabContent(mockTab, 50, 100);
      expect(result).toContain("startIndex: 50");
      expect(result).toContain("truncated: true");
    });
  });

  describe("pagination end-to-end", () => {
    it("should allow reading entire long content through pagination", () => {
      // Create predictable content for testing
      const longContent = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(10); // 260 chars
      const longTab: TabContent = {
        title: "Long Content",
        url: "https://example.com/long",
        content: longContent,
      };

      const pageSize = 50;
      let collectedContent = "";
      let currentIndex = 0;
      let iterations = 0;
      const maxIterations = 10; // Safety guard

      // Read content page by page
      while (currentIndex < longContent.length && iterations < maxIterations) {
        const result = formatTabContent(longTab, currentIndex, pageSize);

        // Extract content portion (after front matter)
        const contentPart = result.split("\n---\n")[1];

        const isTruncated = result.includes("truncated: true");

        if (isTruncated) {
          // Find content before ERROR message
          const errorIndex = contentPart.indexOf("<ERROR>");
          const pageContent = contentPart.slice(0, errorIndex - 2); // Remove the \n\n before ERROR

          // Should be exactly pageSize characters
          expect(pageContent.length).toBe(pageSize);

          // Extract next startIndex from error message
          const nextIndexMatch = result.match(/startIndex of (\d+)/);
          expect(nextIndexMatch).toBeTruthy();
          const nextIndex = parseInt(nextIndexMatch![1]);
          expect(nextIndex).toBe(currentIndex + pageSize);

          collectedContent += pageContent;
          currentIndex = nextIndex;
        } else {
          // Last page - add remaining content
          const pageContent = contentPart;
          collectedContent += pageContent;
          break;
        }

        iterations++;
      }

      // Verify we read the entire content without loss
      expect(collectedContent).toBe(longContent);
      expect(iterations).toBeLessThan(maxIterations); // Ensure we didn't hit safety guard
    });
  });
});

describe("formatListForCli", () => {
  const tabs: Tab[] = [
    {
      windowId: "1001",
      tabId: "2001",
      title: "Example",
      url: "https://example.com/page",
    },
    {
      windowId: "1001",
      tabId: "2002",
      title: "テスト",
      url: "https://test.com:8080/a",
    },
  ];

  it("shows index, ID, title and domain per row", () => {
    const lines = formatListForCli(tabs).split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("[1]");
    expect(lines[0]).toContain("ID:1001:2001");
    expect(lines[0]).toContain("Example");
    expect(lines[0]).toContain("example.com");
    expect(lines[1]).toContain("[2]");
    expect(lines[1]).toContain("test.com:8080");
  });

  it("shows the full URL instead of the domain when includeUrl is set", () => {
    const lines = formatListForCli(tabs, true).split("\n");

    expect(lines[0]).toContain("https://example.com/page");
  });

  it("aligns the domain column across wide (CJK) titles", () => {
    const lines = formatListForCli(tabs).split("\n");
    const width = (text: string) =>
      [...text].reduce(
        (sum, char) =>
          sum +
          (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(char)
            ? 2
            : 1),
        0
      );

    const starts = lines.map((line) => {
      const domain = line.trimEnd().split(/\s+/).pop()!;
      return width(line.slice(0, line.lastIndexOf(domain)));
    });
    expect(starts[0]).toBe(starts[1]);
  });

  it("reports when no tabs are open", () => {
    expect(formatListForCli([])).toBe("No open tabs.");
  });
});
