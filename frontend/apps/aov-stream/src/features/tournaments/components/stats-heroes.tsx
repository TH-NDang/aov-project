import { useDeferredValue, useMemo } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import type { Lane } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { laneName, shownText } from "../../../lib/feed-words"
import { heroLines, needsBans } from "../../../lib/hero-model"
import {
  heroesHref,
  heroOrders,
  laneNote,
  namedLike,
  ORDER_WORDS,
  playsLane,
  readHeroesView,
  type HeroesView,
} from "../../../lib/heroes-view"
import { LANE_WORDS } from "../../../lib/question-words"
import { statsHref } from "../../../lib/statistics-routes"
import { LANES } from "../../../lib/tournament-model"
import { useEntryState } from "../../../lib/use-entry-state"
import { ChoiceMenu } from "./choice-menu"
import { ChoiceTrack } from "./choice-track"
import { ChoiceWords } from "./choice-words"
import { FewGames } from "./fact-few"
import { FateLegend } from "./fate-bar"
import { HeroLeaders } from "./hero-leaders"
import { HeroShelves } from "./hero-shelves"
import { HeroTable } from "./hero-table"
import type { StatsData } from "./stats-data"
import "./stats-heroes.css"

type Href = (next: Partial<HeroesView>) => string

/** Every hero of the games counted: the three that lead, then all of them as faces on shelves or in a table. */
export function StatsHeroes({ data }: { data: StatsData }) {
  const { text } = useStreamLocale()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const compact = usePageLayout() === "compact"
  const [q, setQ] = useEntryState<string>("search", "")
  const search = useDeferredValue(q.trim())
  const games = data.feed.games.length
  const lines = useMemo(() => heroLines(data.records, games), [data.records, games])
  const lanes = useMemo(() => LANES.filter((lane) => lines.some((line) => playsLane(line, lane))), [lines])
  const { counted } = data
  const orders = heroOrders(counted)
  const read = readHeroesView(params, orders)
  const { by, table, lane }: HeroesView = { ...read, lane: lanes.find((item) => item === read.lane) ?? null }
  const inLane = useMemo(() => (lane ? lines.filter((line) => playsLane(line, lane)) : lines), [lines, lane])
  const found = useMemo(() => namedLike(inLane, search), [inLane, search])
  const ofShown = counted.shown > 0 && (table || needsBans(by))
  const href: Href = (next) => heroesHref(data.view.id, { by, table, lane, ...next }, data.period?.key)
  if (!lines.length) return <NoHeroes data={data} />
  const name = [by, lane, search, data.period?.key].join("|")
  const count = text(`${found.length} tướng`, `${found.length} ${found.length === 1 ? "hero" : "heroes"}`)
  return (
    <div className="tn-heroes">
      <h2 className="sr-only">{text("Tướng", "Heroes")}</h2>
      <p className="sr-only" role="status">
        {(search || lane) && found.length > 0 && count}
      </p>
      <HeroLeaders data={data} lines={lines} />
      <div className="tn-heroes-list" data-narrowed={!!(search || lane) || undefined}>
        <div className="tn-heroes-bar">
          <label className="tn-heroes-search">
            <StreamIcon name="search" size={16} />
            <input
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              onKeyDown={(event) => {
                // Enter opens the hero once the name leaves only one.
                if (event.key === "Enter" && !event.nativeEvent.isComposing && found.length === 1)
                  void navigate(statsHref(data.view.id, { hero: found[0]!.hero, scope: data.period?.key }))
              }}
              placeholder={text("Tìm tướng", "Find a hero")}
              aria-label={text("Tìm tướng", "Find a hero")}
            />
          </label>
          {lanes.length > 0 &&
            (compact ? (
              <LaneMenu lanes={lanes} lane={lane} href={href} />
            ) : (
              <LaneTrack lanes={lanes} lane={lane} href={href} />
            ))}
          <ViewSwitch table={table} compact={compact} href={href} />
        </div>
        <div className="tn-heroes-orders">
          {table && !compact ? (
            // The note of a lane counts its heroes already, unless a name narrows them further; the line stays, empty,
            // so the legend keeps the end of the row.
            <p>{(!lane || found.length < inLane.length) && count}</p>
          ) : (
            <ChoiceWords
              label={text("Xếp theo", "Order by")}
              replace
              value={by}
              choices={orders.map((order) => ({
                key: order,
                name: text(...ORDER_WORDS[order].name),
                title: text(...ORDER_WORDS[order].counts),
                to: href({ by: order }),
              }))}
            />
          )}
          <FateLegend counted={counted} />
        </div>
        <FewGames games={ofShown ? counted.shown : games} only={ofShown ? shownText(counted, text) : ""} />
        {lane && <p className="tn-quiet">{laneNote(inLane.length, lane, text)}</p>}
        {!found.length ? (
          <p className="tn-heroes-none" role="status">
            {text(`Không có tướng nào tên “${search}”`, `No hero is called “${search}”`)}
            {lane ? text(` chơi ${LANE_WORDS[lane][0]}.`, ` ${LANE_WORDS[lane][1]}.`) : "."}
            {lane && (
              <Link replace to={href({ lane: null })}>
                {text("Tìm ở mọi đường", "Search every lane")}
              </Link>
            )}
          </p>
        ) : table ? (
          <HeroTable data={data} lines={found} view={{ by, table, lane }} name={name} href={href} />
        ) : (
          <HeroShelves data={data} lines={found} by={by} name={name} />
        )}
      </div>
    </div>
  )
}

/** Games whose lineups nobody recorded can still be found by team and result. */
function NoHeroes({ data }: { data: StatsData }) {
  const { text } = useStreamLocale()
  return (
    <div className="hub-state">
      <h2>
        {data.period
          ? text("Các ván này chưa ghi tướng.", "The heroes of these games are not recorded.")
          : text("Giải này chưa ghi tướng của các ván.", "The heroes of this tournament's games are not recorded.")}
      </h2>
      <div className="hub-state-actions">
        <Link className="cp-button" to={statsHref(data.view.id, { part: "games", scope: data.period?.key })}>
          {text("Xem các ván", "See the games")}
        </Link>
      </div>
    </div>
  )
}

type LaneChoice = { lanes: Lane[]; lane: Lane | null; href: Href }

/** The lanes as their marks; the lane in use lets go when pressed again. */
function LaneTrack({ lanes, lane, href }: LaneChoice) {
  const { text } = useStreamLocale()
  return (
    <ChoiceTrack
      label={text("Đường", "Lane")}
      replace
      value={lane}
      choices={[
        { key: null, name: text("Mọi đường", "All lanes"), to: href({ lane: null }) },
        ...lanes.map((item) => ({
          key: item,
          name: <HeroLaneIcon lane={item} size={20} />,
          label: laneName(item, text),
          title: laneName(item, text),
          to: href({ lane: lane === item ? null : item }),
        })),
      ]}
    />
  )
}

/** On a phone the lanes are a menu named by the one in use. */
function LaneMenu({ lanes, lane, href }: LaneChoice) {
  const { text } = useStreamLocale()
  const navigate = useNavigate()
  const all = text("Mọi đường", "All lanes")
  return (
    <ChoiceMenu
      title={text("Đường", "Lane")}
      value={lane}
      choices={[
        { key: null, name: all, mark: null },
        ...lanes.map((item) => ({
          key: item,
          name: laneName(item, text),
          mark: <HeroLaneIcon lane={item} size={18} />,
        })),
      ]}
      onChoose={(item) => void navigate(href({ lane: item }), { replace: true })}
    >
      <button type="button" className="tn-heroes-lane">
        {lane && <HeroLaneIcon lane={lane} size={16} />}
        {lane ? laneName(lane, text) : all}
        <StreamIcon name="chevronRight" size={14} />
      </button>
    </ChoiceMenu>
  )
}

/** Faces or numbers; on a phone one button that shows the other. */
function ViewSwitch({ table, compact, href }: { table: boolean; compact: boolean; href: Href }) {
  const { text } = useStreamLocale()
  const faces = text("Ảnh tướng", "Portraits")
  const numbers = text("Bảng số", "Table")
  if (compact)
    return (
      <Link
        replace
        className="tn-heroes-view"
        to={href({ table: !table })}
        aria-label={table ? faces : numbers}
        title={table ? faces : numbers}
      >
        <StreamIcon name={table ? "grid" : "table"} size={18} />
      </Link>
    )
  return (
    <ChoiceTrack
      label={text("Cách xem", "View")}
      replace
      className="tn-heroes-views"
      value={table ? "table" : "faces"}
      choices={[
        { key: "faces", name: faces, to: href({ table: false }) },
        { key: "table", name: numbers, to: href({ table: true }) },
      ]}
    />
  )
}
