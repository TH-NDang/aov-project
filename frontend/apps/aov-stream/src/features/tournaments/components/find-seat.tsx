import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import type { HeroRole } from "../../../lib/finder-model"
import type { FeedHero } from "../../../lib/game-feed"
import { HeroPortrait } from "./hero-portrait"
import "./find-seat.css"

/** What became of a hero in each role, the words of the board. */
export const ROLE_NAMES: Record<HeroRole, readonly [string, string]> = {
  pick: ["Đội này chọn", "This side picked"],
  vs: ["Đối thủ chọn", "The opponent picked"],
  ban: ["Bị cấm", "Banned"],
  banA: ["Đội này cấm", "This side banned"],
  banB: ["Đối thủ cấm", "The opponent banned"],
}

/** What the next empty seat of a role is for. */
const ADD_NAMES: Record<HeroRole, readonly [string, string]> = {
  pick: ["Thêm tướng đội này chọn", "Add a hero this side picked"],
  vs: ["Thêm tướng đối thủ chọn", "Add a hero the opponent picked"],
  ban: ["Thêm tướng bị cấm", "Add a banned hero"],
  banA: ["Thêm tướng đội này cấm", "Add a hero this side banned"],
  banB: ["Thêm tướng đối thủ cấm", "Add a hero the opponent banned"],
}

/** The side a ban was made by, when the question says so. */
const BANNED_BY: Partial<Record<HeroRole, "a" | "b">> = { banA: "a", banB: "b" }

type SeatProps = { role: HeroRole; opened: boolean; onOpen: (seat: HTMLElement) => void }

/** A seat a hero was put on; it opens what can be asked of that hero. */
export function FilledSeat({ hero, role, opened, onOpen }: SeatProps & { hero: FeedHero }) {
  const { text } = useStreamLocale()
  const banned = role !== "pick" && role !== "vs"
  return (
    <button
      type="button"
      className="tn-find-seat"
      data-filled=""
      data-banned={banned || undefined}
      data-by={BANNED_BY[role]}
      aria-haspopup="dialog"
      aria-expanded={opened}
      aria-label={`${hero.name}, ${text(...ROLE_NAMES[role])}`}
      title={hero.name}
      onClick={(event) => onOpen(event.currentTarget)}
    >
      <HeroPortrait hero={hero} banned={banned} />
    </button>
  )
}

/** The next empty seat, which opens the choice of a hero. */
export function AddSeat({ role, opened, onOpen }: SeatProps) {
  const { text } = useStreamLocale()
  const label = text(...ADD_NAMES[role])
  return (
    <button
      type="button"
      className="tn-find-seat"
      data-add=""
      data-spot={`add-${role}`}
      aria-haspopup="dialog"
      aria-expanded={opened}
      aria-label={label}
      title={label}
      onClick={(event) => onOpen(event.currentTarget)}
    >
      <StreamIcon name="plus" size={18} />
    </button>
  )
}
