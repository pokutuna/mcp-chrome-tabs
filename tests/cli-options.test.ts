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
      target: { by: "id", id: "ID:1001:2001" },
      offset: 500,
    });
    expect(parsed.server.maxContentChars).toBe(1000);
  });

  it("reads the active tab only when asked with --active", () => {
    expect(parseCliArgs(["read", "--active"]).command).toEqual({
      name: "read",
      target: { by: "active" },
      offset: 0,
    });
    expect(() => parseCliArgs(["read"])).toThrow(
      "Specify a tab: pass an ID, -n <index>, or --active."
    );
  });

  it("rejects an empty ID rather than reading the active tab", () => {
    expect(() => parseCliArgs(["read", ""])).toThrow('Invalid tab ID: ""');
  });

  it("parses --index as an index reference", () => {
    const expected = {
      name: "read",
      target: { by: "index", index: 3 },
      offset: 0,
    };
    expect(parseCliArgs(["read", "--index=3"]).command).toEqual(expected);
    expect(parseCliArgs(["read", "-n", "3"]).command).toEqual(expected);
  });

  it("rejects more than one way of naming the tab", () => {
    for (const args of [
      ["read", "ID:1:2", "-n", "1"],
      ["read", "ID:1:2", "--active"],
      ["read", "-n", "1", "--active"],
    ]) {
      expect(() => parseCliArgs(args)).toThrow(
        "Pass only one of a tab ID, --index, or --active."
      );
    }
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

  it("rejects options that do not apply to the command", () => {
    expect(() => parseCliArgs(["list", "--offset=100"])).toThrow(
      "Option --offset does not apply to the list command."
    );
    expect(() => parseCliArgs(["read", "--active", "--include-url"])).toThrow(
      "Option --include-url does not apply to the read command."
    );
    expect(() =>
      parseCliArgs(["read", "--active", "--check-interval=3000"])
    ).toThrow("Option --check-interval does not apply to the read command.");
    expect(() => parseCliArgs(["-n", "1"])).toThrow(
      "Option --index does not apply to the MCP server."
    );
  });

  it("does not reject options when showing help", () => {
    expect(parseCliArgs(["list", "--offset=100", "--help"]).help).toBe(true);
  });

  it("rejects excess positional arguments", () => {
    expect(() => parseCliArgs(["read", "ID:1:2", "extra"])).toThrow(
      "The read command accepts at most one tab ID."
    );
  });
});
