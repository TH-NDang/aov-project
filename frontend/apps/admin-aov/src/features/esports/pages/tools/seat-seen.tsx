import type { Participant } from "@aov/community-contracts"
import { X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { formatClock } from "@/lib/clock"
import { usePlayheadValue } from "../../components/game/use-playhead"
import { atVideo } from "../../model/game-times"
import type { LoadoutPart } from "../../model/loadout"
import { MARK_LABELS } from "../../model/observation-marks"
import { seenAt, withSeen } from "../../model/seat-changes"
import type { GameDesk } from "../game-desk"

/**
 * Changes the player on screen; without words of its own the change is said by what it did. Answers whether it was
 * saved, or nothing when it changed nothing.
 */
export type UpdateSeat = (
  change: (participant: Participant) => Participant,
  text?: string,
) => Promise<boolean> | undefined

type SeenPart = Exclude<LoadoutPart, "equipment">

const seenSecond = (participant: Participant, part: SeenPart) =>
  (part === "spell" ? participant.spellObservedAtSeconds : participant[part].observedAtSeconds) ?? null

/** When the video showed the part on screen: the way there, and the second on screen taken for it. */
export function Seen({
  desk,
  participant,
  part,
  onUpdate,
}: {
  desk: GameDesk
  participant: Participant
  part: LoadoutPart
  onUpdate: UpdateSeat
}) {
  const now = usePlayheadValue(desk.playhead, Math.floor)
  if (part === "equipment") return null
  const { chapter } = desk
  const second = seenSecond(participant, part)
  const what = MARK_LABELS[part]
  const set = (value: number | null) => onUpdate((current) => withSeen(current, part, value))
  const take = () => {
    const seen = seenAt(chapter, desk.markNow() ?? now)
    if (seen.refusal === null) void set(seen.second)
    else desk.say(seen.refusal)
  }
  const refusal = seenAt(chapter, now).refusal
  return (
    <span className="esp-seen">
      {second !== null && (
        <>
          <span className="esp-seen-words">thấy lúc</span>
          {chapter.live ? (
            <button
              type="button"
              className="esp-seen-time"
              aria-label={`Tới lúc video hiện ${what}, ${formatClock(second)}`}
              title={`Tới lúc video hiện ${what}`}
              onClick={() => desk.seekGame(second)}
            >
              {formatClock(second)}
            </button>
          ) : (
            // Before its 0:00 a game has no second of the video to go to.
            <span className="esp-num font-semibold text-foreground">{formatClock(second)}</span>
          )}
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={`Bỏ mốc ${what}`}
            title={`Bỏ mốc ${what}`}
            onClick={() => set(null)}
          >
            <X aria-hidden />
          </Button>
        </>
      )}
      {desk.videoId !== null && (
        <Button
          type="button"
          size="xs"
          variant="secondary"
          className="esp-num aria-disabled:opacity-50"
          aria-label={`Lấy ${atVideo(now)} làm lúc video hiện ${what}`}
          aria-disabled={refusal ? true : undefined}
          title={refusal ?? `Video hiện ${what} ở giây này`}
          onClick={take}
        >
          Lấy {atVideo(now)}
        </Button>
      )}
    </span>
  )
}
