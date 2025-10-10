import { parentPort, workerData } from "worker_threads";
import { Defuddle } from "defuddle/node";

// This worker executes Defuddle extraction in a separate thread
// to avoid blocking the main thread during CPU-intensive parsing

interface WorkerInput {
  html: string;
  url: string;
}

interface WorkerOutput {
  content: string | null;
  error?: string;
}

if (!parentPort) {
  throw new Error("This module must be run as a worker thread");
}

const input: WorkerInput = workerData;

// Mock console.log to suppress Defuddle's internal logging
const originalConsoleLog = console.log;
const logs: unknown[][] = [];
console.log = (...args: unknown[]) => {
  logs.push(args);
};

try {
  const result = await Defuddle(input.html, input.url, {
    markdown: true,
  });

  const output: WorkerOutput = {
    content: result?.content || null,
  };

  parentPort.postMessage(output);
} catch (error) {
  const output: WorkerOutput = {
    content: null,
    error: error instanceof Error ? error.message : String(error),
  };

  parentPort.postMessage(output);
} finally {
  console.log = originalConsoleLog;
}
