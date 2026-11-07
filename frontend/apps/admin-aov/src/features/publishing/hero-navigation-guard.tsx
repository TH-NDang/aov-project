import { useContext, useEffect } from "react"
import { UNSAFE_DataRouterContext, useBlocker } from "react-router"
import { confirmDiscard } from "@/components/confirm-dialog"

export function HeroNavigationGuard({ unsafe, busy }: { unsafe: boolean; busy: boolean }) {
  const router = useContext(UNSAFE_DataRouterContext)
  return router && unsafe ? <HistoryGuard busy={busy} /> : null
}

function HistoryGuard({ busy }: { busy: boolean }) {
  // Explicit close controls already confirm; browser Back/Forward must protect the same edits.
  const blocker = useBlocker(({ historyAction }) => historyAction === "POP")
  useEffect(() => {
    if (blocker.state !== "blocked") return
    if (busy) {
      blocker.reset()
      return
    }

    // The navigation stays blocked while the question is open; a later block or unmount makes this answer obsolete.
    let current = true
    void confirmDiscard({ title: "Chuyển trang?", description: "Bạn có thay đổi chưa lưu." }).then((leave) => {
      if (!current) return
      if (leave) blocker.proceed()
      else blocker.reset()
    })
    return () => {
      current = false
    }
  }, [blocker, busy])
  return null
}
