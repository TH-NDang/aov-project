import { useContext } from "react"
import { UNSAFE_DataRouterContext } from "react-router"
import { leavingPage, useLeaveGuard } from "@/hooks/use-leave-guard"

/**
 * Asks before the reader moves to another page while `dirty`; changing the query string of the same page stays free.
 * Renders nothing outside the app's data router (tests and previews mount pages in a plain router).
 */
export function PageLeaveGuard({ dirty, ask }: { dirty: boolean; ask: () => Promise<boolean> }) {
  const router = useContext(UNSAFE_DataRouterContext)
  return router && dirty ? <Guard ask={ask} /> : null
}

function Guard({ ask }: { ask: () => Promise<boolean> }) {
  useLeaveGuard(leavingPage(true), ask)
  return null
}
