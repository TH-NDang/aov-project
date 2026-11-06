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
  FINISHED: "Đã kết thúc",
  SCORED: "Có tỷ số",
  UPCOMING: "Sắp diễn ra",
  PENDING: "Chờ cập nhật kết quả",
  UNSCHEDULED: "Chờ lịch",
}

export function MatchSummary({ entry, compact = false }: { entry: CompetitionMatch; compact?: boolean }) {
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
          {matchStateLabels[state]}
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
            fallback="Chưa có giờ thi đấu"
          />
          {!compact && ` · ${shownTimeZoneLabel(match.scheduledAt || Date.now())}`}
        </span>
      </div>
    </div>
  )
}

/** Keep a real link for keyboards and new tabs; a normal phone tap opens the quick preview. */
export function MatchRow({ entry }: { entry: CompetitionMatch }) {
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
          title="Chi tiết trận đấu"
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
                Mở trang trận đấu <StreamIcon name="arrow" size={15} />
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
  const query = useQuery(matchGamesQuery(seriesId))
  if (!seriesId) return <p className="cp-muted">Các ván sẽ xuất hiện khi trận được ghi nhận và công bố.</p>
  if (query.isPending)
    return (
      <p className="cp-muted" role="status">
        Đang tải các ván của trận…
      </p>
    )
  if (query.isError && !query.data)
    return (
      <div className="match-query-error" role="alert">
        <p>Chưa tải được các ván của trận.</p>
        <button className="cp-button" onClick={() => void query.refetch()}>
          Thử lại
        </button>
      </div>
    )
  const games = orderedMatchGames(query.data || [], seriesId)
  return (
    <>
      {query.isError && (
        <p className="cp-error" role="alert">
          Chưa cập nhật được dữ liệu. Đang hiển thị bản đã tải.{" "}
          <button onClick={() => void query.refetch()}>Thử lại</button>
        </p>
      )}
      {!games.length ? (
        <p className="cp-muted">Chưa có ván được công bố cho trận này. Lịch và tỷ số trận vẫn được hiển thị ở trên.</p>
      ) : compact ? (
        <div className="match-game-links">
          {games.map((game) => (
            <Link key={game.id} to={`/games/${game.id}`} onClick={onNavigate}>
              <span>Ván {game.content.number}</span>
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
  const query = useQuery(matchGamesQuery(seriesId))
  const games = orderedMatchGames(query.data || [], seriesId)
  return (
    <nav className="match-game-nav" aria-label="Các ván trong trận">
      <Link
        to={matchHref || `/matches/${encodeURIComponent(seriesId)}`}
        aria-current={!activeGameId ? "page" : undefined}
      >
        Tổng quan trận
      </Link>
      {games.map((game) => (
        <Link key={game.id} to={`/games/${game.id}`} aria-current={activeGameId === game.id ? "page" : undefined}>
          Ván {game.content.number}
        </Link>
      ))}
      {query.isPending && <span role="status">Đang tải ván…</span>}
      {query.isError && <button onClick={() => void query.refetch()}>Tải lại danh sách ván</button>}
    </nav>
  )
}

export function ArchivedMatchSummary({ game }: { game: PublishedGame }) {
  const { series, teams } = game
  return (
    <div className="match-summary">
      <div className="match-meta">
        <span>
          {series.stage} · BO{series.bestOf}
        </span>
        <span>Thông tin từ ván đã công bố</span>
      </div>
      <div className="match-scoreboard match-scoreboard-archived">
        {[series.teamAId, series.teamBId].map((id, index) => (
          <span key={id} className="match-team">
            <StreamImage src={teams[id]?.logoUrl} name={teams[id]?.name || "Đội"} />
            <strong>{teams[id]?.shortName || teams[id]?.name || "Chờ đội"}</strong>
            {series.result && <b>{index === 0 ? series.result.scoreA : series.result.scoreB}</b>}
          </span>
        ))}
      </div>
      <p className="cp-meta">{series.name || game.tournament.name}</p>
    </div>
  )
}
