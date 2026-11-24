import { useEffect, useRef } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { StreamShell } from "../../../components/stream-shell"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionMatches } from "../../../lib/match-model"
import { competitionQuery } from "../../../lib/tournament-api"
import { CompetitionAwards } from "../components/competition-awards"
import { CompetitionFacts } from "../components/competition-facts"
import { CompetitionFormat } from "../components/competition-format"
import { CompetitionHead } from "../components/competition-head"
import { CompetitionOverview, type CompetitionTab } from "../components/competition-overview"
import { CompetitionCrew } from "../components/competition-people"
import { CompetitionSchedule } from "../components/competition-schedule"
import { CompetitionStandings } from "../components/competition-standings"
import { CompetitionTeams } from "../components/competition-teams"
import "./competition-page.css"

/** The tabs of a competition, each named in Vietnamese and in English. */
const TABS: readonly [CompetitionTab, readonly [string, string]][] = [
  ["overview", ["Tổng quan", "Overview"]],
  ["matches", ["Lịch & kết quả", "Schedule & results"]],
  ["standings", ["BXH & nhánh đấu", "Standings & bracket"]],
  ["teams", ["Đội tham dự", "Teams"]],
  ["info", ["Thể thức & thông tin", "Format & info"]],
]

/** Filters of the schedule, which belong to its tab only. */
const SCHEDULE_KEYS = ["scope", "stage", "team", "date"]

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
      for (const key of SCHEDULE_KEYS) if (next !== "matches") updated.delete(key)
      return updated
    })
  const openTab = (next: CompetitionTab) => {
    focus.current = next
    setTab(next)
  }
  return { tab, setTab, openTab, focus }
}

/** The tabs of a competition in one row, which keeps the open one in view and takes the focus it is asked to. */
function Tabs({ tab, setTab, focus }: Pick<ReturnType<typeof useTabs>, "tab" | "setTab" | "focus">) {
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
    <div className="tn-sticky-tabs">
      <nav ref={row} className="cp-tabs" data-flush="" aria-label={text("Nội dung giải đấu", "Tournament content")}>
        {TABS.map(([key, label]) => (
          <button key={key} aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)}>
            {text(label[0], label[1])}
          </button>
        ))}
      </nav>
    </div>
  )
}

function BackLink() {
  const { text } = useStreamLocale()
  return (
    <Link className="cp-back" to="/competitions">
      <StreamIcon name="back" size={16} />
      {text("Tất cả giải đấu", "All tournaments")}
    </Link>
  )
}

export function PublicCompetitionPage() {
  const { text } = useStreamLocale()
  const { id = "" } = useParams()
  const query = useQuery(competitionQuery(id))
  const { tab, setTab, openTab, focus } = useTabs()
  if (!query.data)
    return (
      <StreamShell>
        <div className="cp-container">
          <BackLink />
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
  const { tournament } = view.content
  const matches = competitionMatches([view])
  return (
    <StreamShell>
      <title>{`${tournament.name} — AOV Stream`}</title>
      <div className="cp-container tn-comp">
        <BackLink />
        <CompetitionHead view={view} openStages={() => openTab("standings")} />
        <Tabs tab={tab} setTab={setTab} focus={focus} />
        {tab === "overview" && <CompetitionOverview view={view} matches={matches} openTab={openTab} />}
        {tab === "matches" && <CompetitionSchedule entries={matches} />}
        {tab === "standings" && <CompetitionStandings view={view} />}
        {tab === "teams" && <CompetitionTeams view={view} />}
        {tab === "info" && (
          <div className="tn-stack">
            <CompetitionFormat view={view} />
            <div className="tn-info-cards">
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
