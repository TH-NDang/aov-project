import { useEffect, useRef } from "react"
import { useParams, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { PlaceBar, PlaceTrail, useSections, type Place } from "../../../components/place-trail"
import { StreamShell } from "../../../components/stream-shell"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionMatches } from "../../../lib/match-model"
import { seasonName } from "../../../lib/season-name"
import { competitionQuery, statisticsQuery } from "../../../lib/tournament-api"
import { CompetitionAwards } from "../components/competition-awards"
import { CompetitionAbout } from "../components/competition-about"
import { CompetitionFacts } from "../components/competition-facts"
import { CompetitionFormat } from "../components/competition-format"
import { CompetitionHead } from "../components/competition-head"
import { CompetitionOverview, type CompetitionTab } from "../components/competition-overview"
import { CompetitionCrew } from "../components/competition-people"
import { CompetitionSchedule } from "../components/competition-schedule"
import { CompetitionStandings } from "../components/competition-standings"
import { CompetitionStatisticsTab } from "../components/competition-statistics"
import { CompetitionTeams } from "../components/competition-teams"
import { SeasonSwitch } from "../components/season-switch"
import { StreamHead } from "../../../components/stream-head"
import "./competition-page.css"

/** The tabs of a competition, each named in Vietnamese and in English. */
const TABS: readonly [CompetitionTab, readonly [string, string]][] = [
  ["overview", ["Tổng quan", "Overview"]],
  ["matches", ["Lịch & kết quả", "Schedule & results"]],
  ["standings", ["BXH & nhánh đấu", "Standings & bracket"]],
  ["stats", ["Thống kê", "Statistics"]],
  ["teams", ["Đội tham dự", "Teams"]],
  ["info", ["Thể thức & thông tin", "Format & info"]],
]

/** What else the address may hold, each belonging to one tab: the filters of the schedule and the hero opened. */
const TAB_KEYS: Partial<Record<CompetitionTab, string[]>> = {
  matches: ["scope", "stage", "team", "date"],
  stats: ["hero"],
}

/** The tab in the address, and a way to open another one from the page, which then moves the focus to it. */
function useTabs() {
  const [params, setParams] = useSearchParams()
  const requested = params.get("tab")
  // The bracket stands on the standings tab, so `?tab=bracket` opens that tab.
  const tab = requested === "bracket" ? "standings" : (TABS.find(([key]) => key === requested)?.[0] ?? "overview")
  const focus = useRef<CompetitionTab | null>(null)
  const setTab = (next: CompetitionTab) =>
    setParams((current) => {
      const updated = new URLSearchParams(current)
      if (next === "overview") updated.delete("tab")
      else updated.set("tab", next)
      for (const [owner, keys] of Object.entries(TAB_KEYS))
        if (owner !== next || owner === "stats") keys.forEach((key) => updated.delete(key))
      return updated
    })
  const openTab = (next: CompetitionTab) => {
    focus.current = next
    setTab(next)
  }
  return { tab, hero: params.get("hero"), setTab, openTab, focus }
}

/** The tabs of a competition in one row, which keeps the open one in view and takes the focus it is asked to. */
function Tabs({
  tab,
  tabs,
  setTab,
  focus,
}: Pick<ReturnType<typeof useTabs>, "tab" | "setTab" | "focus"> & { tabs: typeof TABS }) {
  const { text } = useStreamLocale()
  const row = useRef<HTMLElement>(null)
  useEffect(() => {
    const button = row.current?.querySelector<HTMLElement>("[aria-current]")
    if (!row.current || !button) return
    row.current.scrollLeft = button.offsetLeft - (row.current.clientWidth - button.offsetWidth) / 2
    if (focus.current === tab) button.focus()
    focus.current = null
  }, [tab, focus])
  return (
    <nav ref={row} className="cp-tabs" data-flush="" aria-label={text("Nội dung giải đấu", "Tournament content")}>
      {tabs.map(([key, label]) => (
        <button key={key} aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)}>
          {text(label[0], label[1])}
        </button>
      ))}
    </nav>
  )
}

export function PublicCompetitionPage() {
  const { text } = useStreamLocale()
  const { id = "" } = useParams()
  const query = useQuery(competitionQuery(id))
  const statistics = useQuery(statisticsQuery(id))
  const { tab: requested, hero, setTab, openTab, focus } = useTabs()
  const { tournaments } = useSections()
  const compact = usePageLayout() === "compact"
  const head = useRef<HTMLDivElement>(null)
  if (!query.data)
    return (
      <StreamShell>
        <div className="cp-container">
          <PlaceTrail places={[tournaments]} />
          {query.isError ? (
            <div className="hub-state" role="alert">
              <h1>{query.error.message}</h1>
              <button className="cp-button" onClick={() => void query.refetch()}>
                {text("Thử lại", "Retry")}
              </button>
            </div>
          ) : (
            <div
              className="tn-comp-skeleton"
              role="status"
              aria-label={text("Đang tải giải đấu…", "Loading tournament…")}
            >
              <span className="hub-skeleton" data-shape="stage" />
              <span className="hub-skeleton" data-shape="tabs" />
              <span className="hub-skeleton" data-shape="rows" />
            </div>
          )}
        </div>
      </StreamShell>
    )
  const view = query.data
  const { tournament, circuit } = view.content
  const places: Place[] = [
    tournaments,
    ...(circuit ? [{ to: `/pages/${circuit.code}`, name: circuit.name, short: circuit.shortName }] : []),
  ]
  const matches = competitionMatches([view])
  // Statistics count published games; a competition without any has no such tab.
  const counted = statistics.data && statistics.data.games > 0 ? statistics.data : null
  const opening = requested === "stats" && statistics.isPending
  const tabs = TABS.filter(([key]) => key !== "stats" || counted || opening)
  const tab = requested === "stats" && !counted && !opening ? "overview" : requested
  const tabRow = <Tabs tab={tab} tabs={tabs} setTab={setTab} focus={focus} />
  return (
    <StreamShell>
      <StreamHead
        title={`${tournament.name} — AOV Stream`}
        description={text(
          `${tournament.name}: lịch thi đấu, kết quả, bảng xếp hạng và đội tuyển giải Liên Quân Mobile.`,
          `${tournament.name}: schedule, results, standings and teams of the Arena of Valor tournament.`,
        )}
      />
      <div className="cp-container tn-comp">
        <CompetitionHead
          view={view}
          head={head}
          trail={<PlaceTrail places={places} current={<SeasonSwitch view={view} />} />}
          openStages={() => openTab("standings")}
        />
        {compact ? (
          <div className="tn-sticky-tabs">{tabRow}</div>
        ) : (
          <PlaceBar
            head={head}
            places={places}
            name={circuit ? seasonName(tournament.name, circuit.name) : tournament.name}
            mark={<StreamImage src={tournament.logoUrl} darkSrc={tournament.logoDarkUrl} logo name={tournament.name} />}
            tabs={tabRow}
          />
        )}
        {tab === "overview" && (
          <CompetitionOverview view={view} matches={matches} statistics={counted} openTab={openTab} />
        )}
        {tab === "matches" && <CompetitionSchedule entries={matches} />}
        {tab === "standings" && <CompetitionStandings view={view} />}
        {tab === "stats" &&
          (counted ? (
            <CompetitionStatisticsTab view={view} statistics={counted} hero={hero} />
          ) : (
            <div
              className="tn-comp-skeleton"
              role="status"
              aria-label={text("Đang tải thống kê…", "Loading statistics…")}
            >
              <span className="hub-skeleton" data-shape="rows" />
            </div>
          ))}
        {tab === "teams" && <CompetitionTeams view={view} />}
        {tab === "info" && (
          <div className="tn-stack">
            <CompetitionFormat view={view} />
            <div className="tn-info-cards">
              <CompetitionAbout view={view} />
              <CompetitionFacts view={view} />
              <CompetitionCrew view={view} />
            </div>
            <CompetitionAwards view={view} preview={8} wide />
          </div>
        )}
      </div>
    </StreamShell>
  )
}
