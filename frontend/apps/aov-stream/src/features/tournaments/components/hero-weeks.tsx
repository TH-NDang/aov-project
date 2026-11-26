import type { CSSProperties } from "react"
import { Link } from "react-router"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText } from "../../../lib/feed-words"
import type { Question } from "../../../lib/finder-model"
import type { FeedHero } from "../../../lib/game-feed"
import {
  columnFigure,
  columnQuestion,
  columnWords,
  type HeroColumn,
  type SeasonColumn,
} from "../../../lib/hero-page-model"
import { stageName } from "../../../lib/match-labels"
import { dayMonth } from "../../../lib/match-time"
import { statsHref } from "../../../lib/statistics-routes"
import { useEntryState } from "../../../lib/use-entry-state"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./hero-weeks.css"

/** So few columns leave room for the words beside them. */
const FEW_COLUMNS = 3
/** From so many columns on, a phone has no room for the sign of every share over them. */
const MANY_COLUMNS = 8

const stagesName = ({ stages }: SeasonColumn) => stages.map(({ name }) => stageName(name)).join(", ")

/** The parts of a column from the top down, each as tall as its share of all games of the column. */
const PARTS = [
  ["unknown", "unknown"],
  ["banned", "bans"],
  ["lost", "losses"],
  ["won", "wins"],
] as const

/** How a column is called on the chart and in full, and the stage of its weeks where the chart has to name it. */
type Names = { short: string; long: string; stage: string | null }

/**
 * A hero in one column, which is as tall as all games of it; pressing it tells its numbers under the chart. A share
 * writes its sign apart, so that a crowded chart can keep it on the first share only.
 */
function Column({
  fate,
  figure,
  first,
  names,
  stage,
  chosen,
  choose,
}: Pick<HeroColumn, "fate"> & {
  figure: string
  /** Whether this is the first column whose figure is a share. */
  first: boolean
  names: Names
  /** Whether the column stands for a stage rather than a week. */
  stage: boolean
  chosen: boolean
  choose: () => void
}) {
  const { text } = useStreamLocale()
  const share = figure.endsWith("%")
  return (
    <button
      type="button"
      className="tn-weeks-column"
      data-kind={stage ? "stage" : undefined}
      aria-pressed={chosen}
      aria-label={`${names.long}: ${columnWords(fate, text)}`}
      onClick={choose}
    >
      <span className="tn-weeks-stack" style={{ "--all": fate.games } as CSSProperties}>
        {fate.present > 0 && (
          <b>
            {share ? figure.slice(0, -1) : figure}
            {share && <span data-unit={first ? "first" : "later"}>%</span>}
          </b>
        )}
        {PARTS.map(
          ([part, key]) =>
            fate[key] > 0 && <i key={part} data-part={part} style={{ "--part": fate[key] } as CSSProperties} />,
        )}
      </span>
      <span className="tn-weeks-name">{names.short}</span>
      {names.stage && <span className="tn-weeks-stage">{names.stage}</span>}
    </button>
  )
}

/** What became of the hero in the column chosen, each number a way to its games. */
function Reading({
  data,
  hero,
  of: { column, fate },
  name,
}: {
  data: StatsData
  hero: FeedHero
  of: HeroColumn
  name: string
}) {
  const { text, languageTag } = useStreamLocale()
  const { from, to, scope } = columnQuestion(data.feed, column)
  const days = [...new Set([column.from, column.to])].flatMap((day) => (day ? dayMonth(day, languageTag) : []))
  const open = fate.picks - fate.wins - fate.losses
  const { unknown } = fate
  const unrecorded = unknown > 0 && text(`${unknown} ván chưa ghi lượt cấm`, `${unknown} without recorded bans`)
  const nobody = fate.shown
    ? text("không đội nào chọn hay cấm", "no team picked or banned it")
    : text("không đội nào chọn", "no team picked it")
  const door = (part: string, count: number, question: Partial<Question>, words: string) =>
    count > 0 && (
      <li data-part={part}>
        <Link to={statsHref(data.view.id, { question: { ...question, from, to }, scope: scope ?? data.period?.key })}>
          {words}
        </Link>
      </li>
    )
  return (
    <div className="tn-weeks-reading" role="status">
      <p>
        <b>{name}</b>{" "}
        <span>{[days.join("–"), gamesText(fate.games, text, languageTag)].filter(Boolean).join(", ")}</span>
      </p>
      {fate.present > 0 ? (
        <ul>
          {door("won", fate.wins, { pick: [hero], won: true }, text(`thắng ${fate.wins}`, `won ${fate.wins}`))}
          {door("lost", fate.losses, { pick: [hero], won: false }, text(`thua ${fate.losses}`, `lost ${fate.losses}`))}
          {open > 0 && (
            <li data-part="open">{text(`${open} ván chưa rõ kết quả`, `${open} without a recorded result`)}</li>
          )}
          {door("banned", fate.bans, { ban: [hero] }, text(`bị cấm ${fate.bans}`, `banned ${fate.bans}`))}
          {unrecorded && <li data-part="unknown">{unrecorded}</li>}
        </ul>
      ) : (
        <p>{[nobody, unrecorded].filter(Boolean).join(", ")}</p>
      )}
    </div>
  )
}

/**
 * A hero along the season: a column for every week, as tall as all games of it, so the columns compare whatever the
 * number of games. The column chosen is told in words, with ways to its games; the words stand beside the chart where
 * it has a row of its own (`alone`) or few columns.
 */
export function HeroWeeks({
  data,
  hero,
  columns,
  alone,
}: {
  data: StatsData
  hero: FeedHero
  columns: HeroColumn[]
  alone: boolean
}) {
  const { text, languageTag } = useStreamLocale()
  const [chosen, setChosen] = useEntryState<string | null>("week", null)
  const shown =
    columns.find(({ column }) => column.key === chosen) ?? columns.filter(({ fate }) => fate.present > 0).at(-1)
  if (!shown) return null
  const figures = columns.map(({ fate }) => columnFigure(fate, languageTag))
  const firstShare = columns.findIndex(({ fate }, index) => fate.present > 0 && figures[index]!.endsWith("%"))
  // The weeks of two stages are told apart by the names of the stages; those of one need none.
  const weeks = columns.map(({ column }) => column).filter(({ week }) => week != null)
  const several = new Set(weeks.map(stagesName)).size > 1
  const namesOf = (column: SeasonColumn): Names => {
    const stage = stagesName(column)
    if (column.week == null) return { short: stage, long: stage, stage: null }
    return {
      short: text(`T${column.week}`, `W${column.week}`),
      long: several
        ? text(`${stage}, tuần ${column.week}`, `${stage}, week ${column.week}`)
        : text(`Tuần ${column.week}`, `Week ${column.week}`),
      stage: several && weeks.find((item) => stagesName(item) === stage) === column ? stage : null,
    }
  }
  return (
    <Section
      id="hero-weeks"
      title={text("Qua từng tuần", "Week by week")}
      note={text("cả cột là mọi ván của tuần", "a column is all games of the week")}
    >
      <div className="tn-weeks" data-beside={alone || columns.length <= FEW_COLUMNS || undefined}>
        <div
          className="tn-weeks-chart"
          data-stages={several || undefined}
          data-many={columns.length >= MANY_COLUMNS || undefined}
        >
          {columns.map(({ column, fate }, index) => (
            <Column
              key={column.key}
              fate={fate}
              figure={figures[index]!}
              first={index === firstShare}
              names={namesOf(column)}
              stage={column.week == null}
              chosen={column === shown.column}
              choose={() => setChosen(column.key)}
            />
          ))}
        </div>
        <Reading data={data} hero={hero} of={shown} name={namesOf(shown.column).long} />
      </div>
    </Section>
  )
}
