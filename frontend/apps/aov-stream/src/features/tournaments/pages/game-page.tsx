import { useMemo } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router"
import type { PublishedGame } from "@aov/community-contracts"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import { useAhead } from "../../../components/on-demand"
import { PlaceSteps, PlaceTrail, useSections, type Place, type Step } from "../../../components/place-trail"
import { StreamShell } from "../../../components/stream-shell"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { WatchLink } from "../../../components/watch-link"
import { mvpOf } from "../../../lib/crew-model"
import { datedPatch, gamePatch, plannedPatch } from "../../../lib/game-patch"
import { findSeriesMatch, orderedMatchGames } from "../../../lib/match-model"
import { dayMonth } from "../../../lib/match-time"
import { beside } from "../../../lib/neighbours"
import { competitionQuery, gameQuery, matchGamesQuery } from "../../../lib/tournament-api"
import { clock, plainNote } from "../../../lib/tournament-model"
import { gameWatch } from "../../../lib/watch-story"
import { MvpFact } from "../components/competition-people"
import { competitionMark } from "../components/competition-mark"
import { DraftOrder } from "../components/draft-order"
import { EquipmentEvents } from "../components/equipment-events"
import { GameLineup } from "../components/game-lineup"
import { GameTimeline } from "../components/game-timeline"
import { MatchHead, SeriesTrack, matchHeadOf, seriesHeadOf } from "../components/match-head"
import { roomInside } from "../components/room-inside"
import { StreamHead } from "../../../components/stream-head"
import "./match-page.css"

/**
 * The patch a game was played on, named by its day (the season in front of it carries the year) with its title on
 * hover. A game that knows no more than its season is placed by the patches of the competition.
 */
function PatchFact({ game }: { game: PublishedGame }) {
  const { text, languageTag } = useStreamLocale()
  const competition = useQuery({
    ...competitionQuery(game.series.tournamentId),
    enabled: !datedPatch(game.resolvedContext),
  })
  const patch = gamePatch(game.resolvedContext, competition.data && plannedPatch(competition.data, game))
  if (!patch) return null
  const { season, day, title } = patch
  const named =
    day &&
    (season?.includes(day.slice(0, 4)) ? dayMonth(day, languageTag) : formatCalendarDate(day, undefined, languageTag))
  return (
    <span title={title || undefined}>
      {[season, named ? text(`bản ${named}`, `patch ${named}`) : title].filter(Boolean).join(", ")}
    </span>
  )
}

/** The way into the video of the match: to this game where that is known, else to the video alone. */
function WatchFact({ game, siblings }: { game: PublishedGame; siblings: PublishedGame[] }) {
  const { text } = useStreamLocale()
  const { seriesId, number } = game.content
  const lead = gameWatch(game, siblings.some(({ id }) => id === game.id) ? siblings : undefined)
  useAhead(roomInside, !!lead)
  if (!lead) return null
  const own = lead === "GAME"
  return (
    <WatchLink seriesId={seriesId} game={own ? number : undefined}>
      <StreamIcon name="play" size={14} />
      {own ? text(`Xem ván ${number}`, `Watch game ${number}`) : text("Xem video của trận", "Watch the match's video")}
    </WatchLink>
  )
}

/**
 * One game under the head of its match: which game it is, its length and patch, the lineups with what the players
 * built, then how the draft and the game went. `siblings` are the games of the same match; `busy` marks a game still
 * shown while the next one loads.
 */
function PublishedGameView({
  game,
  siblings,
  busy,
}: {
  game: PublishedGame
  siblings: PublishedGame[]
  busy: boolean
}) {
  const { text, languageTag } = useStreamLocale()
  const { number, durationSeconds, seriesId, note } = game.content
  const competition = useQuery(competitionQuery(game.series.tournamentId))
  const planned = useMemo(
    () => competition.data && findSeriesMatch(competition.data, seriesId),
    [competition.data, seriesId],
  )
  const series = seriesHeadOf(game, languageTag)
  // The round as its match names it, with its weight, once the plan is read; the sides keep the order of the series.
  const head = planned ? { ...series, round: matchHeadOf(planned, languageTag).round } : series
  const { tournaments } = useSections()
  const [a, b] = head.teams
  const places: Place[] = [
    tournaments,
    {
      to: `/competitions/${game.series.tournamentId}?tab=matches`,
      name: game.tournament.name,
      mark: competitionMark(game.tournament),
    },
    { to: `/matches/${encodeURIComponent(seriesId)}`, name: `${a.shortName || a.name} – ${b.shortName || b.name}` },
  ]
  const near = beside(
    siblings,
    siblings.findIndex((item) => item.id === game.id),
  )
  const step = (other: PublishedGame | null): Step | null =>
    other && { to: `/games/${other.id}`, name: text(`Ván ${other.content.number}`, `Game ${other.content.number}`) }
  const steps = (
    <PlaceSteps
      label={text("Ván liền kề", "Games before and after")}
      before={step(near.before)}
      after={step(near.after)}
    />
  )
  const mvp = mvpOf(game.content.mvpPlayerId, game.players)
  return (
    <StreamShell>
      <StreamHead
        title={`${head.teams[0].name} vs ${head.teams[1].name} · ${text(`Ván ${number}`, `Game ${number}`)} — AOV Stream`}
        description={text(
          `Ván ${number} giữa ${head.teams[0].name} và ${head.teams[1].name} tại ${game.tournament.name}: tướng, trang bị và chỉ số từng tuyển thủ.`,
          `Game ${number} between ${head.teams[0].name} and ${head.teams[1].name} at ${game.tournament.name}: heroes, items and every player's statistics.`,
        )}
      />
      <div className="tn-match-page" aria-busy={busy || undefined}>
        <div className="tn-match-top">
          <MatchHead
            head={head}
            trail={<PlaceTrail places={places} steps={steps} />}
            bar={{ places, steps }}
            scoreNote={text("Tỷ số trận", "Match score")}
            facts={
              <>
                <strong>{text(`Ván ${number}`, `Game ${number}`)}</strong>
                <span title={text("Thời lượng ván đấu", "Game length")}>
                  <StreamIcon name="clock" size={15} />
                  {durationSeconds ? clock(durationSeconds) : text("Chưa rõ thời lượng", "Unknown duration")}
                </span>
                {mvp && <MvpFact label={text("MVP ván", "Game MVP")} player={mvp} />}
                <PatchFact game={game} />
                <WatchFact game={game} siblings={siblings} />
              </>
            }
            foot={
              <SeriesTrack
                games={siblings.length ? siblings : [game]}
                overviewHref={`/matches/${encodeURIComponent(seriesId)}`}
                active={game.id}
              />
            }
          />
        </div>
        <GameLineup game={game} />
        <DraftOrder game={game} />
        <GameTimeline game={game} />
        <EquipmentEvents game={game} />
        <details className="tn-notes">
          <summary>
            {text("Ghi chú và nguồn dữ liệu", "Notes and data sources")}
            <StreamIcon name="chevronDown" size={14} />
          </summary>
          {note && <p>{plainNote(note)}</p>}
          <p>
            {text(
              "Tên và ảnh giữ theo dữ liệu đã xuất bản cho ván này.",
              "Names and pictures stay as published for this game.",
            )}
            {game.resolvedContext?.includeUnscoped &&
              text(
                " Một số mục được đối chiếu từ dữ liệu nền chưa xác định ngày áp dụng.",
                " Some entries were matched against baseline data with no known effective date.",
              )}
          </p>
        </details>
      </div>
    </StreamShell>
  )
}

export function GamePage() {
  const { text } = useStreamLocale()
  const { id = "" } = useParams()
  const query = useQuery({ ...gameQuery(id), placeholderData: keepPreviousData })
  const seriesId = query.data?.content.seriesId
  const series = useQuery(matchGamesQuery(seriesId))
  const siblings = seriesId ? orderedMatchGames(series.data || [], seriesId) : []
  // A game of the match already in memory opens at once; otherwise the one being read stays until the next arrives.
  const game = siblings.find((item) => item.id === id) ?? query.data
  if (game) return <PublishedGameView game={game} siblings={siblings} busy={game.id !== id} key={game.id} />
  return (
    <StreamShell>
      <div className="tn-match-page">
        {query.isPending ? (
          <div
            className="tn-duel-skeleton hub-skeleton"
            role="status"
            aria-label={text("Đang mở ván đấu", "Opening the game")}
          />
        ) : (
          <div className="hub-state" role="alert">
            <h1>{text("Chưa mở được ván đấu", "The game could not be opened")}</h1>
            <p>{query.error?.message}</p>
            <div className="hub-state-actions">
              <button type="button" className="cp-button cp-primary" onClick={() => void query.refetch()}>
                {text("Thử lại", "Retry")}
              </button>
              <Link className="cp-button" to="/competitions">
                {text("Về trang Giải đấu", "Back to tournaments")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </StreamShell>
  )
}
