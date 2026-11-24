import { useInfiniteQuery, useMutation } from "@tanstack/react-query"
import type { CompetitionPlan, CompetitionRevision } from "@aov/community-contracts"
import { RotateCcw } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { LocalTime } from "@aov/ui/components/local-time"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { confirmAction } from "@/components/confirm-dialog"
import { tournamentError } from "@/features/tournaments/api/tournament-api"
import { competitionApi, competitionKeys } from "../competition-api"
import { draftChanges, restoredPlan } from "../model/plan-draft"
import { Chip, type Tone, type Workspace } from "./parts"

const ACTIONS: Record<CompetitionRevision["action"], { label: string; tone: Tone }> = {
  SAVE: { label: "Lưu bản nháp", tone: "neutral" },
  MATERIALIZE: { label: "Mở nhập kết quả", tone: "info" },
  PUBLISH: { label: "Công bố", tone: "ok" },
  WITHDRAW: { label: "Gỡ công khai", tone: "warn" },
}

/**
 * Every saved state of the plan, newest first. Restoring one loads it into the draft as a single undoable step; it is
 * written only when the draft is saved, and matches that became real since then stay.
 */
export function PlanHistorySheet({
  ws,
  onRestore,
  onClose,
}: {
  ws: Workspace
  onRestore: (plan: CompetitionPlan) => void
  onClose: () => void
}) {
  const history = useInfiniteQuery({
    queryKey: competitionKeys.revisions(ws.access.actorKey, ws.entry.id),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => competitionApi.revisions(ws.entry.id, pageParam),
    getNextPageParam: nextPageOf,
  })
  const rows = history.data?.pages.flatMap((page) => page.items) ?? []
  const restore = useMutation({
    mutationFn: (id: string) => competitionApi.revision(ws.entry.id, id),
    meta: { silent: true },
  })
  const load = async (row: CompetitionRevision) => {
    const past = await restore.mutateAsync(row.id).catch(() => null)
    if (!past) return
    const plan = restoredPlan(ws.plan, past)
    const changes = draftChanges(ws.plan, plan, (id) => ws.team(id).name)
    const confirmed = await confirmAction({
      title: "Nạp lại bản này vào bản nháp?",
      description: changes.length
        ? changes.map((change) => change.text).join("; ") + "."
        : "Bản này giống hệt bản nháp đang mở.",
      confirmLabel: "Nạp lại",
      confirmDisabled: !changes.length,
      tone: "publish",
    })
    if (!confirmed) return
    onRestore(plan)
    onClose()
  }
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b p-6 pr-12">
          <SheetTitle className="type-section-title">Lịch sử bản nháp</SheetTitle>
          <SheetDescription className="sr-only">Các lần lưu kế hoạch của giải, mới nhất trước.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {history.isPending ? (
            <p className="type-meta p-6" role="status">
              Đang tải lịch sử…
            </p>
          ) : history.isLoadingError ? (
            <p className="type-body p-6 text-destructive" role="alert">
              {tournamentError(history.error)}
            </p>
          ) : !rows.length ? (
            <p className="type-body p-6 text-muted-foreground">Giải chưa có lần lưu nào.</p>
          ) : (
            <ol>
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-3 border-b px-6 py-3">
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Chip tone={ACTIONS[row.action].tone}>{ACTIONS[row.action].label}</Chip>
                      <LocalTime className="type-body" value={row.createdAt} />
                    </span>
                    <span className="type-meta block">
                      {row.entrants} đội · {row.stages} giai đoạn · {row.matches} trận
                    </span>
                  </span>
                  {ws.canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={restore.isPending}
                      onClick={() => void load(row)}
                    >
                      <RotateCcw aria-hidden /> Nạp lại
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          )}
          <InfiniteScroll query={history} label="Đang tải thêm" />
          {restore.error && (
            <p className="type-body p-6 text-destructive" role="alert">
              {tournamentError(restore.error)}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
