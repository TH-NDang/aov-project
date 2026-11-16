import { Link, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { LocalTime } from "@aov/ui/components/local-time"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { ScheduleDays } from "./competition-schedule"
import { GameCard } from "./game-card"
import { MatchHead, MatchTabs, matchHeadOf, matchStateLabels, matchStatus, seriesHeadOf } from "./match-components"
import {
  competitionMatches,
  competitionMatchHref,
  findSeriesMatch,
  matchSeriesId,
  orderedMatchGames,
  type CompetitionMatch,
} from "./match-model"
import { matchSides, scheduleParts } from "./match-schedule"
import { competitionQuery, matchGamesQuery } from "./tournament-api"
import { plainNote } from "./tournament-model"

/** Other matches shown under a match: enough to see how both teams are doing without becoming a schedule. */
const OTHERS = 6

/**
 * The other matches of both teams in the same competition: the next ones first, then their latest results. It gives
 * a match without recorded games somewhere to go on from.
 */
function OtherMatches({ entry }: { entry: CompetitionMatch }) {
  const teams = matchSides(entry).flatMap((side) => side.teamId ?? [])
  const { upcoming, results } = scheduleParts(
    competitionMatches([entry.competition]).filter(
      (other) =>
        other.match.key !== entry.match.key &&
        matchSides(other).some((side) => side.teamId != null && teams.includes(side.teamId)),
    ),
  )
  const ahead = upcoming.slice(0, OTHERS / 2)
  const played = results.slice(0, OTHERS - ahead.length)
  if (!ahead.length && !played.length) return null
  return (
    <section className="tn-schedule-part" aria-labelledby="match-others">
      <div className="tn-heading">
        <h2 id="match-others">
          Trận khác của hai đội <small>trong giải này</small>
        </h2>
      </div>
      <ScheduleDays entries={ahead} part="upcoming" />
      <ScheduleDays entries={played} part="results" />
    </section>
  )
}

/** What the list of games says while it has none, by where the match stands. */
const NO_GAMES = {
  LIVE: "Trận đang diễn ra. Các ván đấu sẽ có ở đây sau khi được ghi nhận.",
  UPCOMING: "Trận chưa diễn ra. Các ván đấu sẽ có ở đây sau khi trận kết thúc.",
  UNSCHEDULED: "Trận chưa diễn ra. Các ván đấu sẽ có ở đây sau khi trận kết thúc.",
  PENDING: "Chưa có ván nào của trận này được ghi nhận.",
  SCORED: "Chưa có ván nào của trận này được ghi nhận.",
  FINISHED: "Chưa có ván nào của trận này được ghi nhận.",
} as const

export function MatchPage() {
  const { text, languageTag } = useStreamLocale()
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
  const tournamentId = id || first?.series.tournamentId
  const competitionName = entry?.competition.content.tournament.name || first?.tournament.name
  const head = entry ? matchHeadOf(entry, languageTag) : first ? seriesHeadOf(first) : null
  const status = entry ? matchStatus(entry) : null
  const series = entry ? entry.competition.content.series[matchSeriesId(entry) || ""] : first?.series
  const note = plainNote(series?.note || "")
  const source = series?.sourceUrl || entry?.competition.content.plan.sourceUrl
  const scheduledAt = entry ? entry.match.scheduledAt : first?.series.scheduledAt
  const list = linkedSeriesId ? orderedMatchGames(games.data || [], linkedSeriesId) : []
  const overview = entry
    ? competitionMatchHref(entry.competition.id, entry.match.key)
    : `/matches/${encodeURIComponent(linkedSeriesId || "")}`
  return (
    <StreamShell>
      <title>{`${head ? `${head.teams[0].name} vs ${head.teams[1].name}` : text("Trận đấu", "Match")} — AOV Stream`}</title>
      <div className="tn-match-page">
        <Link
          className="cp-back"
          to={tournamentId ? `/competitions/${tournamentId}?tab=matches` : "/competitions?tab=schedule"}
        >
          <StreamIcon name="back" size={16} />
          {competitionName || text("Lịch & kết quả", "Schedule & results")}
        </Link>
        {loading ? (
          <div
            className="tn-duel-skeleton hub-skeleton"
            role="status"
            aria-label={text("Đang mở trận đấu", "Opening the match")}
          />
        ) : !head ? (
          <div className="hub-state" role="alert">
            <h1>{text("Chưa mở được trận đấu", "The match could not be opened")}</h1>
            <p>Trận chưa được công bố hoặc liên kết không còn dùng được.</p>
            <div className="hub-state-actions">
              <button
                type="button"
                className="cp-button cp-primary"
                onClick={() => void (id ? competition.refetch() : games.refetch())}
              >
                {text("Thử lại", "Retry")}
              </button>
              <Link className="cp-button" to="/competitions?tab=schedule">
                Xem lịch & kết quả
              </Link>
            </div>
          </div>
        ) : (
          <>
            <MatchHead tint={head.tint} kicker={head.kicker} teams={head.teams}>
              {status ? (
                <span className="hub-status" data-status={status}>
                  {text(matchStateLabels[status][0], matchStateLabels[status][1])}
                </span>
              ) : (
                head.teams.some((team) => team.won) && (
                  <span className="hub-status">{text(...matchStateLabels.FINISHED)}</span>
                )
              )}
              {scheduledAt && (
                <span>
                  <StreamIcon name="calendar" size={14} />
                  <LocalTime
                    value={scheduledAt}
                    sourceTimeZone={entry?.competition.content.plan.timezone}
                    locale={languageTag}
                  />
                </span>
              )}
            </MatchHead>
            {list.length > 0 && (
              <MatchTabs
                games={list.map((game) => ({ id: game.id, number: game.content.number }))}
                overviewHref={overview}
              />
            )}
            <section className="tn-match-games" aria-labelledby="match-games">
              <div className="tn-heading">
                <h2 id="match-games">Các ván đấu {list.length > 0 && <small>{list.length} ván</small>}</h2>
              </div>
              {linkedSeriesId && games.isPending ? (
                <div
                  className="tn-game-list"
                  role="status"
                  aria-label={text("Đang tải các ván của trận", "Loading the games of this match")}
                >
                  {Array.from({ length: 3 }, (_, index) => (
                    <span key={index} className="hub-skeleton" />
                  ))}
                </div>
              ) : games.isError && !games.data ? (
                <p className="tn-quiet" role="alert">
                  {text("Chưa tải được các ván của trận.", "The games of this match could not be loaded.")}{" "}
                  <button type="button" onClick={() => void games.refetch()}>
                    {text("Thử lại", "Retry")}
                  </button>
                </p>
              ) : list.length ? (
                <div className="tn-game-list">
                  {list.map((game) => (
                    <GameCard key={game.id} game={game} layout="row" />
                  ))}
                </div>
              ) : (
                <p className="tn-quiet">{NO_GAMES[status ?? "FINISHED"]}</p>
              )}
              {(note || source) && (
                <footer className="tn-footnote">
                  {note && <p>{note}</p>}
                  {source && (
                    <a href={source} target="_blank" rel="noreferrer noopener">
                      {text("Nguồn trận đấu", "Match source")} <StreamIcon name="external" size={13} />
                    </a>
                  )}
                </footer>
              )}
            </section>
            {entry && <OtherMatches entry={entry} />}
          </>
        )}
      </div>
    </StreamShell>
  )
}
