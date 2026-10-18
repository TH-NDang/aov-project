import { useContext, useEffect } from "react"
import { UNSAFE_DataRouterContext, useBlocker } from "react-router"

export function HeroNavigationGuard({ unsafe, busy }: { unsafe: boolean; busy: boolean }) {
  const router = useContext(UNSAFE_DataRouterContext)
  return router && unsafe ? <HistoryGuard busy={busy} /> : null
}

function HistoryGuard({ busy }: { busy: boolean }) {
  // Explicit close controls already confirm; browser Back/Forward must protect the same edits.
  const blocker = useBlocker(({ historyAction }) => historyAction === "POP")
  useEffect(() => {
    if (blocker.state !== "blocked") return
    if (!busy && window.confirm("Bạn có thay đổi chưa lưu. Bỏ thay đổi và chuyển trang?")) blocker.proceed()
    else blocker.reset()
  }, [blocker, busy])
  return null
}
