import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli-options.js";

describe("parseCliArgs", () => {
  it("starts the MCP server when no command is given", () => {
    const parsed = parseCliArgs([]);

    expect(parsed.command).toEqual({ name: "serve" });
    expect(parsed.server.applicationName).toBe("Google Chrome");
  });

  it("parses the list command", () => {
    const parsed = parseCliArgs([
      "list",
      "--include-url",
      "--exclude-hosts=example.com, test.com",
    ]);

    expect(parsed.command).toEqual({ name: "list", includeUrl: true });
    expect(parsed.server.excludeHosts).toEqual(["example.com", "test.com"]);
  });

  it("parses the read command with a tab ID and pagination", () => {
    const parsed = parseCliArgs([
      "read",
      "ID:1001:2001",
      "--offset=500",
      "--max-content-chars=1000",
    ]);

    expect(parsed.command).toEqual({
      name: "read",
      id: "ID:1001:2001",
      index: undefined,
      offset: 500,
    });
    expect(parsed.server.maxContentChars).toBe(1000);
  });

  it("reads the active tab when read has no ID", () => {
    expect(parseCliArgs(["read"]).command).toEqual({
      name: "read",
      id: undefined,
      index: undefined,
      offset: 0,
    });
  });

  it("parses --index as an index reference", () => {
    expect(parseCliArgs(["read", "--index=3"]).command).toEqual({
      name: "read",
      id: undefined,
      index: 3,
      offset: 0,
    });
    expect(parseCliArgs(["read", "-n", "3"]).command).toEqual({
      name: "read",
      id: undefined,
      index: 3,
      offset: 0,
    });
  });

  it("rejects an ID and --index together", () => {
    expect(() => parseCliArgs(["read", "ID:1:2", "-n", "1"])).toThrow(
      "Pass either a tab ID or --index, not both."
    );
  });

  it("rejects a non-positive or non-numeric index", () => {
    expect(() => parseCliArgs(["read", "-n", "0"])).toThrow(
      'Invalid --index option: "0"'
    );
    expect(() => parseCliArgs(["read", "-n", "abc"])).toThrow(
      'Invalid --index option: "abc"'
    );
  });

  it("rejects unknown commands", () => {
    expect(() => parseCliArgs(["open"])).toThrow("Unknown command: open");
  });

  it("rejects excess positional arguments", () => {
    expect(() => parseCliArgs(["read", "ID:1:2", "extra"])).toThrow(
      "The read command accepts at most one tab ID."
    );
  });
});
