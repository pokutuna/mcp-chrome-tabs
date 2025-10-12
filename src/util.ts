import { Worker } from "worker_threads";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

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
      stdout: true, // Don't pipe worker stdout to parent
      stderr: true, // Don't pipe worker stderr to parent
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
      } else if (output.content != null) {
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
