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
