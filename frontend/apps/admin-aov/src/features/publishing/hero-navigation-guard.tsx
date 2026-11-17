import { useContext } from "react"
import { UNSAFE_DataRouterContext } from "react-router"
import { confirmDiscard } from "@/components/confirm-dialog"
import { useLeaveGuard } from "@/hooks/use-leave-guard"

export function HeroNavigationGuard({ unsafe, busy }: { unsafe: boolean; busy: boolean }) {
  const router = useContext(UNSAFE_DataRouterContext)
  return router && unsafe ? <HistoryGuard busy={busy} /> : null
}

function HistoryGuard({ busy }: { busy: boolean }) {
  // Explicit close controls already confirm; browser Back/Forward must protect the same edits.
  useLeaveGuard(
    ({ historyAction }) => historyAction === "POP",
    async () => !busy && confirmDiscard({ title: "Chuyển trang?", description: "Bạn có thay đổi chưa lưu." }),
  )
  return null
}
