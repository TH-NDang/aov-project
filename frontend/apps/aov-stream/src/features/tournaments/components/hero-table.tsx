import { useMemo, type ReactNode } from "react"
import { Link } from "react-router"
import type { Side } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText, laneName, score, shownText } from "../../../lib/feed-words"
import type { Question } from "../../../lib/finder-model"
import {
  enoughPicks,
  lineFate,
  needsBans,
  sortLines,
  type HeroLine,
  type HeroOrder,
  type Tally,
} from "../../../lib/hero-model"
import { ORDER_WORDS, picksWords, playsLane, shelfTitle, wonShare, type HeroesView } from "../../../lib/heroes-view"
import { shareOrGames } from "../../../lib/shares"
import { statsHref } from "../../../lib/statistics-routes"
import { LANES } from "../../../lib/tournament-model"
import { useKeptRows } from "../../../lib/use-kept-rows"
import { FateBar } from "./fate-bar"
import { HeroPortrait } from "./hero-portrait"
import type { StatsData } from "./stats-data"
import "./hero-table.css"

/** Heroes listed before the reader scrolls for more. */
const HEROES = 30

/** What the figures of a column count. */
type Column = HeroOrder | "record" | "blue" | "red" | "rate"

/** A phone has room for what the list is ordered by, the record and the bans. */
const compactColumns = (by: HeroOrder): Column[] => [
  by === "bans" ? "presence" : by === "wins" ? "rate" : by,
  "record",
  "bans",
]
const WIDE: Column[] = ["presence", "picks", "wins", "blue", "red", "bans"]

/** The order a column shows, when the list can be ordered by it. */
const ordered = (column: Column): HeroOrder | null =>
  column === "rate" ? "wins" : column === "record" || column === "blue" || column === "red" ? null : column

/**
 * Every hero in numbers, each of which opens the games it counts; the rest of a line opens the hero. By win rate, the
 * heroes with too few picks for one stand under a line of their own. `href` is the address of another order.
 */
export function HeroTable({
  data,
  lines,
  view,
  name,
  href,
}: {
  data: StatsData
  lines: HeroLine[]
  view: HeroesView
  name: string
  href: (next: Partial<HeroesView>) => string
}) {
  const { text } = useStreamLocale()
  const compact = usePageLayout() === "compact"
  const games = data.feed.games.length
  const sorted = useMemo(() => sortLines(lines, view.by, games), [lines, view.by, games])
  const { rows, loader } = useKeptRows(sorted, name, HEROES)
  const enough = (line: HeroLine) => view.by !== "wins" || line.picks >= enoughPicks(games)
  // While no game shows its bans there is nothing to write where they are counted.
  const columns = (compact ? compactColumns(view.by) : WIDE).filter((column) => {
    const by = ordered(column)
    return data.counted.shown > 0 || !by || !needsBans(by)
  })
  const row = (line: HeroLine) => (
    <Row key={line.hero.key} data={data} line={line} columns={columns} compact={compact} />
  )
  const few = rows.filter((line) => !enough(line))
  return (
    <div className="tn-herotable-box">
      <table className="tn-herotable" aria-label={text("Số liệu các tướng", "Heroes in numbers")}>
        <thead>
          <tr>
            <th scope="col">{text("Tướng", "Hero")}</th>
            {columns.map((column) => (
              <Head key={column} column={column} view={view} href={compact ? null : href} />
            ))}
          </tr>
        </thead>
        <tbody>{rows.filter(enough).map(row)}</tbody>
        {few.length > 0 && (
          <tbody>
            <tr className="tn-herotable-rest">
              <th scope="rowgroup" colSpan={columns.length + 1}>
                {shelfTitle({ kind: "FEW", from: 0, below: null, face: 52, lines: few }, "wins", data.counted, text)}
              </th>
            </tr>
            {few.map(row)}
          </tbody>
        )}
      </table>
      <InfiniteScroll
        query={loader}
        label={text("Đang tải thêm tướng", "Loading more heroes")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </div>
  )
}

/** The name of a column; where `href` is given it orders the list by the column. */
function Head({
  column,
  view,
  href,
}: {
  column: Column
  view: HeroesView
  href: ((next: Partial<HeroesView>) => string) | null
}) {
  const { text } = useStreamLocale()
  const by = ordered(column)
  if (!by)
    return (
      <th scope="col" data-column={column}>
        {column === "record" ? (
          <abbr title={text("Số ván thắng – số ván thua", "Games won – games lost")}>{text("T–B", "W–L")}</abbr>
        ) : column === "blue" ? (
          text("Bên xanh", "Blue side")
        ) : (
          text("Bên đỏ", "Red side")
        )}
      </th>
    )
  const { name, counts } = ORDER_WORDS[by]
  return (
    <th scope="col" data-column={column} aria-sort={by === view.by ? "descending" : "none"}>
      {href ? (
        <Link replace to={href({ by })} title={text(...counts)}>
          {text(...name)}
        </Link>
      ) : (
        text(...name)
      )}
    </th>
  )
}

/** A number that opens the games it counts, which `said` names; nothing opens where there are none. */
function Count({ to, said, children }: { to: string | null; said: string; children: ReactNode }) {
  if (!to)
    return (
      <span className="tn-herotable-none">
        <span aria-hidden="true">–</span>
        <span className="sr-only">{said}</span>
      </span>
    )
  return (
    <Link className="tn-herotable-count" to={to} aria-label={said} title={said}>
      {children}
    </Link>
  )
}

function Row({
  data,
  line,
  columns,
  compact,
}: {
  data: StatsData
  line: HeroLine
  columns: Column[]
  compact: boolean
}) {
  const { text, languageTag } = useStreamLocale()
  const { shown } = data.counted
  const only = shownText(data.counted, text)
  const scope = data.period?.key
  const { hero, seen, picks, wins, losses, bans, blue, red } = line
  const number = (value: number) => value.toLocaleString(languageTag)
  const opens = (count: number, question: Partial<Question>) =>
    count > 0 ? statsHref(data.view.id, { question, scope }) : null
  const ended = (tally: Tally) => picksWords(tally, text, languageTag)
  const games = (count: number) => gamesText(count, text, languageTag)
  // Games without a result have no record, so nothing is counted there.
  const record = (
    <Count
      to={wins + losses ? opens(picks, { pick: [hero] }) : null}
      said={`${hero.name}: ${ended({ games: picks, wins, losses })}`}
    >
      {score(line)}
    </Count>
  )
  const side = (code: Side, tally: Tally) => {
    const where = code === "BLUE" ? text("bên xanh", "blue side") : text("bên đỏ", "red side")
    const decided = tally.wins + tally.losses
    return (
      <Count
        to={decided ? opens(tally.games, { pick: [hero], side: code }) : null}
        said={`${hero.name}, ${where}: ${ended(tally)}`}
      >
        {score(tally)}
      </Count>
    )
  }
  const share = wonShare(line)
  const fate = <FateBar fate={lineFate(line, data.counted)} />
  const cells: Record<Column, ReactNode> = {
    presence: (
      <>
        {!compact && <span className="tn-herotable-fate">{fate}</span>}
        <b>
          {seen > 0 ? shareOrGames(seen, shown, text, languageTag) : "–"}
          <span className="sr-only">
            {text(
              `, ${number(seen)} trong ${number(shown)} ván${only}`,
              `, ${number(seen)} of ${number(shown)} games${only}`,
            )}
          </span>
        </b>
      </>
    ),
    picks: (
      <Count
        to={opens(picks, { pick: [hero] })}
        said={text(`${games(picks)} chọn ${hero.name}`, `${games(picks)} with ${hero.name}`)}
      >
        {number(picks)}
      </Count>
    ),
    wins: (
      <>
        {record}
        <span className="tn-herotable-share">{share}</span>
      </>
    ),
    rate: <b>{share ?? <span className="tn-herotable-none">–</span>}</b>,
    record,
    blue: side("BLUE", blue),
    red: side("RED", red),
    bans: (
      <Count
        to={opens(bans, { ban: [hero] })}
        said={text(`${games(bans)} cấm ${hero.name}`, `${games(bans)} with ${hero.name} banned`)}
      >
        {number(bans)}
      </Count>
    ),
  }
  return (
    <tr>
      <th scope="row">
        <span className="tn-herotable-hero">
          <HeroPortrait hero={hero} />
          <span>
            <Link to={statsHref(data.view.id, { hero, scope })}>{hero.name}</Link>
            {compact ? fate : <Lanes line={line} />}
          </span>
        </span>
      </th>
      {columns.map((column) => (
        <td key={column} data-column={column}>
          {cells[column]}
        </td>
      ))}
    </tr>
  )
}

/** The lanes a hero belongs to, the usual one first. */
function Lanes({ line }: { line: HeroLine }) {
  const { text } = useStreamLocale()
  const lanes = line.lanes.map(({ lane }) => lane).filter((lane) => LANES.includes(lane) && playsLane(line, lane))
  if (!lanes.length) return null
  return (
    <span className="tn-herotable-lanes">
      {lanes.map((lane) => (
        <HeroLaneIcon key={lane} lane={lane} size={14} label={laneName(lane, text)} />
      ))}
    </span>
  )
}
