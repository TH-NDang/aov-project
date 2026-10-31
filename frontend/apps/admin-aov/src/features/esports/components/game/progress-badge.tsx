import { CircleDot, ShieldCheck, TriangleAlert } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import type { RecordingProgress, RecordingState } from "../../model/recording-progress"

export const STATE_LABELS: Record<RecordingState, string> = {
  recording: "Đang ghi",
  ready: "Đủ dữ liệu · chờ xác nhận",
  confirmed: "Đã xác nhận",
  changed: "Có thay đổi chưa xác nhận",
}

/** Compact state marker for a game chip: what is recorded and whether it was confirmed. */
export function ProgressBadge({ progress, className }: { progress: RecordingProgress; className?: string }) {
  const { state, done, total } = progress
  return (
    <span
      data-state={state}
      title={`${STATE_LABELS[state]} · ${done}/${total} mục bắt buộc`}
      className={cn(
        "esp-num inline-flex items-center gap-0.5 rounded-full px-1.5 text-xs font-semibold",
        className,
        state === "confirmed" && "bg-[var(--esp-live)]/15 text-[var(--esp-live)]",
        state === "ready" && "bg-[var(--esp-gold-soft)] text-[var(--esp-gold-text)]",
        state === "changed" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
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
      {state === "confirmed" ? "Đã xác nhận" : `${done}/${total}`}
    </span>
  )
}
