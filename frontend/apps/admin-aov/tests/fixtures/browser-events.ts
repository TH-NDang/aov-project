import { flushSync } from "react-dom"

/**
 * Runs `run` with each event of `types` delivered the way a browser delivers it. A browser does the work each listener
 * left queued before it calls the next one, so a render that a listener of the page asks for runs before React's own
 * listener sees the event; jsdom calls the listeners one after the other. A listener on the root element of the page
 * stands in for that pause, right after the listeners of the document.
 */
export async function asBrowser<T>(types: readonly string[], run: () => Promise<T>): Promise<T> {
  const pause = () => flushSync(() => {})
  for (const type of types) document.documentElement.addEventListener(type, pause, true)
  try {
    return await run()
  } finally {
    for (const type of types) document.documentElement.removeEventListener(type, pause, true)
  }
}
