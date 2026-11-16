import { Link, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { competitionQuery, matchGamesQuery } from "./tournament-api"
import { competitionMatches, competitionMatchHref, findSeriesMatch, matchSeriesId } from "./match-model"
import { ArchivedMatchSummary, MatchGameNavigation, MatchGamesPanel, MatchSummary } from "./match-components"

export function MatchPage() {
  const { text } = useStreamLocale()
  const { id, matchKey, seriesId } = useParams()
  const competition = useQuery({ ...competitionQuery(id || ""), enabled: !!id })
  const planned = competition.data
    ? competitionMatches([competition.data]).find((entry) => entry.match.key === matchKey)
    : undefined
  const linkedSeriesId = seriesId || (planned && matchSeriesId(planned))
  const games = useQuery(matchGamesQuery(linkedSeriesId))
  const first = games.data?.[0]
  const linkedCompetition = useQuery({ ...competitionQuery(first?.series.tournamentId || ""), enabled: !id && !!first })
  const entry =
    planned || (linkedCompetition.data && seriesId ? findSeriesMatch(linkedCompetition.data, seriesId) : undefined)
  const loading = id ? competition.isPending : games.isPending
  const title = entry?.match.label || first?.series.name || text("Trận đấu", "Match")
  const tournamentId = id || first?.series.tournamentId
  const source = entry
    ? entry.competition.content.series[matchSeriesId(entry) || ""]?.sourceUrl ||
      entry.competition.content.plan.sourceUrl
    : first?.series.sourceUrl
  return (
    <StreamShell>
      <title>{`${title} — AOV Stream`}</title>
      <div className="match-page cp-container">
        <nav className="game-breadcrumb" aria-label={text("Đường dẫn", "Breadcrumb")}>
          <Link to="/competitions">
            <StreamIcon name="back" size={16} />
            {text("Giải đấu", "Tournaments")}
          </Link>
          {tournamentId && (
            <>
              <span aria-hidden="true">/</span>
              <Link to={`/competitions/${tournamentId}?tab=matches`}>
                {entry?.competition.content.tournament.name ||
                  first?.tournament.name ||
                  text("Lịch & kết quả", "Schedule & results")}
              </Link>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span>{title}</span>
        </nav>
        {loading ? (
          <div className="hub-state" role="status">
            {text("Đang mở trận đấu…", "Opening the match…")}
          </div>
        ) : !entry && !first ? (
          <div className="hub-state" role="alert">
            <StreamIcon name="info" size={28} />
            <h1>{text("Chưa mở được trận đấu", "The match could not be opened")}</h1>
            <p>
              {text(
                "Trận chưa được công bố hoặc liên kết không còn khả dụng.",
                "The match has not been published yet, or the link is no longer available.",
              )}
            </p>
            <button className="cp-button" onClick={() => void (id ? competition.refetch() : games.refetch())}>
              {text("Thử lại", "Retry")}
            </button>
          </div>
        ) : (
          <>
            <header className="hub-card match-page-header">
              <h1>{title}</h1>
              {entry ? <MatchSummary entry={entry} /> : <ArchivedMatchSummary game={first!} />}
            </header>
            <section className="hub-card match-page-games">
              {linkedSeriesId && (
                <MatchGameNavigation
                  seriesId={linkedSeriesId}
                  matchHref={entry ? competitionMatchHref(entry.competition.id, entry.match.key) : undefined}
                />
              )}
              <div className="match-games-body">
                <h2>{text("Các ván của trận", "Games of this match")}</h2>
                <p className="cp-meta">
                  {text(
                    "Chọn một ván để xem cấm/chọn, đội hình và trang bị đã ghi nhận.",
                    "Choose a game to see the recorded bans and picks, lineups and equipment.",
                  )}
                </p>
                <MatchGamesPanel seriesId={linkedSeriesId} />
              </div>
            </section>
            {source && (
              <a className="cp-source" href={source} target="_blank" rel="noreferrer noopener">
                {text("Nguồn trận đấu", "Match source")} <StreamIcon name="external" size={13} />
              </a>
            )}
          </>
        )}
      </div>
    </StreamShell>
  )
}
