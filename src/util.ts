import { Worker } from "worker_threads";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

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

interface DefuddleWorkerOutput {
  content: string | null;
  error?: string;
}

const WORKER_TIMEOUT_MS = 30000; // 30 seconds timeout

/**
 * Run Defuddle extraction in a worker thread to avoid blocking the main thread
 */
export async function runDefuddleInWorker(
  html: string,
  url: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const currentDir = dirname(fileURLToPath(import.meta.url));

    // Try to find the worker file in the current directory first (compiled dist/)
    let workerPath = join(currentDir, "defuddle-worker.js");

    // If not found, try the dist directory (when running from src in tests)
    if (!existsSync(workerPath)) {
      const distPath = join(currentDir, "..", "dist", "defuddle-worker.js");
      if (existsSync(distPath)) {
        workerPath = distPath;
      }
    }

    const worker = new Worker(workerPath, {
      workerData: { html, url },
    });

    // Set timeout for worker execution
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(
        new Error(
          `Worker timeout: Defuddle extraction took longer than ${WORKER_TIMEOUT_MS}ms`
        )
      );
    }, WORKER_TIMEOUT_MS);

    worker.on("message", (output: DefuddleWorkerOutput) => {
      clearTimeout(timeout);
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
      reject(error);
    });

    worker.on("exit", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}
