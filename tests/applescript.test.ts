import { test, expect } from "vitest";
import { executeAppleScript } from "../src/browser/osascript.js";

test.skipIf(process.platform !== "darwin")(
  "apple script is available",
  async () => {
    const result = await executeAppleScript('return "Hello World"');
    expect(result).toBe("Hello World");
  }
);
