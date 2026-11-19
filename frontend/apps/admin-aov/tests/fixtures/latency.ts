/**
 * The answer time of a fake service, for tests about how many requests run at once or in what order answers arrive.
 * It never stands in for waiting on the page or a cache: wait for a condition with `waitFor`, let settled work finish
 * with `flush`, or move a debounce on with `mock.timers`.
 */
export const latency = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
