import { useMemo } from "react"
import type { Step } from "../../../components/place-trail"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useStreamLocale } from "../../../components/stream-locale"
import { draftShape, orderKnown } from "../../../lib/draft-shape"
import { gamesText } from "../../../lib/feed-words"
import type { GameOrder } from "../../../lib/finder-model"
import { heroLines, type HeroLine, type HeroRecord } from "../../../lib/hero-model"
import {
  heroColumns,
  heroFate,
  heroList,
  heroStaff,
  seasonColumns,
  tellsDraft,
  tellsSeason,
  type HeroFate,
  type HeroList,
} from "../../../lib/hero-page-model"
import { beside } from "../../../lib/neighbours"
import { statsHref, type StatsPlace } from "../../../lib/statistics-routes"
import { useGameOrder } from "../../../lib/use-game-order"
import { HeroBuildsPart } from "./hero-builds"
import { HeroHead } from "./hero-head"
import { HeroLists } from "./hero-lists"
import { HeroTeams } from "./hero-teams"
import { HeroTurns } from "./hero-turns"
import { HeroWeeks } from "./hero-weeks"
import { HeroWings } from "./hero-wings"
import { StageTabs } from "./stage-tabs"
import type { StatsData } from "./stats-data"
import { StatsTrail } from "./stats-trail"
import { StatsWhole } from "./stats-whole"
import "./stats-hero.css"

type Props = { data: StatsData; record: HeroRecord; place: StatsPlace }

/** Where the hero stands: the ways up, and the heroes before and after it in the order of the list. */
function HeroTrail({ data, record, place, sort }: Props & { sort: GameOrder }) {
  const { text } = useStreamLocale()
  const games = data.feed.games.length
  const scope = data.period?.key
  const lines = useMemo(() => heroLines(data.records, games), [data.records, games])
  const near = beside(
    lines,
    lines.findIndex((line) => line.hero.key === record.hero.key),
  )
  const step = (line: HeroLine | null): Step | null => {
    if (!line) return null
    const list = heroList(place.list, line)
    return {
      to: statsHref(data.view.id, { hero: line.hero, list, scope, sort: list ? sort : undefined }),
      name: line.hero.name,
    }
  }
  return (
    <StatsTrail
      data={data}
      part="heroes"
      current={record.hero.name}
      label={text("Tướng liền kề", "Heroes before and after")}
      before={step(near.before)}
      after={step(near.after)}
    />
  )
}

/** The ways through a hero's page: what its games add up to, and the games it was picked and banned in. */
function HeroTabs({
  data,
  record: { hero },
  fate,
  list,
  sort,
}: Omit<Props, "place"> & { fate: HeroFate; list: HeroList | null; sort: GameOrder }) {
  const { text, languageTag } = useStreamLocale()
  const compact = usePageLayout() === "compact"
  const games = (count: number) => gamesText(count, text, languageTag)
  const short = (count: number) => (compact ? count.toLocaleString(languageTag) : games(count))
  const tabs: { key: HeroList | null; count?: number; name: string }[] = [
    { key: null, name: text("Phân tích", "Analysis") },
    {
      key: "picks",
      count: fate.picks,
      name: text(`${games(fate.picks)} được chọn`, `Picked in ${short(fate.picks)}`),
    },
    { key: "bans", count: fate.bans, name: text(`${games(fate.bans)} bị cấm`, `Banned in ${short(fate.bans)}`) },
  ]
  return (
    <StageTabs
      label={text(`Các phần về ${hero.name}`, `Parts about ${hero.name}`)}
      open={list}
      tabs={tabs
        .filter(({ count }) => count !== 0)
        .map(({ key, name }) => ({
          key,
          name,
          to: statsHref(data.view.id, { hero, list: key, scope: data.period?.key, sort: key ? sort : undefined }),
        }))}
    />
  )
}

/** What the games of the hero add up to. */
function Analysis({ data, record, fate }: Omit<Props, "place"> & { fate: HeroFate }) {
  const { feed } = data
  const { hero } = record
  const shape = useMemo(() => draftShape(feed.games), [feed])
  const season = useMemo(() => seasonColumns(feed), [feed])
  const columns = useMemo(() => heroColumns(season, record), [season, record])
  const staff = useMemo(
    () => (orderKnown(shape, feed.games.length) ? heroStaff(feed.games, shape, hero) : []),
    [feed, shape, hero],
  )
  const weeks = tellsSeason(columns)
  const turns = shape && tellsDraft(staff) ? shape : null
  const teams = <HeroTeams data={data} record={record} />
  return (
    <div className="tn-hh-analysis">
      {fate.picks > 0 && teams}
      <HeroWings data={data} record={record} />
      {(weeks || turns || !fate.picks) && (
        <div className="tn-hh-times">
          {fate.picks === 0 && teams}
          {weeks && <HeroWeeks data={data} hero={hero} columns={columns} alone={!turns && fate.picks > 0} />}
          {turns && <HeroTurns data={data} hero={hero} acts={turns.acts} staff={staff} />}
        </div>
      )}
      <HeroBuildsPart key={hero.key} data={data} record={record} />
    </div>
  )
}

/** One hero in the games counted: what became of it, who played and banned it, beside whom, against whom and when. */
export function StatsHero({ data, record, place }: Props) {
  const { text, languageTag } = useStreamLocale()
  const { order: sort } = useGameOrder()
  const fate = heroFate(record, data.counted)
  const list = heroList(place.list, fate)
  const { name } = record.hero
  const competition = data.view.content.tournament.name
  const games = (count: number) => gamesText(count, text, languageTag)
  const title =
    list === "picks"
      ? text(`${games(fate.picks)} ${name} được chọn`, `${games(fate.picks)} with ${name} picked`)
      : list === "bans"
        ? text(`${games(fate.bans)} ${name} bị cấm`, `${games(fate.bans)} with ${name} banned`)
        : name
  return (
    <div className="tn-hh-page">
      <title>{`${title}, ${competition} — AOV Stream`}</title>
      <div className="tn-hh-top">
        <HeroTrail data={data} record={record} place={place} sort={sort} />
        <HeroHead data={data} record={record} fate={fate} />
        {fate.present > 0 && <HeroTabs data={data} record={record} fate={fate} list={list} sort={sort} />}
      </div>
      {list ? (
        <HeroLists data={data} record={record} list={list} />
      ) : fate.present > 0 ? (
        <Analysis data={data} record={record} fate={fate} />
      ) : (
        data.period && <StatsWhole to={statsHref(data.view.id, { hero: record.hero })} name={name} />
      )}
    </div>
  )
}
