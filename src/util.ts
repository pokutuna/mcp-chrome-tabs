import { Worker } from "worker_threads";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

export async function withMockConsole<T>(
  fn: () => Promise<T>
): Promise<{ result: T; logs: unknown[][] }> {
  const originalConsoleLog = console.log;
  const logs: unknown[][] = [];
  console.log = (...args: unknown[]) => {
    logs.push(args);
  };
  try {
    const result = await fn();
    return { result, logs };
  } finally {
    console.log = originalConsoleLog;
  }
}

type DefuddleWorkerOutput =
  | { content: string; error?: never }
  | { content: null; error: string };

/**
 * Run Defuddle extraction in a worker thread to avoid blocking the main thread
 */
export async function runDefuddleInWorker(
  html: string,
  url: string,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const workerPath = join(currentDir, "defuddle-worker.js");

    const worker = new Worker(workerPath, {
      workerData: { html, url },
    });

    // Set timeout for worker execution
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(
        new Error(
          `Worker timeout: Defuddle extraction took longer than ${timeoutMs}ms`
        )
      );
    }, timeoutMs);

    worker.on("message", (output: DefuddleWorkerOutput) => {
      clearTimeout(timeout);
      worker.terminate();

      if (output.error) {
        reject(new Error(output.error));
      } else if (output.content) {
        resolve(output.content);
      } else {
        reject(new Error("Failed to parse the page content"));
      }
    });

    worker.on("error", (error) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(error);
    });
  });
}
