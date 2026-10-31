import { CircleAlert, CircleCheck, Hourglass } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import type { MatchRecording, MatchRecordingState } from "../model/match-recording"
import { ProgressBadge } from "./game/progress-badge"

export const MATCH_STATE_LABELS: Record<MatchRecordingState, string> = {
  upcoming: "Chưa diễn ra",
  missing: "Cần bổ sung",
  unconfirmed: "Chờ xác nhận",
  complete: "Hoàn tất",
}

const STATE_ICONS = { missing: CircleAlert, unconfirmed: Hourglass, complete: CircleCheck } as const

/**
 * Recording status under a schedule line: each game's progress, games the score says are missing, and what is left
 * to do. Every part opens the match at the right game.
 */
export function MatchRecordingStrip({
  recording,
  onOpen,
}: {
  recording: MatchRecording
  onOpen: (gameId?: string) => void
}) {
  if (recording.state === "upcoming") return null
  const Icon = STATE_ICONS[recording.state]
  const recorded = new Set(recording.games.map((game) => game.number))
  // Games the score says were played but nobody recorded yet, numbered after the gaps.
  const missing = Math.max(0, (recording.expected ?? 0) - recording.games.length)
  const nextNumbers: number[] = []
  for (let number = 1; nextNumbers.length < missing; number++) if (!recorded.has(number)) nextNumbers.push(number)

  return (
    <div
      data-recording={recording.state}
      className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-dashed bg-muted/25 px-3 py-1.5 text-xs @lg:pl-[calc(92px+1.5rem)]"
      aria-label={`Tình trạng ghi: ${MATCH_STATE_LABELS[recording.state]}`}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
          recording.state === "missing" && "bg-destructive/10 text-destructive",
          recording.state === "unconfirmed" && "bg-[var(--esp-gold-soft)] text-[var(--esp-gold-text)]",
          recording.state === "complete" && "bg-[var(--esp-live)]/15 text-[var(--esp-live)]",
        )}
      >
        <Icon size={12} /> {MATCH_STATE_LABELS[recording.state]}
      </span>
      {recording.games.map((game) => (
        <button
          key={game.id}
          type="button"
          onClick={() => onOpen(game.id)}
          className="inline-flex items-center gap-1 rounded-full border bg-card py-0.5 pr-0.5 pl-1.5 font-semibold hover:bg-muted"
          aria-label={`Mở ván ${game.number}`}
        >
          V{game.number}
          <ProgressBadge progress={game.progress} />
        </button>
      ))}
      {nextNumbers.map((number) => (
        <button
          key={`absent-${number}`}
          type="button"
          onClick={() => onOpen()}
          className="rounded-full border border-dashed px-1.5 py-0.5 text-muted-foreground hover:bg-muted"
          title={`Ván ${number} chưa được ghi`}
        >
          V{number} chưa ghi
        </button>
      ))}
      {recording.gaps.length > 0 && (
        <ul className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          {recording.gaps.map((gap, index) => (
            <li key={index} className="flex items-center gap-2">
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
              <button
                type="button"
                onClick={() => onOpen(gap.gameId)}
                className={cn(
                  "text-left underline-offset-2 hover:underline",
                  gap.kind === "missing" ? "text-destructive" : "text-[var(--esp-gold-text)]",
                )}
              >
                {gap.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
