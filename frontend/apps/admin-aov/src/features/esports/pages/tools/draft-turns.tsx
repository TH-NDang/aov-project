import { formatClock } from "@/lib/clock"
import { turnWords, type BoardSlot } from "../../components/game/draft-board"
import { usePlayheadValue } from "../../components/game/use-playhead"
import { HeroIcon } from "../../components/primitives"
import { atVideo } from "../../model/game-times"
import type { IconRef } from "../../model/game-view"
import { placeAt } from "../../model/playback-place"
import type { GameDesk } from "../game-desk"

/** Viewing: every turn at its second of the video, blue on the left and red on the right. */
export function TurnList({ desk, slots }: { desk: GameDesk; slots: BoardSlot[] }) {
  const now = usePlayheadValue(desk.playhead, (second) => {
    const place = placeAt([desk.chapter], second)
    return place.kind === "draft" ? Math.floor(second) : null
  })
  const turns = slots.filter((slot) => slot.order !== null && slot.recorded)
  if (!turns.length)
    return (
      <p className="esp-draft-line-note">
        {slots.some((slot) => slot.hero) ? "Chưa ghi thứ tự cấm chọn." : "Chưa ghi cấm chọn của ván này."}
      </p>
    )
  return (
    <ol className="esp-turns" aria-label="Các lượt cấm chọn">
      {turns.map((turn) => (
        <li key={turn.index}>
          <TurnRow desk={desk} turn={turn} later={now !== null && turn.atSecond !== null && turn.atSecond > now} />
        </li>
      ))}
    </ol>
  )
}

function TurnRow({ desk, turn, later }: { desk: GameDesk; turn: BoardSlot; later: boolean }) {
  const team = desk.view.sides[turn.side].team
  const hero: IconRef | null = turn.hero
  const words = `${turnWords(turn.kind)} ${hero?.name ?? ""}`
  const body = (
    <>
      <span className="esp-turn-time">
        {turn.order}
        {turn.atSecond !== null && ` ${atVideo(turn.atSecond)}`}
      </span>
      <span className="esp-turn-what" data-side={turn.side} data-kind={turn.kind}>
        <HeroIcon hero={hero} size={24} title="" className="rounded-md ring-2 ring-[var(--side)]" />
        <span className="esp-turn-name">{hero?.name ?? "Không cấm"}</span>
      </span>
    </>
  )
  const label = `Lượt ${turn.order}, ${team.shortName} ${words}`
  if (turn.atSecond === null)
    return (
      <span className="esp-turn-row" data-later={later || undefined} role="img" aria-label={label}>
        {body}
      </span>
    )
  return (
    <button
      type="button"
      className="esp-turn-row"
      data-later={later || undefined}
      aria-label={`${label} lúc ${formatClock(turn.atSecond)} của video`}
      onClick={() => desk.seekVideo(turn.atSecond!)}
    >
      {body}
    </button>
  )
}
