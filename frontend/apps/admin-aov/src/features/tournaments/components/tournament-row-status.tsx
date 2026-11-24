import type { TournamentContent, TournamentStatus } from "@aov/community-contracts"
import { AlertTriangle, EyeOff, Globe } from "lucide-react"
import { StatusPill } from "@/features/esports/components/primitives"
import { STATUS_LABELS } from "@/features/esports/model/labels"
import { statusConflict } from "../model/tournament-status"

/**
 * A tournament's status with what an editor checks beside it: whether readers see it on Stream, and a mark when its
 * dates contradict the status. An editor gets the status the dates say as one button, which asks first.
 */
export function TournamentRowStatus({
  content,
  published,
  onFix,
}: {
  content: TournamentContent
  /** Undefined while it is not known. */
  published?: boolean
  onFix?: (status: TournamentStatus) => void
}) {
  const conflict = statusConflict(content)
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <StatusPill status={content.status} />
      {published !== undefined && (
        <span className="type-meta inline-flex items-center gap-1.5">
          {published ? (
            <Globe aria-hidden="true" className="size-3.5 shrink-0 text-(--aov-success)" />
          ) : (
            <EyeOff aria-hidden="true" className="size-3.5 shrink-0" />
          )}
          {published ? "Công khai trên Stream" : "Chưa công khai"}
        </span>
      )}
      {conflict && (
        <span className="type-meta flex flex-wrap items-center gap-x-1.5 rounded-md bg-(--aov-warning-soft) px-2 py-1 text-(--aov-warning)">
          <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
          {conflict.reason}
          {onFix && (
            <button
              type="button"
              onClick={() => onFix(conflict.status)}
              className="rounded underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Đổi thành {STATUS_LABELS[conflict.status]}
            </button>
          )}
        </span>
      )}
    </div>
  )
}
