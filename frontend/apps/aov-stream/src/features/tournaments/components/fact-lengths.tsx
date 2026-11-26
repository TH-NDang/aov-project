import type { CSSProperties } from "react"
import { Link } from "react-router"
import { useStreamLocale } from "../../../components/stream-locale"
import { capital } from "../../../lib/capital"
import { lengthColumns } from "../../../lib/facts-model"
import { gamesText } from "../../../lib/feed-words"
import { findGames, NOTHING_ASKED } from "../../../lib/finder-model"
import { lengthCounts } from "../../../lib/found-model"
import { averageSeconds, type FeedGame } from "../../../lib/game-feed"
import { lengthExtremes, minuteTicks } from "../../../lib/highlights"
import { matchRound } from "../../../lib/match-schedule"
import { dayMonth } from "../../../lib/match-time"
import { lengthWords, namesOf } from "../../../lib/question-words"
import { statsHref } from "../../../lib/statistics-routes"
import { clock } from "../../../lib/tournament-model"
import { FactRow } from "./fact-row"
import { FactWords } from "./fact-words"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./fact-lengths.css"

/** The games whose length is known that a chart of them needs. */
const ENOUGH = 12

/**
 * How long the games lasted: a column a minute, the games of the four lengths a reader asks about, and the shortest
 * and the longest games by name.
 */
export function FactLengths({ data }: { data: StatsData }) {
  const { text, languageTag } = useStreamLocale()
  const { games } = data.feed
  const timed = games.filter((game) => game.seconds)
  const average = averageSeconds(games)
  const { short, long } = lengthExtremes(games)
  if (!average) return null
  const known =
    timed.length < games.length
      ? text(
          `, ${timed.length.toLocaleString(languageTag)} trong ${gamesText(games.length, text, languageTag)} có ghi thời lượng`,
          `, ${timed.length.toLocaleString(languageTag)} of ${gamesText(games.length, text, languageTag)} with a length`,
        )
      : ""
  return (
    <Section title={text("Ván nhanh, ván dài", "Short games, long games")}>
      <div className="tn-fact-lengths">
        <p>
          <FactWords words={text(`Trung bình *${clock(average)}*${known}`, `*${clock(average)}* on average${known}`)} />
        </p>
        {timed.length >= ENOUGH && <Minutes data={data} />}
        <Lengths data={data} />
        <div className="tn-fact-extremes">
          <Extremes
            data={data}
            title={long.length ? text("Nhanh nhất", "Shortest") : text("Từ nhanh đến dài", "From short to long")}
            games={short}
          />
          {long.length > 0 && <Extremes data={data} title={text("Dài nhất", "Longest")} games={long} />}
        </div>
      </div>
    </Section>
  )
}

/** A column for every minute. A pointer opens its games; the lengths under the chart do for everyone. */
function Minutes({ data }: { data: StatsData }) {
  const { text, languageTag } = useStreamLocale()
  const columns = lengthColumns(data.feed.games)
  const most = Math.max(1, ...columns.map(({ games }) => games.length))
  const ticks = minuteTicks(columns)
  const first = columns[0]!.minute
  return (
    <div className="tn-fact-minutes" style={{ "--columns": columns.length } as CSSProperties} aria-hidden="true">
      {columns.map(({ minute, games }) =>
        games.length ? (
          <Link
            key={minute}
            to={statsHref(data.view.id, { question: { min: minute, max: minute }, scope: data.period?.key })}
            title={text(
              `${minute} phút: ${gamesText(games.length, text, languageTag)}`,
              `${minute} minutes: ${gamesText(games.length, text, languageTag)}`,
            )}
            style={{ "--share": games.length / most, "--column": minute - first + 1 } as CSSProperties}
            tabIndex={-1}
          >
            <i />
          </Link>
        ) : null,
      )}
      {ticks.map((minute, at) => (
        <span
          key={minute}
          data-end={minute === first ? "first" : minute === columns.at(-1)!.minute ? "last" : undefined}
          style={{ "--column": minute - first + 1 } as CSSProperties}
        >
          {at === 0 ? text(`${minute} phút`, `${minute} min`) : minute}
        </span>
      ))}
    </div>
  )
}

/** The four lengths a reader asks about, each with its games. */
function Lengths({ data }: { data: StatsData }) {
  const { text, languageTag } = useStreamLocale()
  const lengths = lengthCounts(findGames(data.feed.games, NOTHING_ASKED)).filter(({ games }) => games > 0)
  return (
    <ul className="tn-fact-spans">
      {lengths.map(({ key, min, max, games }) => (
        <li key={key}>
          <Link to={statsHref(data.view.id, { question: { min, max }, scope: data.period?.key })}>
            <b>{gamesText(games, text, languageTag)}</b>
            <span>{capital(lengthWords({ min, max }, text))}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Games by their length, with who won and where the game stands; each opens the game. */
function Extremes({ data, title, games }: { data: StatsData; title: string; games: FeedGame[] }) {
  const { text, languageTag } = useStreamLocale()
  const names = namesOf(data.view, text)
  const result = ({ sides, winner }: FeedGame) => {
    if (!sides.some(({ teamId }) => teamId)) return null
    const [first, second] = sides.map(({ teamId }) => names.team(teamId ?? ""))
    if (!second) return `*${first}*`
    if (!winner) return text(`*${first}* gặp *${second}*`, `*${first}* against *${second}*`)
    const [won, lost] = sides[0]!.side === winner ? [first, second] : [second, first]
    return text(`*${won}* thắng ${lost}`, `*${won}* beat ${lost}`)
  }
  return (
    <section>
      {games.length > 1 && <h3>{title}</h3>}
      <ol>
        {games.map((game) => {
          const round = game.entry ? matchRound(game.entry, languageTag) : null
          const place = [
            round ?? (game.day && dayMonth(game.day, languageTag)),
            text(`ván ${game.number}`, `game ${game.number}`),
          ]
            .filter(Boolean)
            .join(", ")
          const length = clock(game.seconds!)
          const words = result(game)
          return (
            <FactRow
              key={game.id}
              to={`/games/${game.id}`}
              art={<b className="tn-fact-clock">{length}</b>}
              said={[length, words?.replaceAll("*", ""), place].filter(Boolean).join(", ")}
            >
              {words && (
                <span>
                  <FactWords words={words} />
                </span>
              )}
              <small>{place}</small>
            </FactRow>
          )
        })}
      </ol>
    </section>
  )
}
