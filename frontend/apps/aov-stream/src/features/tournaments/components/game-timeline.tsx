import { useState } from "react"
import type { ObjectiveKind, PublishedGame, Seat, TimelineEvent } from "@aov/community-contracts"
import { GameIcon } from "@aov/ui/components/game-icons"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { timelineRows } from "../../../lib/series-model"
import { clock } from "../../../lib/tournament-model"
import { ReferenceArt } from "./reference-art"
import "./game-timeline.css"

/** Moments shown before the reader asks for the rest. */
const PREVIEW = 12

const OBJECTIVE_NAMES: Record<ObjectiveKind, readonly [string, string]> = {
  DARK_SLAYER: ["Hạ tà thần Caesar", "Took the Dark Slayer"],
  ABYSSAL_DRAGON: ["Hạ Rồng", "Took the Abyssal Dragon"],
  TURRET: ["Phá trụ", "Destroyed a tower"],
  BASE: ["Phá nhà chính", "Destroyed the base"],
  OTHER: ["Chiếm mục tiêu", "Took an objective"],
}

/** The hero in a seat of the game, as its picture. */
function SeatArt({ game, seat }: { game: PublishedGame; seat?: Seat | null }) {
  const side = seat && game.content.sides.find((item) => item.side === seat.side)
  const participant = side?.participants.find((item) => item.lane === seat?.lane)
  return participant ? <ReferenceArt catalog={game.catalog} kind="heroes" selection={participant.hero} /> : null
}

function Moment({ game, event }: { game: PublishedGame; event: TimelineEvent }) {
  const { text } = useStreamLocale()
  if (event.kind === "KILL")
    return (
      <>
        <SeatArt game={game} seat={event.killer} />
        <GameIcon name="crossed-swords" size={16} />
        <span className="sr-only">{text("hạ gục", "killed")}</span>
        <SeatArt game={game} seat={event.victim} />
        {!!event.assists?.length && (
          <span className="tn-moment-assists">
            {text("phụ trợ", "assisted by")}
            {event.assists.map((seat) => (
              <SeatArt key={`${seat.side}:${seat.lane}`} game={game} seat={seat} />
            ))}
          </span>
        )}
      </>
    )
  if (event.kind === "OBJECTIVE")
    return (
      <>
        <SeatArt game={game} seat={event.by} />
        <b>{text(...OBJECTIVE_NAMES[event.objective ?? "OTHER"])}</b>
      </>
    )
  return <b>{event.title}</b>
}

/**
 * The moments of a game from the first to the last, each on the side of the team it belongs to, with the kills up to
 * then. Nothing shows while none is recorded.
 */
export function GameTimeline({ game }: { game: PublishedGame }) {
  const { text } = useStreamLocale()
  const [open, setOpen] = useState(false)
  const rows = timelineRows(game)
  if (!rows.length) return null
  const shown = open ? rows : rows.slice(0, PREVIEW)
  const first = game.series.teamAId === game.content.sides.find((side) => side.side === "BLUE")?.teamId ? "BLUE" : "RED"
  const second = first === "BLUE" ? "RED" : "BLUE"
  return (
    <section className="tn-block" aria-labelledby="game-timeline">
      <div className="tn-heading">
        <h2 id="game-timeline">{text("Diễn biến", "Timeline")}</h2>
      </div>
      <ol className="tn-moments">
        {shown.map(({ event, side, kills }) => (
          <li
            key={event.id}
            data-side={side ?? undefined}
            data-slot={side == null ? undefined : side === first ? "a" : "b"}
          >
            <span className="tn-moment">
              <Moment game={game} event={event} />
              {event.note && <small>{event.note}</small>}
            </span>
            <span className="tn-moment-time">
              <time>{clock(event.atSeconds)}</time>
              {event.kind === "KILL" && (
                <small>
                  {kills[first]}–{kills[second]}
                </small>
              )}
            </span>
          </li>
        ))}
      </ol>
      {rows.length > PREVIEW && (
        <button type="button" className="tn-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open
            ? text("Thu gọn", "Show less")
            : text(`Xem thêm ${rows.length - PREVIEW} diễn biến`, `Show ${rows.length - PREVIEW} more`)}
          <StreamIcon name={open ? "chevronLeft" : "chevronRight"} size={14} />
        </button>
      )}
    </section>
  )
}
