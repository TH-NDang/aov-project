import { useState } from "react"
import type { Side } from "@aov/community-contracts"
import { Clock3, Crown, Save } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { cn } from "@aov/ui/lib/utils"
import type { GameView } from "../../model/game-view"
import { formatClock, parseClock } from "../../model/vod"
import { TeamLogo, TimeTag, VIDEO_MARK, VideoMark } from "../primitives"
import type { VideoClock } from "./event-composer"

/** Closes a game: who won and where it ends in the broadcast (or its length when the game has no video). */
export function ResultPanel({
  game,
  video,
  onSave,
}: {
  game: GameView
  video?: VideoClock
  onSave: (result: { winner: Side | null; durationSeconds: number | null }) => void
}) {
  const [winner, setWinner] = useState<Side | null>(game.winner)
  const known = game.durationSeconds
  const [time, setTime] = useState(
    video
      ? formatClock(known != null ? video.toVideo(known) : (video.now ?? 0))
      : known != null
        ? formatClock(known)
        : "",
  )
  const typed = parseClock(time)
  const converted = typed === null ? null : video ? video.toGame(typed) : typed
  const duration = converted === null || converted <= 0 ? null : Math.round(converted)

  return (
    <form
      className="space-y-4 p-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault()
        onSave({ winner, durationSeconds: duration })
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground">Đội thắng ván {game.number}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["BLUE", "RED"] as const).map((side) => (
            <button
              key={side}
              type="button"
              data-side={side}
              aria-pressed={winner === side}
              onClick={() => setWinner(winner === side ? null : side)}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-l-4 border-l-[var(--side)] px-3 py-2 text-left transition",
                winner === side ? "border-[var(--esp-gold)] bg-[var(--esp-gold-soft)]" : "hover:bg-muted",
              )}
            >
              <TeamLogo team={game.sides[side].team} size={26} />
              <span className="min-w-0 flex-1 truncate font-semibold">{game.sides[side].team.name}</span>
              {winner === side && <Crown size={15} className="text-[var(--esp-gold)]" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {video ? (
            <>
              <VideoMark /> Ván kết thúc tại (mốc video)
            </>
          ) : (
            "⏱ Thời lượng ván"
          )}
        </span>
        <span className="flex gap-2">
          <Input
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className="esp-num h-8"
            aria-invalid={!!time.trim() && duration === null}
          />
          {video && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setTime(formatClock(video.now ?? 0))}
              disabled={video.now === null}
            >
              <Clock3 size={13} /> Hiện tại ({VIDEO_MARK} {formatClock(video.now)})
            </Button>
          )}
        </span>
        <span className="block text-[11px] text-muted-foreground">
          {duration !== null ? (
            <>
              Thời lượng ván <TimeTag kind="game" seconds={duration} className="text-foreground" />
            </>
          ) : time.trim() ? (
            <span className="text-destructive">Mốc này chưa nằm sau lúc ván bắt đầu.</span>
          ) : (
            "Để trống nếu chưa rõ."
          )}
        </span>
      </label>
      <div className="flex justify-end border-t pt-3">
        <Button type="submit" size="sm" disabled={!!time.trim() && duration === null}>
          <Save size={14} /> Lưu kết quả
        </Button>
      </div>
    </form>
  )
}
