import { Link } from "react-router"
import { useQueries } from "@tanstack/react-query"
import type { CompetitionView } from "@aov/community-contracts"
import { circuitsToAsk, titleList, titleShelves, type Shelf, type Title, type TitleEntry } from "../lib/title-model"
import { circuitCompetitionsQuery } from "../lib/tournament-api"
import { useNow } from "../lib/use-now"
import { dayRange } from "./community-ui"
import { Stage } from "./stage"
import { StreamImage } from "./stream-image"
import { useStreamLocale } from "./stream-locale"
import { Trophy, TrophyPaints } from "./trophy"
import "./title-shelf.css"

const SHELF_NAMES: Record<NonNullable<Shelf["key"]>, readonly [string, string]> = {
  INTERNATIONAL: ["Quốc tế", "International"],
  NATIONAL: ["Quốc gia", "National"],
  OTHER: ["Hạng dưới và giao hữu", "Lower divisions and show matches"],
}

type Size = "one" | "few" | "many"

/** How much room a trophy of a shelf has: one tells its whole story, a few their finals. */
const sizeOf = (count: number): Size => (count === 1 ? "one" : count <= 5 ? "few" : "many")

/**
 * The titles of a page as trophies in a lit cabinet. Each has the trophy of its kind of competition on a plinth with
 * its year; a gold plinth is the reigning champion's, stars on it are seasons won in a row, and a laurel is a title
 * without a defeat. `views` are the published competitions that may hold them.
 */
export function TitleShelf({
  titles: entries,
  views,
  name,
  logoUrl,
  logoDarkUrl,
  teams = false,
}: {
  titles: TitleEntry[]
  views: CompetitionView[]
  name: string
  logoUrl?: string | null
  logoDarkUrl?: string | null
  /** Says which team won each title, for someone who won them with several. */
  teams?: boolean
}) {
  const { text } = useStreamLocale()
  const now = useNow()
  const asked = circuitsToAsk(entries, views, now)
  const circuits = useQueries({
    queries: asked.map((id) => circuitCompetitionsQuery(id)),
    combine: (answers) => new Map(answers.flatMap(({ data }, at) => (data ? [[asked[at]!, data] as const] : []))),
  })
  const shelves = titleShelves(titleList(entries, views, circuits, now))
  return (
    <Stage tint={name} lights={[{ src: logoUrl, darkSrc: logoDarkUrl, at: "center" }]} className="ts">
      <TrophyPaints />
      <div className="ts-case">
        {shelves.map((shelf) => (
          <section
            key={shelf.key ?? "all"}
            className="ts-row"
            data-size={sizeOf(shelf.titles.length)}
            aria-label={text("Các lần vô địch", "Titles")}
          >
            {shelf.key && (
              <h3 className="ts-label">
                {text(...SHELF_NAMES[shelf.key])} <small>{shelf.titles.length}</small>
              </h3>
            )}
            <ol className="ts-shelf">
              {shelf.titles.map((title) => (
                <Piece key={title.key} title={title} size={sizeOf(shelf.titles.length)} team={teams} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </Stage>
  )
}

function Piece({ title, size, team }: { title: Title; size: Size; team: boolean }) {
  const { text } = useStreamLocale()
  const { name, short, year, form, competition, competitionId, winner, final, record, unbeaten, streak, reigning } =
    title
  const notes = [
    reigning && text("Đương kim vô địch", "Reigning champion"),
    streak > 1 && text(`${streak} mùa liên tiếp`, `${streak} seasons in a row`),
    unbeaten && text(`Bất bại ${record!.won} trận`, `Unbeaten in ${record!.won}`),
  ].filter((note): note is string => !!note)
  const alone = size === "one"
  const shown = alone ? name : short
  return (
    <li className="ts-title">
      <span className="ts-piece">
        <Trophy form={form} unbeaten={unbeaten} />
        <span className="ts-plinth" data-reigning={reigning || undefined}>
          {streak > 1 && (
            <i aria-hidden="true" className="ts-stars">
              {streak > 4 ? `★ ${streak}` : "★".repeat(streak)}
            </i>
          )}
          {year ?? "—"}
        </span>
      </span>
      <div className="ts-words">
        <strong title={name}>
          {competitionId && competition ? <Link to={`/competitions/${competitionId}`}>{shown}</Link> : shown}
        </strong>
        {alone && competition?.startsOn && <span>{dayRange(competition.startsOn, competition.endsOn)}</span>}
        {team && winner && (
          <span className="ts-team">
            <StreamImage
              src={winner.logoUrl}
              darkSrc={winner.logoDarkUrl}
              logo
              name={winner.shortName || winner.name}
            />
            {alone ? winner.name : winner.shortName || winner.name}
          </span>
        )}
        {final && size !== "many" && (
          <span className="ts-final">
            {final.score ? text(`Thắng ${final.score} trước`, `Won ${final.score} over`) : text("Á quân", "Runner-up")}
            <b>{alone ? final.opponent.name : final.opponent.shortName || final.opponent.name}</b>
          </span>
        )}
        {alone && record && !unbeaten && (
          <span>
            {text(`${record.won} trận thắng, ${record.lost} trận thua`, `${record.won} won, ${record.lost} lost`)}
          </span>
        )}
        {notes.map((note) => (
          <em key={note}>{note}</em>
        ))}
      </div>
    </li>
  )
}
