import type { ReactNode } from "react"
import type { PublishedGame, Seat, Side, TimelineEvent } from "@aov/community-contracts"
import { GameIcon } from "@aov/ui/components/game-icons"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { FoldButton } from "../../../components/fold-button"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { WatchLink } from "../../../components/watch-link"
import { timelineRows, type TimelineRow } from "../../../lib/series-model"
import { clock, referenceName } from "../../../lib/tournament-model"
import { useFold } from "../../../lib/use-fold"
import { momentAt } from "../../../lib/watch-rows"
import { timedGame } from "../../../lib/watch-story"
import { GameTrack, OBJECTIVE_ICONS, OBJECTIVE_NAMES } from "./game-track"
import { ReferenceArt } from "./reference-art"
import "./game-timeline.css"

/** Moments shown before the reader asks for the rest. */
const PREVIEW = 12

const seated = (game: PublishedGame, seat?: Seat | null) =>
  game.content.sides.find((item) => item.side === seat?.side)?.participants.find((item) => item.lane === seat?.lane)

/** The hero in a seat of the game, as its picture. */
function SeatArt({ game, seat }: { game: PublishedGame; seat?: Seat | null }) {
  const participant = seated(game, seat)
  return participant ? <ReferenceArt catalog={game.catalog} kind="heroes" selection={participant.hero} /> : null
}

/** What happened in a moment, with the team it belongs to, as it reads inside a sentence. */
function useMomentWords(game: PublishedGame) {
  const { text } = useStreamLocale()
  const heroOf = (seat?: Seat | null) =>
    referenceName(game.catalog, "heroes", seated(game, seat)?.hero, text("một tướng", "a hero"))
  const teamOf = (side: Side | null) => {
    const team = game.teams[game.content.sides.find((item) => item.side === side)?.teamId ?? ""]
    return team?.shortName || team?.name
  }
  return ({ event, side }: Pick<TimelineRow, "event" | "side">) => {
    if (event.kind === "KILL")
      return text(
        `${heroOf(event.killer)} hạ gục ${heroOf(event.victim)}`,
        `${heroOf(event.killer)} killed ${heroOf(event.victim)}`,
      )
    if (event.kind === "NOTE") return event.title || text("diễn biến", "a moment")
    const taken = text(...OBJECTIVE_NAMES[event.objective ?? "OTHER"])
    return [teamOf(side), taken.charAt(0).toLocaleLowerCase("vi-VN") + taken.slice(1)].filter(Boolean).join(" ")
  }
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
        <b className="tn-moment-taken">
          <StreamIcon name={OBJECTIVE_ICONS[event.objective ?? "OTHER"]} size={16} />
          {text(...OBJECTIVE_NAMES[event.objective ?? "OTHER"])}
        </b>
      </>
    )
  return <b>{event.title}</b>
}

/**
 * The moments of a game from the first to the last, each on the side of the team it belongs to, with the kills up to
 * then. Objectives alone are marks along the length of the game where the page is wide. Where every second of the game
 * is known in its video, a moment leads there. Nothing shows while none is recorded.
 */
export function GameTimeline({ game }: { game: PublishedGame }) {
  const { text } = useStreamLocale()
  const layout = usePageLayout()
  const wordsOf = useMomentWords(game)
  const rows = timelineRows(game)
  const fold = useFold(rows, PREVIEW, "moments")
  if (!rows.length) return null
  const { seriesId, number } = game.content
  const labelOf = timedGame(game)
    ? (row: Pick<TimelineRow, "event" | "side">) => {
        const [at, words] = [clock(row.event.atSeconds), wordsOf(row)]
        const label = text(`Xem lúc ${at}: ${words}`, `Watch at ${at}: ${words}`)
        return [label, row.event.note].filter(Boolean).join("\n")
      }
    : null
  const first = game.series.teamAId === game.content.sides.find((side) => side.side === "BLUE")?.teamId ? "BLUE" : "RED"
  const second = first === "BLUE" ? "RED" : "BLUE"
  if (layout === "wide" && rows.every(({ event, side }) => event.kind === "OBJECTIVE" && side))
    return (
      <section className="tn-block" aria-labelledby="game-timeline">
        <div className="tn-heading">
          <h2 id="game-timeline">{text("Diễn biến", "Timeline")}</h2>
        </div>
        <GameTrack game={game} rows={rows} order={[first, second]} labelOf={labelOf} />
      </section>
    )
  return (
    <section className="tn-block" aria-labelledby="game-timeline">
      <div className="tn-heading">
        <h2 id="game-timeline">{text("Diễn biến", "Timeline")}</h2>
      </div>
      <ol className="tn-moments">
        {fold.rows.map(({ event, side, kills }) => {
          const row: ReactNode = (
            <>
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
            </>
          )
          return (
            <li
              key={event.id}
              data-side={side ?? undefined}
              data-slot={side == null ? undefined : side === first ? "a" : "b"}
            >
              {labelOf ? (
                <WatchLink
                  seriesId={seriesId}
                  game={number}
                  at={momentAt(event)}
                  label={labelOf({ event, side })}
                  className="tn-moment-row"
                >
                  {row}
                </WatchLink>
              ) : (
                <span className="tn-moment-row">{row}</span>
              )}
            </li>
          )
        })}
      </ol>
      <FoldButton fold={fold} more={text(`Xem thêm ${fold.rest} diễn biến`, `Show ${fold.rest} more`)} />
    </section>
  )
}
