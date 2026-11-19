import { useEffect, useRef, type CSSProperties } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { LocalPrizeText } from "@aov/ui/components/local-money"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { StreamImage } from "../../components/stream-image"
import { useStreamLocale } from "../../components/stream-locale"
import { dayRange, hueOf } from "../../components/community-ui"
import { CompetitionLogo, StatusBadge } from "../../components/competition-card"
import { champion, codeName, competitionStatus, TIER_NAMES } from "../../lib/competition-model"
import { competitionMatches } from "../../lib/match-model"
import { competitionQuery } from "../../lib/tournament-api"
import { CompetitionOverview } from "./competition-overview"
import { CompetitionSchedule } from "./competition-schedule"
import { CompetitionStandings } from "./competition-standings"
import { CompetitionTeams } from "./competition-teams"
import { COMPETITION_TABS, requestedTab, tabSearch, type CompetitionTab } from "./competition-page-model"

const hue = (name: string) => ({ "--hub-hue": hueOf(name) }) as CSSProperties

export function PublicCompetitionPage() {
  const { text, languageTag } = useStreamLocale()
  const { id = "" } = useParams()
  const query = useQuery(competitionQuery(id))
  const [params, setParams] = useSearchParams()
  const tab = requestedTab(params.get("tab"))
  const tabButtons = useRef(new Map<CompetitionTab, HTMLButtonElement>())
  const focusTab = useRef<CompetitionTab | null>(null)
  useEffect(() => {
    if (focusTab.current !== tab) return
    focusTab.current = null
    tabButtons.current.get(tab)?.focus()
  }, [tab])
  const openTab = (next: CompetitionTab) => {
    focusTab.current = next
    setTab(next)
  }
  const setTab = (next: CompetitionTab) => setParams((current) => tabSearch(current, next))
  if (!query.data)
    return (
      <StreamShell>
        <Link className="cp-back" to="/competitions">
          <StreamIcon name="back" size={16} />
          {text("Tất cả giải đấu", "All tournaments")}
        </Link>
        <div className="hub-state" role={query.isError ? "alert" : "status"}>
          <h1>{query.isError ? query.error.message : text("Đang tải giải đấu…", "Loading tournament…")}</h1>
          {query.isLoadingError && (
            <button className="cp-button" onClick={() => void query.refetch()}>
              {text("Thử lại", "Retry")}
            </button>
          )}
        </div>
      </StreamShell>
    )
  const view = query.data
  const { tournament, plan, teams, circuit } = view.content
  const matches = competitionMatches([view])
  const won = champion(tournament, teams)
  const status = competitionStatus(view.content)
  const kicker = [tournament.region, codeName(TIER_NAMES, tournament.tier, text)].filter(Boolean).join(" · ")
  return (
    <StreamShell>
      <title>{`${tournament.name} — AOV Stream`}</title>
      <div className="cp-container tn-comp">
        <Link className="cp-back" to="/competitions">
          <StreamIcon name="back" size={16} />
          {text("Tất cả giải đấu", "All tournaments")}
        </Link>
        <header className="tn-comp-head hub-art" style={hue(tournament.name)}>
          <CompetitionLogo name={tournament.name} url={tournament.logoUrl} className="tn-logo-large" />
          <div className="tn-comp-title">
            <span className="hub-kicker">
              {circuit ? (
                <Link to={`/pages/${circuit.code}`}>{circuit.name}</Link>
              ) : (
                plan.circuit || text("Giải đấu", "Tournament")
              )}
              {kicker && ` · ${kicker}`}
            </span>
            <h1>{tournament.name}</h1>
            <div className="hub-banner-stats">
              <StatusBadge status={status} tone="banner" />
              <span>
                <StreamIcon name="calendar" size={14} />
                {dayRange(tournament.startsOn, tournament.endsOn)}
              </span>
              {plan.entrants.length > 0 && (
                <span>
                  <StreamIcon name="users" size={14} />
                  {text(
                    `${plan.entrants.length} đội`,
                    `${plan.entrants.length} ${plan.entrants.length === 1 ? "team" : "teams"}`,
                  )}
                </span>
              )}
              {plan.prizePool && (
                <span>
                  <StreamIcon name="trophy" size={14} />
                  <LocalPrizeText
                    text={plan.prizePool}
                    currency={plan.currency}
                    on={tournament.endsOn ?? tournament.startsOn}
                    locale={languageTag}
                  />
                </span>
              )}
            </div>
          </div>
          {won && (
            <div className="tn-champion">
              <small>{text("Nhà vô địch", "Champion")}</small>
              <span className="tn-champion-team">
                <StreamImage src={"logoUrl" in won.winner ? won.winner.logoUrl : undefined} name={won.winner.name} />
                <strong>{won.winner.name}</strong>
              </span>
              {won.runnerUp && (
                <span>
                  {won.score
                    ? text(`Thắng ${won.score} trước `, `Won ${won.score} against `)
                    : text("Á quân: ", "Runner-up: ")}
                  {won.runnerUp.name}
                </span>
              )}
            </div>
          )}
        </header>
        <nav className="cp-tabs" aria-label={text("Nội dung giải đấu", "Tournament content")}>
          {COMPETITION_TABS.map(([key, label]) => (
            <button
              key={key}
              ref={(button) => {
                if (button) tabButtons.current.set(key, button)
                else tabButtons.current.delete(key)
              }}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key)}
            >
              {text(label[0], label[1])}
            </button>
          ))}
        </nav>
        {tab === "overview" && <CompetitionOverview view={view} matches={matches} openTab={openTab} />}
        {tab === "matches" && <CompetitionSchedule entries={matches} />}
        {tab === "standings" && <CompetitionStandings view={view} matches={matches} />}
        {tab === "teams" && <CompetitionTeams view={view} />}
      </div>
    </StreamShell>
  )
}
