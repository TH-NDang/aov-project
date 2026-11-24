import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router"
import type { PublishedGame } from "@aov/community-contracts"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import { StreamShell } from "../../../components/stream-shell"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { mvpOf } from "../../../lib/crew-model"
import { orderedMatchGames } from "../../../lib/match-model"
import { dayMonth } from "../../../lib/match-time"
import { gameQuery, matchGamesQuery } from "../../../lib/tournament-api"
import { clock, plainNote } from "../../../lib/tournament-model"
import { MvpFact } from "../components/competition-people"
import { DraftOrder } from "../components/draft-order"
import { EquipmentEvents } from "../components/equipment-events"
import { GameLineup } from "../components/game-lineup"
import { GameTimeline } from "../components/game-timeline"
import { MatchHead, SeriesTrack, seriesHeadOf } from "../components/match-head"
import "./match-page.css"

/** A patch code that is the day the patch came out. */
const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * The patch a game was played on, named by its date where its code is one (the season in front of it carries the
 * year), with its title on hover.
 */
function PatchFact({ game }: { game: PublishedGame }) {
  const { text, languageTag } = useStreamLocale()
  const scope = game.resolvedContext
  if (!scope || scope.unknown) return null
  const { patchCode, seasonName } = scope
  const day =
    patchCode && DAY.test(patchCode)
      ? seasonName
        ? dayMonth(patchCode, languageTag)
        : formatCalendarDate(patchCode, undefined, languageTag)
      : null
  const patch = day ? text(`bản ${day}`, `patch ${day}`) : patchCode
  if (!patch && !seasonName) return null
  return <span title={scope.patchTitle || undefined}>{[seasonName, patch].filter(Boolean).join(", ")}</span>
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
  const { number, durationSeconds, seriesId, sourceUrl, note } = game.content
  const head = seriesHeadOf(game, languageTag)
  const mvp = mvpOf(game.content.mvpPlayerId, game.players)
  return (
    <StreamShell>
      <title>{`${head.teams[0].name} vs ${head.teams[1].name} · ${text(`Ván ${number}`, `Game ${number}`)} — AOV Stream`}</title>
      <div className="tn-match-page" aria-busy={busy || undefined}>
        <div className="tn-match-top">
          <Link className="cp-back" data-flush="" to={`/competitions/${game.series.tournamentId}?tab=matches`}>
            <StreamIcon name="back" size={16} />
            {game.tournament.name}
          </Link>
          <MatchHead
            head={head}
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
                {sourceUrl && (
                  <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
                    <StreamIcon name="play" size={14} />
                    {text("Xem video", "Watch the video")}
                    <StreamIcon name="external" size={12} />
                  </a>
                )}
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
          <summary>{text("Ghi chú và nguồn dữ liệu", "Notes and data sources")}</summary>
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
              <Link className="cp-button" to="/games">
                {text("Về danh sách ván đấu", "Back to the game list")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </StreamShell>
  )
}
