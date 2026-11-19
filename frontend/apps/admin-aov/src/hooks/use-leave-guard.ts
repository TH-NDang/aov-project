import { useEffect, useRef } from "react"
import { useBlocker, type BlockerFunction } from "react-router"

/**
 * Holds a navigation inside the app while `when` says so and asks what to do in the shared confirm dialog. `ask`
 * resolves true to let the navigation go on and false to stay; it may do more first, such as dropping the edits.
 * Needs the app's data router.
 */
export function useLeaveGuard(when: boolean | BlockerFunction, ask: () => Promise<boolean>) {
  const blocker = useBlocker(when)
  const latestAsk = useRef(ask)
  useEffect(() => {
    latestAsk.current = ask
  })

  useEffect(() => {
    if (blocker.state !== "blocked") return

    // The navigation stays blocked while the question is open; a later block or unmount makes this answer obsolete.
    let current = true
    void latestAsk.current().then((leave) => {
      if (!current) return
      if (leave) blocker.proceed()
      else blocker.reset()
    })
    return () => {
      current = false
    }
  }, [blocker])
}

/** Blocks only a navigation to another page, so changing the query string of the current one stays free. */
export const leavingPage =
  (dirty: boolean): BlockerFunction =>
  ({ currentLocation, nextLocation }) =>
    dirty && currentLocation.pathname !== nextLocation.pathname
