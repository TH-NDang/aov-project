import { useContext } from "react"
import { UNSAFE_DataRouterContext } from "react-router"
import { confirmDiscard } from "@/components/confirm-dialog"
import { useLeaveGuard } from "@/hooks/use-leave-guard"

export function HeroNavigationGuard({ unsafe, busy }: { unsafe: boolean; busy: boolean }) {
  const router = useContext(UNSAFE_DataRouterContext)
  return router && unsafe ? <HistoryGuard busy={busy} /> : null
}

function HistoryGuard({ busy }: { busy: boolean }) {
  // Browser Back/Forward and any move to another page (the sidebar, the breadcrumb) protect the unsaved edits.
  useLeaveGuard(
    ({ historyAction, currentLocation, nextLocation }) =>
      historyAction === "POP" || currentLocation.pathname !== nextLocation.pathname,
    async () => !busy && confirmDiscard({ title: "Chuyển trang?", description: "Bạn có thay đổi chưa lưu." }),
  )
  return null
}
