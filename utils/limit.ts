/** Returns a wrapper that runs at most `max` async tasks at a time, in order. */
export function createLimiter(max: number) {
  const waiting: (() => void)[] = [];
  let running = 0;

  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (running >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    running++;
    try {
      return await task();
    } finally {
      running--;
      waiting.shift()?.();
    }
  };
}
