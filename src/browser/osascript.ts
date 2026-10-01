import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Embeds a value into JXA source as a JSON literal, so that user input cannot
// break out of the surrounding script syntax.
export function jsonLiteral(value: unknown): string {
  return JSON.stringify(value);
}

// JXA that binds `app` to the application. macOS launches an application that
// is not running as soon as it receives an Apple Event, so a read checks
// running() first, which sends none, and reports the browser instead.
export function bindApplication(
  applicationName: string,
  { launch = false }: { launch?: boolean } = {}
): string {
  const notRunning = jsonLiteral(`${applicationName} is not running.`);
  return `
    const app = Application(${jsonLiteral(applicationName)});
    ${launch ? "" : `if (!app.running()) throw new Error(${notRunning});`}
  `;
}

// An error the script raised itself, such as a browser that is not running.
// Running the script again would raise it again.
export class ScriptRaisedError extends Error {}

export async function retry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    retryDelay?: number;
  }
): Promise<T> {
  const { maxRetries = 1, retryDelay = 1000 } = options || {};
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      // The caller reports the error; logging it here would repeat it
      if (attempt === maxRetries || error instanceof ScriptRaisedError) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay * Math.pow(2, attempt))
      );
    }
  }
  throw new Error("unreachable");
}

// Hints for the errors users can act on. The original message and code are
// kept in front of the hint so that the error stays searchable.
const errorHints: Record<number, string> = {
  [-1743]:
    "Not permitted to control the browser. Allow it in System Settings > Privacy & Security > Automation.",
  [-2700]:
    "Check that the browser is installed and --application-name matches its name.",
  [-1728]:
    "The window or tab was not found. It may have been closed; list the tabs again for current IDs.",
  [-600]: "The browser is not running.",
};

// execFile's error embeds the whole script; keep only what osascript reported
export function toScriptError(error: unknown, timeoutMs: number): Error {
  const e = error as { killed?: boolean; stderr?: string };
  if (e.killed) {
    return new Error(
      `The browser did not respond within ${timeoutMs}ms. A suspended or unresponsive tab can cause this.`,
      { cause: error }
    );
  }
  const match = e.stderr?.match(/execution error: (.*)/);
  if (!match) return error instanceof Error ? error : new Error(String(error));

  // JXA reports errors as "Error: Error: <message> (<code>)"
  const message = match[1].replace(/^(Error: )+/, "").trim();
  const code = Number(message.match(/\((-?\d+)\)$/)?.[1]);
  // A JXA `throw new Error(...)` of our own is also reported as -2700. Its
  // code and hint are about a missing application, so both are dropped.
  if (code === -2700 && !message.includes("can't be found")) {
    return new ScriptRaisedError(message.replace(/ \(-2700\)$/, ""), {
      cause: error,
    });
  }
  const hint = errorHints[code];
  return new Error(hint ? `${message}\n${hint}` : message, { cause: error });
}

async function runOsascript(
  args: string[],
  timeoutMs: number
): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync("osascript", args, {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    if (stderr) console.error("osascript stderr:", stderr);
    return stdout.trim();
  } catch (error) {
    throw toScriptError(error, timeoutMs);
  }
}

export type ExecuteJXAOptions = {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
};

export async function executeJXA(
  script: string,
  options: ExecuteJXAOptions = {}
): Promise<string> {
  return retry(
    () =>
      runOsascript(
        ["-l", "JavaScript", "-e", script],
        options.timeout ?? 5 * 1000
      ),
    options
  );
}
