import { useState } from "react"
import { CircleCheck, CircleDashed, CircleDot, ChevronRight, Loader2, ShieldCheck } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@aov/ui/components/alert-dialog"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { missingFieldLabel } from "@/features/tournaments/tournament-model"
import type { GameView } from "../model/game-view"
import type { ProgressTarget, RecordingProgress, StepStatus } from "../model/recording-progress"
import { STATE_LABELS } from "../components/game/progress-badge"
import { RelativeDate } from "../components/relative-date"
import { formatClock } from "../model/vod"

const ICONS: Record<StepStatus, typeof CircleCheck> = { done: CircleCheck, partial: CircleDot, todo: CircleDashed }

/**
 * Recording checklist of one game. Each line opens the panel that fixes it; confirming publishes the game, which
 * freezes the data for the public site. Edits after that stay in the draft until the game is confirmed again.
 */
export function ProgressPanel({
  progress,
  game,
  publishedAt,
  canPublish,
  onOpen,
  onConfirm,
}: {
  progress: RecordingProgress
  game: GameView
  publishedAt?: string | null
  canPublish: boolean
  onOpen: (target: ProgressTarget) => void
  onConfirm: () => Promise<boolean>
}) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const complete = progress.done === progress.total
  const canConfirm = canPublish && complete && progress.state !== "confirmed"
  const winner = game.winner ? game.sides[game.winner].team.name : null

  return (
    <div className="space-y-4 p-4 text-sm">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{STATE_LABELS[progress.state]}</span>
          <span className="esp-num text-xs text-muted-foreground">
            {progress.done}/{progress.total} mục bắt buộc
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              progress.state === "confirmed" ? "bg-[var(--esp-live)]" : "bg-[var(--esp-gold)]",
            )}
            style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
          />
        </div>
        {publishedAt && (
          <p className="text-xs text-muted-foreground">
            Xác nhận gần nhất: <RelativeDate value={publishedAt} withTime />
            {progress.state === "changed" && " · bản công khai vẫn là bản đã xác nhận"}
          </p>
        )}
      </div>

      <ul className="divide-y rounded-xl border" aria-label="Các mục cần ghi">
        {progress.steps.map((step) => {
          const Icon = ICONS[step.status]
          return (
            <li key={step.id}>
              <button
                type="button"
                data-step={step.id}
                data-status={step.status}
                onClick={() => onOpen(step.target)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60"
              >
                <Icon
                  size={16}
                  className={cn(
                    "shrink-0",
                    step.status === "done" && "text-[var(--esp-live)]",
                    step.status === "partial" && "text-[var(--esp-gold)]",
                    step.status === "todo" && "text-muted-foreground",
                  )}
                  aria-label={{ done: "Đã xong", partial: "Một phần", todo: "Chưa ghi" }[step.status]}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    {step.label}
                    {step.required && step.status !== "done" && (
                      <span className="rounded bg-destructive/10 px-1 text-xs font-semibold text-destructive">
                        bắt buộc
                      </span>
                    )}
                    {!step.required && (
                      <span className="rounded bg-muted px-1 text-xs text-muted-foreground">tùy nguồn</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{step.detail}</span>
                </span>
                <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
              </button>
            </li>
          )
        })}
      </ul>

      {progress.missing.length > 0 && (
        <details className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium">Máy chủ còn báo thiếu {progress.missing.length} mục</summary>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-muted-foreground">
            {progress.missing.map((field, index) => (
              <li key={`${field}-${index}`}>{missingFieldLabel(field)}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="space-y-1.5 border-t pt-3">
        <Button className="w-full" disabled={!canConfirm || busy} onClick={() => setAsking(true)}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          {progress.state === "changed" ? `Xác nhận lại ván ${game.number}` : `Xác nhận hoàn tất ván ${game.number}`}
        </Button>
        <p className="text-xs text-muted-foreground">
          {!canPublish
            ? "Tài khoản chưa có quyền xác nhận (xuất bản) ván."
            : progress.state === "confirmed"
              ? "Ván đã được xác nhận; sửa tiếp sẽ cần xác nhận lại."
              : complete
                ? "Xác nhận sẽ xuất bản ván: dữ liệu được chốt và hiện ở trang công khai."
                : "Hoàn thành các mục bắt buộc để xác nhận. Mục “tùy nguồn” có thể để trống nếu video không hiển thị."}
        </p>
      </div>

      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận hoàn tất ván {game.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Dữ liệu sẽ được chốt và xuất bản. Rà lại lần cuối trước khi xác nhận.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Đội thắng</dt>
            <dd className="font-medium">{winner ?? "Chưa rõ"}</dd>
            <dt className="text-muted-foreground">Thời lượng</dt>
            <dd className="esp-num">{game.durationSeconds != null ? formatClock(game.durationSeconds) : "Chưa rõ"}</dd>
            {progress.steps
              .filter((step) => step.id !== "checks" && step.id !== "result")
              .map((step) => (
                <div key={step.id} className="contents">
                  <dt className="text-muted-foreground">{step.label}</dt>
                  <dd>{step.detail}</dd>
                </div>
              ))}
          </dl>
          <AlertDialogFooter>
            <AlertDialogCancel>Kiểm tra lại</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setBusy(true)
                await onConfirm()
                setBusy(false)
              }}
            >
              Xác nhận và xuất bản
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
