import { useRef, useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { slotLabel, type PublishedGame } from "@aov/community-contracts"
import { useIsMobile } from "@aov/ui/hooks/use-mobile"
import { LocalTime } from "@aov/ui/components/local-time"
import { shownTimeZoneLabel, useUserTimeZone } from "@aov/ui/lib/time-zone"
import { PublicDrawer, PublicDrawerContent } from "@aov/ui/components/public-overlay"
import { StreamImage } from "../../components/stream-image"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { GameCard } from "./game-card"
import { matchGamesQuery } from "./tournament-api"
import {
  competitionMatchHref,
  matchSeriesId,
  matchState,
  orderedMatchGames,
  type CompetitionMatch,
} from "./match-model"

export const matchStateLabels = {
  FINISHED: ["Đã kết thúc", "Finished"],
  SCORED: ["Có tỷ số", "Score available"],
  UPCOMING: ["Sắp diễn ra", "Upcoming"],
  PENDING: ["Chờ cập nhật kết quả", "Awaiting result"],
  UNSCHEDULED: ["Chờ lịch", "To be scheduled"],
} as const

export function MatchSummary({ entry, compact = false }: { entry: CompetitionMatch; compact?: boolean }) {
  const { text, languageTag } = useStreamLocale()
  useUserTimeZone()
  const { competition, match, result } = entry
  const { teams, plan } = competition.content
  const a = result?.teamAId || match.a.teamId
  const b = result?.teamBId || match.b.teamId
  const state = matchState(entry)
  const team = (id: string | null | undefined, side: "a" | "b") => {
    const name = (id && (teams[id]?.shortName || teams[id]?.name)) || slotLabel(match[side], teams)
    return (
      <span className="match-team">
        <StreamImage src={id ? teams[id]?.logoUrl : undefined} name={name} />
        <strong>{name}</strong>
      </span>
    )
  }
  return (
    <div className={compact ? "match-summary match-summary-compact" : "match-summary"}>
      <div className="match-meta">
        <span>
          {plan.stages.find((stage) => stage.code === match.stageCode)?.name || match.stageCode} · {match.label} · BO
          {match.bestOf}
        </span>
        <span className="match-state" data-state={state}>
          {text(matchStateLabels[state][0], matchStateLabels[state][1])}
        </span>
      </div>
      <div className="match-scoreboard">
        {team(a, "a")}
        <strong className="match-score">
          {result?.scoreA != null && result?.scoreB != null ? `${result.scoreA} : ${result.scoreB}` : "VS"}
        </strong>
        {team(b, "b")}
      </div>
      <div className="match-meta">
        <span>{competition.content.tournament.name}</span>
        <span>
          <LocalTime
            value={match.scheduledAt}
            sourceTimeZone={plan.timezone}
            format={{ dateStyle: "short", timeStyle: "short" }}
            locale={languageTag}
            fallback={text("Chưa có giờ thi đấu", "No match time yet")}
          />
          {!compact && ` · ${shownTimeZoneLabel(match.scheduledAt || Date.now(), languageTag)}`}
        </span>
      </div>
    </div>
  )
}

/** Keep a real link for keyboards and new tabs; a normal phone tap opens the quick preview. */
export function MatchRow({ entry }: { entry: CompetitionMatch }) {
  const { text } = useStreamLocale()
  const mobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLAnchorElement>(null)
  const href = competitionMatchHref(entry.competition.id, entry.match.key)
  return (
    <>
      <Link
        ref={trigger}
        className="match-row"
        to={href}
        onClick={(event) => {
          if (
            mobile &&
            event.detail > 0 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            !event.altKey &&
            event.button === 0
          ) {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <MatchSummary entry={entry} compact />
        <StreamIcon name="chevronRight" size={17} />
      </Link>
      <PublicDrawer open={open} onOpenChange={setOpen}>
        <PublicDrawerContent
          title={text("Chi tiết trận đấu", "Match details")}
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            trigger.current?.focus({ preventScroll: true })
          }}
        >
          {open && (
            <div className="match-preview">
              <MatchSummary entry={entry} />
              <MatchGamesPanel seriesId={matchSeriesId(entry)} compact onNavigate={() => setOpen(false)} />
              <Link className="cp-button cp-primary" to={href} onClick={() => setOpen(false)}>
                {text("Mở trang trận đấu", "Open the match page")} <StreamIcon name="arrow" size={15} />
              </Link>
            </div>
          )}
        </PublicDrawerContent>
      </PublicDrawer>
    </>
  )
}

export function MatchGamesPanel({
  seriesId,
  compact = false,
  onNavigate,
}: {
  seriesId?: string
  compact?: boolean
  onNavigate?: () => void
}) {
  const { text } = useStreamLocale()
  const query = useQuery(matchGamesQuery(seriesId))
  if (!seriesId)
    return (
      <p className="cp-muted">
        {text(
          "Các ván sẽ xuất hiện khi trận được ghi nhận và công bố.",
          "Games will appear once the match is recorded and published.",
        )}
      </p>
    )
  if (query.isPending)
    return (
      <p className="cp-muted" role="status">
        {text("Đang tải các ván của trận…", "Loading the games of this match…")}
      </p>
    )
  if (query.isError && !query.data)
    return (
      <div className="match-query-error" role="alert">
        <p>{text("Chưa tải được các ván của trận.", "The games of this match could not be loaded.")}</p>
        <button className="cp-button" onClick={() => void query.refetch()}>
          {text("Thử lại", "Retry")}
        </button>
      </div>
    )
  const games = orderedMatchGames(query.data || [], seriesId)
  return (
    <>
      {query.isError && (
        <p className="cp-error" role="alert">
          {text(
            "Chưa cập nhật được dữ liệu. Đang hiển thị bản đã tải.",
            "The data could not be updated. Showing the version already loaded.",
          )}{" "}
          <button onClick={() => void query.refetch()}>{text("Thử lại", "Retry")}</button>
        </p>
      )}
      {!games.length ? (
        <p className="cp-muted">
          {text(
            "Chưa có ván được công bố cho trận này. Lịch và tỷ số trận vẫn được hiển thị ở trên.",
            "No games have been published for this match yet. The match schedule and score are still shown above.",
          )}
        </p>
      ) : compact ? (
        <div className="match-game-links">
          {games.map((game) => (
            <Link key={game.id} to={`/games/${game.id}`} onClick={onNavigate}>
              <span>{text(`Ván ${game.content.number}`, `Game ${game.content.number}`)}</span>
              <StreamIcon name="arrow" size={15} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="game-card-grid">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </>
  )
}

export function MatchGameNavigation({
  seriesId,
  matchHref,
  activeGameId,
}: {
  seriesId: string
  matchHref?: string
  activeGameId?: string
}) {
  const { text } = useStreamLocale()
  const query = useQuery(matchGamesQuery(seriesId))
  const games = orderedMatchGames(query.data || [], seriesId)
  return (
    <nav className="match-game-nav" aria-label={text("Các ván trong trận", "Games in this match")}>
      <Link
        to={matchHref || `/matches/${encodeURIComponent(seriesId)}`}
        aria-current={!activeGameId ? "page" : undefined}
      >
        {text("Tổng quan trận", "Match overview")}
      </Link>
      {games.map((game) => (
        <Link key={game.id} to={`/games/${game.id}`} aria-current={activeGameId === game.id ? "page" : undefined}>
          {text(`Ván ${game.content.number}`, `Game ${game.content.number}`)}
        </Link>
      ))}
      {query.isPending && <span role="status">{text("Đang tải ván…", "Loading games…")}</span>}
      {query.isError && (
        <button onClick={() => void query.refetch()}>{text("Tải lại danh sách ván", "Reload the game list")}</button>
      )}
    </nav>
  )
}

export function ArchivedMatchSummary({ game }: { game: PublishedGame }) {
  const { text } = useStreamLocale()
  const { series, teams } = game
  return (
    <div className="match-summary">
      <div className="match-meta">
        <span>
          {series.stage} · BO{series.bestOf}
        </span>
        <span>{text("Thông tin từ ván đã công bố", "Information from a published game")}</span>
      </div>
      <div className="match-scoreboard match-scoreboard-archived">
        {[series.teamAId, series.teamBId].map((id, index) => (
          <span key={id} className="match-team">
            <StreamImage src={teams[id]?.logoUrl} name={teams[id]?.name || text("Đội", "Team")} />
            <strong>{teams[id]?.shortName || teams[id]?.name || text("Chờ đội", "Team TBD")}</strong>
            {series.result && <b>{index === 0 ? series.result.scoreA : series.result.scoreB}</b>}
          </span>
        ))}
      </div>
      <p className="cp-meta">{series.name || game.tournament.name}</p>
    </div>
  )
}
