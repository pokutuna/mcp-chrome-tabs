import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli-options.js";

describe("parseCliArgs", () => {
  it("starts the MCP server when no command is given", () => {
    const parsed = parseCliArgs([]);

    expect(parsed.command).toEqual({ name: "serve" });
    expect(parsed.server.applicationName).toBe("Google Chrome");
  });

  it("parses the list command", () => {
    const parsed = parseCliArgs(
      ["list", "--include-url", "--exclude-hosts=example.com, test.com"],
      {}
    );

    expect(parsed.command).toEqual({ name: "list", includeUrl: true });
    expect(parsed.server.excludeHosts).toEqual(["example.com", "test.com"]);
  });

  it("excludes the hosts in the environment variable as well", () => {
    const env = { MCP_CHROME_TABS_EXCLUDE_HOSTS: "mail.test, example.com" };

    expect(parseCliArgs(["list"], env).server.excludeHosts).toEqual([
      "mail.test",
      "example.com",
    ]);
    expect(
      parseCliArgs(["--exclude-hosts=example.com,bank.test"], env).server
        .excludeHosts
    ).toEqual(["mail.test", "example.com", "bank.test"]);
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
      "Specify a tab: pass an ID, an INDEX, or --active."
    );
  });

  it("takes a bare number as an INDEX", () => {
    expect(parseCliArgs(["read", "3"]).command).toEqual({
      name: "read",
      target: { by: "index", index: 3 },
      offset: 0,
    });
  });

  it("rejects a tab argument that is neither an ID nor an INDEX", () => {
    // "" must not fall through to the active tab
    for (const arg of ["", "0", "-1", "1.5", "abc", "1001:2001"]) {
      expect(() => parseCliArgs(["read", "--", arg])).toThrow(
        `Invalid tab: "${arg}"`
      );
    }
  });

  it("rejects a tab together with --active", () => {
    expect(() => parseCliArgs(["read", "1", "--active"])).toThrow(
      "Pass either a tab ID or INDEX, or --active, not both."
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
    expect(() => parseCliArgs(["--active"])).toThrow(
      "Option --active does not apply to the MCP server."
    );
  });

  it("does not reject options when showing help", () => {
    expect(parseCliArgs(["list", "--offset=100", "--help"]).help).toBe(true);
  });

  it("rejects excess positional arguments", () => {
    expect(() => parseCliArgs(["read", "ID:1:2", "extra"])).toThrow(
      "The read command accepts at most one tab."
    );
  });
});
