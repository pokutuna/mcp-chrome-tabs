import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export function escapeAppleScript(str: string): string {
  // https://discussions.apple.com/thread/4247426?sortBy=rank
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

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
      if (attempt === maxRetries) {
        console.error("retry failed after maximum attempts:", error);
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay * Math.pow(2, attempt))
      );
    }
  }
  throw new Error("unreachable");
}

export async function executeAppleScript(script: string): Promise<string> {
  return retry(async () => {
    const { stdout, stderr } = await execFileAsync(
      "osascript",
      ["-e", script],
      {
        timeout: 5 * 1000,
        maxBuffer: 5 * 1024 * 1024, // 5MB
      }
    );
    if (stderr) console.error("AppleScript stderr:", stderr);
    return stdout.trim();
  });
}

export function separator(): string {
  const uniqueId = Math.random().toString(36).substring(2);
  return `<|SEP:${uniqueId}|>`;
}

export async function executeTabCreationScript(
  _applicationName: string,
  url: string,
  makeTabScript: (escapedUrl: string, sep: string) => string
): Promise<{ windowId: string; tabId: string }> {
  const escapedUrl = escapeAppleScript(url);
  const sep = separator();
  const appleScript = makeTabScript(escapedUrl, sep);
  const result = await executeAppleScript(appleScript);
  const [windowId, tabId] = result.trim().split(sep);
  return { windowId, tabId };
}
