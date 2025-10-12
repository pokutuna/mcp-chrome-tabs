import { parentPort, workerData } from "worker_threads";
import { Defuddle } from "defuddle/node";

// This worker executes Defuddle extraction in a separate thread
// to avoid blocking the main thread during CPU-intensive parsing

if (!parentPort) {
  throw new Error("This module must be run as a worker thread");
}

const input = workerData;

try {
  const result = await Defuddle(input.html, input.url, {
    markdown: true,
  });

  const output = {
    content: result?.content || null,
  };

  parentPort.postMessage(output);
} catch (error) {
  const output = {
    content: null,
    error: error instanceof Error ? error.message : String(error),
  };

  parentPort.postMessage(output);
}
