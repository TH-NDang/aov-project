import { Link } from "react-router"
import type { PublishedGame } from "@aov/community-contracts"
import { StreamIcon } from "../../components/stream-icon"
import { StreamImage } from "../../components/stream-image"
import { ReferenceArt } from "./reference-art"
import { clock, orderedParticipants } from "./tournament-model"

export function GameCard({ game }: { game: PublishedGame }) {
  return (
    <Link className="game-card" to={`/games/${game.id}`}>
      <div className="game-card-meta">
        <span>{game.tournament.name}</span>
        <span>
          {game.series.stage || `BO${game.series.bestOf}`}
          <i />
          Ván {game.content.number}
        </span>
      </div>
      <div className="game-card-matchup">
        {game.content.sides.map((side, index) => {
          const team = game.teams[side.teamId]
          return (
            <div className="game-card-team" data-side={side.side} key={side.side}>
              {index === 1 && (
                <span className="game-card-versus" aria-hidden="true">
                  VS
                </span>
              )}
              <div>
                <StreamImage src={team?.logoUrl} name={team?.shortName || team?.name || "Đội"} />
                <strong>{team?.shortName || team?.name}</strong>
                {game.content.winner === side.side && (
                  <span className="game-card-winner" title="Đội thắng">
                    <StreamIcon name="trophy" size={13} />
                  </span>
                )}
              </div>
              <span className="game-card-picks">
                {orderedParticipants(side.participants).map((participant) => (
                  <ReferenceArt
                    key={participant.lane}
                    catalog={game.catalog}
                    kind="heroes"
                    selection={participant.hero}
                  />
                ))}
              </span>
            </div>
          )
        })}
      </div>
      <div className="game-card-bottom">
        <span>
          <StreamIcon name="clock" size={13} />
          {game.content.durationSeconds ? clock(game.content.durationSeconds) : "Chưa rõ thời lượng"}
        </span>
        <span title={game.resolvedContext?.patchTitle || undefined}>
          {game.resolvedContext?.unknown
            ? "Chưa xác định patch"
            : `${game.resolvedContext?.seasonName || ""} · ${game.resolvedContext?.patchCode || "Patch đã lưu"}`}
        </span>
        <StreamIcon name="arrow" size={16} />
      </div>
    </Link>
  )
}
