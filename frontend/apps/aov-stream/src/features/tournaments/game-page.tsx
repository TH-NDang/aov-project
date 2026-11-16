import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router"
import type { GameSide, PublishedGame } from "@aov/community-contracts"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { StreamImage } from "../../components/stream-image"
import { GameLoadouts } from "./game-loadouts"
import { MatchHead, MatchTabs, seriesHeadOf } from "./match-components"
import { orderedMatchGames } from "./match-model"
import { ReferenceArt } from "./reference-art"
import { gameQuery, matchGamesQuery } from "./tournament-api"
import {
  clock,
  findReference,
  LANES,
  LANE_SHORT,
  orderedParticipants,
  plainNote,
  referenceName,
  seriesSides,
} from "./tournament-model"

/** A patch code that is the day the patch came out. */
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** One side of the draft: the team, its five picks in lane order and the heroes it banned. */
function Draft({ game, side }: { game: PublishedGame; side: GameSide }) {
  const team = game.teams[side.teamId]
  const name = team?.name || team?.shortName || "Đội chưa có thông tin"
  return (
    <section className="tn-draft" data-side={side.side}>
      <header className="tn-draft-head">
        <StreamImage src={team?.logoUrl} name={team?.shortName || name} />
        <div>
          <h2>{name}</h2>
          <span className="tn-side">{side.side === "BLUE" ? "Phe xanh" : "Phe đỏ"}</span>
        </div>
        {game.content.winner === side.side && (
          <span className="tn-win">
            <StreamIcon name="trophy" size={13} />
            <span>Thắng ván này</span>
          </span>
        )}
      </header>
      <div className="tn-draft-picks">
        {orderedParticipants(side.participants).map((participant) => {
          const player = game.players[participant.playerId || ""]?.nickname
          return (
            <figure className="tn-pick" key={participant.lane}>
              <span className="tn-pick-art">
                <ReferenceArt catalog={game.catalog} kind="heroes" selection={participant.hero} />
                <span className="tn-pick-lane" title={LANES[participant.lane]}>
                  {LANE_SHORT[participant.lane]}
                </span>
                {findReference(game.catalog, "spells", participant.spell)?.iconUrl && (
                  <ReferenceArt
                    catalog={game.catalog}
                    kind="spells"
                    selection={participant.spell}
                    className="tn-pick-spell"
                  />
                )}
              </span>
              <figcaption>
                <strong>{referenceName(game.catalog, "heroes", participant.hero)}</strong>
                {player && <span>{player}</span>}
              </figcaption>
            </figure>
          )
        })}
      </div>
      {side.bans.length > 0 && (
        <p className="tn-draft-bans">
          <b>Cấm</b>
          {side.bans.map((selection, index) => (
            <span className="tn-ban" key={index}>
              <ReferenceArt catalog={game.catalog} kind="heroes" selection={selection} />
              <span>{referenceName(game.catalog, "heroes", selection)}</span>
            </span>
          ))}
        </p>
      )}
    </section>
  )
}

/**
 * One game under the head of its match: which game it is, its length and patch, both drafts, then what the players
 * built. `siblings` are the games of the same match, for the tabs; `busy` marks a game still shown while the next
 * one loads.
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
  const { number, durationSeconds, seriesId, sourceUrl, note } = game.content
  const scope = game.resolvedContext
  const head = seriesHeadOf(game)
  const tabs = siblings.length ? siblings : [game]
  // The patch the game was played on, named by its date where its code is one (the season in front of it carries the
  // year), with its title on hover. The season gives way first where the head is narrow.
  const patchCode =
    scope?.patchCode &&
    (DAY.test(scope.patchCode)
      ? `Bản ${scope.seasonName ? formatCalendarDate(scope.patchCode, { day: "2-digit", month: "2-digit" }) : formatCalendarDate(scope.patchCode)}`
      : scope.patchCode)
  const patch = (
    <span title={scope?.patchTitle || undefined}>
      {scope?.unknown ? (
        "Chưa rõ phiên bản"
      ) : scope?.seasonName && patchCode ? (
        <>
          <span className="tn-duel-season">{scope.seasonName} · </span>
          {patchCode}
        </>
      ) : (
        patchCode || scope?.seasonName || "Phiên bản đã lưu"
      )}
    </span>
  )
  return (
    <StreamShell>
      <title>{`${head.teams[0].name} vs ${head.teams[1].name} · Ván ${number} — AOV Stream`}</title>
      <div className="tn-match-page" aria-busy={busy || undefined}>
        <Link className="cp-back" to={`/competitions/${game.series.tournamentId}?tab=matches`}>
          <StreamIcon name="back" size={16} />
          {game.tournament.name}
        </Link>
        <MatchHead
          tint={head.tint}
          kicker={head.kicker}
          teams={head.teams}
          scoreNote="Tỷ số trận"
          more={
            <>
              {patch}
              {sourceUrl && (
                <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
                  <StreamIcon name="play" size={13} />
                  Xem video
                  <StreamIcon name="external" size={12} />
                </a>
              )}
            </>
          }
        >
          <span className="tn-duel-game">Ván {number}</span>
          <span title="Thời lượng ván đấu">
            <StreamIcon name="clock" size={14} />
            {durationSeconds ? clock(durationSeconds) : "Chưa rõ thời lượng"}
          </span>
        </MatchHead>
        <MatchTabs
          games={tabs.map((item) => ({ id: item.id, number: item.content.number }))}
          overviewHref={`/matches/${encodeURIComponent(seriesId)}`}
          active={game.id}
        />
        <div className="tn-draft-board">
          {seriesSides(game).map((side) => (
            <Draft game={game} side={side} key={side.side} />
          ))}
        </div>
        <GameLoadouts game={game} />
        <footer className="tn-footnote">
          {note && <p>{plainNote(note)}</p>}
          <p>
            Tên và ảnh giữ theo dữ liệu đã xuất bản cho ván này.
            {scope?.includeUnscoped && " Một số mục được đối chiếu từ dữ liệu nền chưa xác định ngày áp dụng."}
          </p>
        </footer>
      </div>
    </StreamShell>
  )
}

export function GamePage() {
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
          <div className="tn-duel-skeleton hub-skeleton" role="status" aria-label="Đang mở ván đấu" />
        ) : (
          <div className="hub-state" role="alert">
            <h1>Chưa mở được ván đấu</h1>
            <p>{query.error?.message}</p>
            <div className="hub-state-actions">
              <button type="button" className="cp-button cp-primary" onClick={() => void query.refetch()}>
                Thử lại
              </button>
              <Link className="cp-button" to="/games">
                Về danh sách ván đấu
              </Link>
            </div>
          </div>
        )}
      </div>
    </StreamShell>
  )
}
