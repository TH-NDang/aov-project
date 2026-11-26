import { useState } from "react"
import type { GameContent } from "@aov/community-contracts"
import { CircleCheck, CircleDashed, CircleDot, ChevronRight, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { gameFieldWords } from "@/features/tournaments/model/game-field-words"
import type { GameView } from "../model/game-view"
import type { ProgressStep, RecordingProgress, StepStatus } from "../model/recording-progress"
import { STATE_LABELS } from "../components/game/progress-badge"
import { RelativeDate } from "../components/relative-date"
import { formatClock } from "@/lib/clock"
import { confirmAction } from "@/components/confirm-dialog"

const ICONS: Record<StepStatus, typeof CircleCheck> = { done: CircleCheck, partial: CircleDot, todo: CircleDashed }

/** What will be published: the result, the length and each recorded part, for a last look. */
function PublishSummary({ progress, game }: { progress: RecordingProgress; game: GameView }) {
  const winner = game.winner ? game.sides[game.winner].team.name : null
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
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
  )
}

/**
 * Recording checklist of one game. Each line opens the tool that fixes it; publishing freezes the data for the public
 * site. Edits after that stay in the draft until the game is published again.
 */
export function ProgressPanel({
  progress,
  game,
  content,
  publishedAt,
  canPublish,
  onOpen,
  onConfirm,
}: {
  progress: RecordingProgress
  game: GameView
  /** What the fields the service reports are read against. */
  content: Pick<GameContent, "sides">
  publishedAt?: string | null
  canPublish: boolean
  onOpen: (step: ProgressStep) => void
  onConfirm: () => Promise<boolean>
}) {
  const [busy, setBusy] = useState(false)
  const complete = progress.done === progress.total
  const canConfirm = canPublish && progress.publishable && progress.state !== "confirmed"
  const gaps = progress.steps.filter((step) => step.required && step.status !== "done")

  const confirm = async () => {
    const accepted = await confirmAction({
      title: complete ? `Xuất bản ván ${game.number}?` : `Xuất bản ván ${game.number} khi còn thiếu?`,
      description: complete
        ? "Dữ liệu được chốt và hiện ở trang công khai. Rà lại lần cuối trước khi xuất bản."
        : `Trang công khai ghi phần còn thiếu là chưa rõ: ${gaps.map((step) => (step.gap ?? step.label).toLocaleLowerCase("vi")).join(", ")}. Bổ sung sau thì xuất bản lại.`,
      details: <PublishSummary progress={progress} game={game} />,
      confirmLabel: "Xuất bản",
      cancelLabel: "Kiểm tra lại",
      tone: "publish",
    })
    if (!accepted) return

    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-3 text-sm">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{STATE_LABELS[progress.state]}</span>
          <span className="esp-num text-xs text-muted-foreground">
            {progress.done}/{progress.total} mục cần ghi
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              progress.state === "confirmed" ? "bg-[var(--esp-live)]" : "bg-foreground",
            )}
            style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
          />
        </div>
        {publishedAt && (
          <p className="text-xs text-muted-foreground">
            Xuất bản gần nhất: <RelativeDate value={publishedAt} withTime inSentence />
            {progress.state === "changed" && ", trang công khai vẫn hiện bản đó"}
          </p>
        )}
      </div>

      <ul className="divide-y border-b" aria-label="Các mục cần ghi">
        {progress.steps.map((step) => {
          const Icon = ICONS[step.status]
          return (
            <li key={step.id}>
              <button
                type="button"
                data-step={step.id}
                data-status={step.status}
                onClick={() => onOpen(step)}
                className="flex w-full items-center gap-2.5 py-2 text-left hover:bg-muted/60"
              >
                <Icon
                  size={16}
                  className={cn(
                    "shrink-0",
                    step.status === "done" && "text-[var(--esp-live)]",
                    step.status === "partial" && "text-foreground",
                    step.status === "todo" && "text-muted-foreground",
                  )}
                  aria-label={{ done: "Đã xong", partial: "Một phần", todo: "Chưa ghi" }[step.status]}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    {step.label}
                    {step.blocks && step.status !== "done" && (
                      <span className="rounded bg-destructive/10 px-1 text-xs font-semibold text-destructive">
                        bắt buộc
                      </span>
                    )}
                    {step.required && !step.blocks && step.status !== "done" && (
                      <span className="rounded bg-(--aov-warning-soft) px-1 text-xs font-semibold text-(--aov-warning)">
                        nên có
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
              <li key={`${field}-${index}`}>{gameFieldWords(field, content)}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="space-y-1.5 border-t pt-3">
        <Button variant="outline" className="w-full" disabled={!canConfirm || busy} onClick={() => void confirm()}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          {progress.state === "changed" ? `Xuất bản lại ván ${game.number}` : `Xuất bản ván ${game.number}`}
        </Button>
        <p className="text-xs text-muted-foreground">
          {!canPublish
            ? "Tài khoản chưa có quyền xuất bản ván."
            : progress.state === "confirmed"
              ? "Ván đã xuất bản; sửa tiếp thì cần xuất bản lại."
              : complete
                ? "Dữ liệu được chốt và hiện ở trang công khai."
                : progress.publishable
                  ? "Ván xuất bản được. Mục “nên có” còn trống hiện là chưa rõ ở trang công khai."
                  : "Hoàn thành các mục bắt buộc để xuất bản. Các mục khác để trống được nếu video không hiển thị."}
        </p>
      </div>
    </div>
  )
}
