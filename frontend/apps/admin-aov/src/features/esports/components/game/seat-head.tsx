import type { GameContent, Participant, Side } from "@aov/community-contracts"
import { Check, EyeOff, Users } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import type { ItemIndex } from "../../model/build"
import type { GameSeat, GameView } from "../../model/game-view"
import type { LoadoutPart } from "../../model/loadout"
import { participantAt } from "../../model/seat-changes"
import { SEAT_PARTS, partCount, partState, seatState } from "../../model/seat-progress"
import type { SeatKey } from "../../model/timeline"
import { HeroIcon } from "../primitives"
import { SeatDots } from "./seat-dots"
import "./seat-head.css"

const SIDES: readonly Side[] = ["BLUE", "RED"]

/** The ten players of the game, blue then red, with how far each is recorded; the way back to both teams comes first. */
export function SeatStrip({
  game,
  content,
  index,
  chosen,
  onChoose,
  onBack,
}: {
  game: GameView
  content: GameContent
  index: ItemIndex
  chosen: SeatKey
  onChoose: (seat: SeatKey) => void
  onBack: () => void
}) {
  const face = (seat: GameSeat) => {
    const participant = participantAt(content, seat.key)
    const name = `${seat.playerName}, ${seat.hero?.name ?? "chưa có tướng"}`
    return (
      <button
        key={seat.key}
        type="button"
        className="esp-ten-seat"
        data-ten-seat={seat.key}
        aria-pressed={seat.key === chosen}
        aria-label={participant ? `${name}: ${seatState(participant, content.durationSeconds, index)}` : name}
        title={name}
        onClick={() => onChoose(seat.key)}
      >
        <HeroIcon hero={seat.hero} size={34} title="" className="aspect-square h-auto! w-full! rounded-md" />
        {participant && <SeatDots participant={participant} duration={content.durationSeconds} index={index} />}
      </button>
    )
  }
  return (
    <div className="esp-ten" role="group" aria-label="Tuyển thủ của ván">
      <Button type="button" size="icon-sm" variant="ghost" aria-label="Cả hai đội" title="Cả hai đội" onClick={onBack}>
        <Users aria-hidden />
      </Button>
      {SIDES.map((side) => (
        <span key={side} className="esp-ten-side" data-side={side}>
          {game.sides[side].seats.map(face)}
        </span>
      ))}
    </div>
  )
}

const PART_NAMES: Record<LoadoutPart, string> = {
  spell: "Phụ trợ",
  enchantments: "Phù hiệu",
  arcana: "Ngọc",
  equipment: "Trang bị",
}

/** The parts of a player, one on screen at a time, with how much of each is recorded. */
export function SeatParts({
  participant,
  duration,
  index,
  open,
  onOpen,
}: {
  participant: Participant
  /** How long the game lasted, when known. */
  duration?: number | null
  index: ItemIndex
  open: LoadoutPart
  onOpen: (part: LoadoutPart) => void
}) {
  return (
    <nav className="esp-seat-parts type-body" aria-label="Phần của tuyển thủ">
      {SEAT_PARTS.map((part) => {
        const state = partState(participant, part, duration, index)
        const count = partCount(participant, part, duration, index)
        return (
          <button
            key={part}
            type="button"
            className="esp-tab"
            aria-pressed={part === open}
            onClick={() => onOpen(part)}
          >
            {PART_NAMES[part]}
            {count && <span className="esp-tab-count type-meta esp-num">{count}</span>}
            {state === "hidden" && <EyeOff size={12} aria-label="không hiển thị" />}
            {part === "spell" && state === "done" && <Check size={12} aria-label="đã ghi" />}
          </button>
        )
      })}
    </nav>
  )
}
