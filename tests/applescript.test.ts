import { describe, test, expect } from "vitest";
import { executeAppleScript } from "../src/browser/osascript.js";

describe("AppleScript Execution Environment", () => {
  test("osascript command is available", async () => {
    const result = await executeAppleScript('return "Hello World"');
    expect(result).toBe("Hello World");
  });
});
