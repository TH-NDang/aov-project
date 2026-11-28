import { BAN_FACE } from "@aov/ui/components/draft-marks"
import { turnWords, type BoardSlot } from "../../components/game/draft-board"
import { HeroIcon } from "../../components/primitives"
import type { IconRef } from "../../model/game-view"
import type { GameDesk } from "../game-desk"

/** Viewing: every turn in its order, blue on the left and red on the right; a ban wears the look Stream gives it. */
export function TurnList({ desk, slots }: { desk: GameDesk; slots: BoardSlot[] }) {
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
          <TurnRow desk={desk} turn={turn} />
        </li>
      ))}
    </ol>
  )
}

function TurnRow({ desk, turn }: { desk: GameDesk; turn: BoardSlot }) {
  const team = desk.view.sides[turn.side].team
  const hero: IconRef | null = turn.hero
  const ban = turn.kind === "BAN"
  return (
    <span
      className="esp-turn-row"
      role="img"
      aria-label={`Lượt ${turn.order}, ${team.shortName} ${turnWords(turn.kind)} ${hero?.name ?? "không cấm"}`}
    >
      <span className="esp-turn-time">{turn.order}</span>
      <span className="esp-turn-what" data-side={turn.side} data-kind={turn.kind}>
        <span className={ban ? `esp-turn-face ${BAN_FACE}` : "esp-turn-face"} data-empty={(ban && !hero) || undefined}>
          <HeroIcon hero={hero} size={24} title="" className="rounded-md ring-2 ring-[var(--side)]" />
        </span>
        <span className="esp-turn-name">{hero?.name ?? "Không cấm"}</span>
      </span>
    </span>
  )
}
