/**
 * Runs tasks a few at a time, oldest first, so a feed that auto-translates as it scrolls never fires a burst of
 * requests.
 */
export function createTaskQueue(limit: number) {
  let running = 0
  const waiting: (() => void)[] = []
  return async function queued<T>(task: () => Promise<T>): Promise<T> {
    if (running >= limit) await new Promise<void>((resolve) => waiting.push(resolve))
    running++
    try {
      return await task()
    } finally {
      running--
      waiting.shift()?.()
    }
  }
}
