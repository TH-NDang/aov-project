import { CircleDot, ShieldCheck, TriangleAlert } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import type { RecordingProgress, RecordingState } from "../../model/recording-progress"

export const STATE_LABELS: Record<RecordingState, string> = {
  recording: "Đang ghi",
  ready: "Đủ dữ liệu, chờ xuất bản",
  confirmed: "Đã xuất bản",
  changed: "Đã sửa sau khi xuất bản",
}

/** Compact state marker for a game chip: what is recorded and whether it is published. */
export function ProgressBadge({ progress, className }: { progress: RecordingProgress; className?: string }) {
  const { state, done, total } = progress
  return (
    <span
      data-state={state}
      title={`${STATE_LABELS[state]}, ${done}/${total} mục cần ghi`}
      className={cn(
        "esp-num inline-flex items-center gap-0.5 rounded-full px-1.5 text-xs font-semibold",
        className,
        state === "confirmed" && "bg-[var(--esp-live)]/15 text-[var(--esp-live)]",
        state === "ready" && "bg-[var(--esp-gold-soft)] text-[var(--esp-gold-text)]",
        state === "changed" && "bg-(--aov-warning-soft) text-(--aov-warning)",
        state === "recording" && "bg-muted text-muted-foreground",
      )}
    >
      {state === "confirmed" ? (
        <ShieldCheck size={11} />
      ) : state === "changed" ? (
        <TriangleAlert size={11} />
      ) : (
        <CircleDot size={11} />
      )}
      {state === "confirmed" ? STATE_LABELS.confirmed : `${done}/${total}`}
    </span>
  )
}
