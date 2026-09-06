import { beforeEach, describe, expect, test, vi } from "vitest";

const execFile = vi.fn();

vi.mock("child_process", () => ({ execFile }));

const { executeJXA } = await import("../src/browser/osascript.js");

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
