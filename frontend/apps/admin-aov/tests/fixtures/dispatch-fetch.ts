/**
 * A global fetch that forwards to the one a test sets. Import it before any app module: the API clients keep the fetch
 * they find when they load, so a test that swaps `globalThis.fetch` later would never reach them.
 */
let current: typeof fetch = async (input) => {
  throw new Error(`No fetch is set for ${String(input)} in this test.`)
}

globalThis.fetch = ((input, init) => current(input, init)) as typeof fetch

/** Sets the fetch for the code under test; the returned function puts the previous one back. */
export function setFetch(next: typeof fetch) {
  const previous = current
  current = next
  return () => {
    current = previous
  }
}
