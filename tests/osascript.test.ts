import { beforeEach, describe, expect, test, vi } from "vitest";

const execFile = vi.fn();

vi.mock("child_process", () => ({ execFile }));

const { executeJXA, toScriptError } =
  await import("../src/browser/osascript.js");

describe("executeJXA", () => {
  beforeEach(() => {
    execFile.mockReset();
  });

  test("uses the configured timeout and does not retry when maxRetries is zero", async () => {
    execFile.mockImplementation((...args: unknown[]) => {
      const callback = args.at(-1) as (
        error: Error,
        stdout: string,
        stderr: string
      ) => void;
      callback(new Error("timed out"), "", "");
    });

    await expect(
      executeJXA("slow script", { timeout: 3000, maxRetries: 0 })
    ).rejects.toThrow("timed out");

    expect(execFile).toHaveBeenCalledTimes(1);
    expect(execFile.mock.calls[0][2]).toMatchObject({ timeout: 3000 });
  });

  test("does not retry an error the script raised itself", async () => {
    execFile.mockImplementation((...args: unknown[]) => {
      const callback = args.at(-1) as (
        error: Error,
        stdout: string,
        stderr: string
      ) => void;
      callback(
        Object.assign(new Error("Command failed"), {
          stderr:
            "execution error: Error: Error: Safari is not running. (-2700)\n",
        }),
        "",
        ""
      );
    });

    await expect(executeJXA("script", { retryDelay: 0 })).rejects.toThrow(
      "Safari is not running."
    );

    expect(execFile).toHaveBeenCalledTimes(1);
  });

  test("keeps the default retry behavior", async () => {
    execFile
      .mockImplementationOnce((...args: unknown[]) => {
        const callback = args.at(-1) as (
          error: Error,
          stdout: string,
          stderr: string
        ) => void;
        callback(new Error("transient failure"), "", "");
      })
      .mockImplementationOnce((...args: unknown[]) => {
        const callback = args.at(-1) as (
          error: null,
          result: { stdout: string; stderr: string }
        ) => void;
        callback(null, { stdout: " result \n", stderr: "" });
      });

    await expect(
      executeJXA("retryable script", { retryDelay: 0 })
    ).resolves.toBe("result");

    expect(execFile).toHaveBeenCalledTimes(2);
    expect(execFile.mock.calls[0][2]).toMatchObject({ timeout: 5000 });
  });
});

describe("toScriptError", () => {
  function execError(stderr: string, killed = false) {
    return Object.assign(new Error("Command failed: osascript <script>"), {
      stderr,
      killed,
    });
  }

  test("keeps only osascript's message and adds a hint for a known code", () => {
    const error = toScriptError(
      execError(
        "execution error: Error: Error: Application can't be found. (-2700)\n"
      ),
      5000
    );

    expect(error.message).toBe(
      "Application can't be found. (-2700)\n" +
        "Check that the browser is installed and --application-name matches its name."
    );
  });

  test("drops the code and hint from a script's own error, which shares -2700", () => {
    const error = toScriptError(
      execError(
        "execution error: Error: Error: Tabs kept changing while listing them (-2700)\n"
      ),
      5000
    );

    expect(error.message).toBe("Tabs kept changing while listing them");
  });

  test("keeps the message as is for an unknown code", () => {
    const error = toScriptError(
      execError("execution error: Error: Something else. (-9999)\n"),
      5000
    );

    expect(error.message).toBe("Something else. (-9999)");
  });

  test("reports a timeout with the time budget", () => {
    const error = toScriptError(execError("", true), 3000);

    expect(error.message).toContain("did not respond within 3000ms");
  });
});
