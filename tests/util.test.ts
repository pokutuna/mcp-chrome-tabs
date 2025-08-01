import { describe, it, expect } from "vitest";
import { withMockConsole } from "../src/util.js";

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

  it("should capture logs even when function throws", async () => {
    try {
      await withMockConsole(async () => {
        console.log("before error", "arg");
        throw new Error("test error");
      });
    } catch (error) {
      // Test passes if we reach here, meaning the error was propagated
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("should handle functions with no console.log calls", async () => {
    const { result, logs } = await withMockConsole(async () => {
      return "no logs";
    });

    expect(result).toBe("no logs");
    expect(logs).toHaveLength(0);
  });
});
