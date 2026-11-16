import { Link } from "react-router"
import type { GameSide, PublishedGame } from "@aov/community-contracts"
import { StreamIcon } from "../../components/stream-icon"
import { StreamImage } from "../../components/stream-image"
import { useStreamLocale } from "../../components/stream-locale"
import { ReferenceArt } from "./reference-art"
import { clock, orderedParticipants } from "./tournament-model"

function CardTeam({ game, side }: { game: PublishedGame; side: GameSide }) {
  const { text } = useStreamLocale()
  const team = game.teams[side.teamId]
  return (
    <div className="game-card-team" data-side={side.side}>
      <div className="game-card-team-name">
        <StreamImage src={team?.logoUrl} name={team?.shortName || team?.name || text("Đội", "Team")} />
        <strong>{team?.shortName || team?.name}</strong>
        {game.content.winner === side.side && (
          <span className="game-card-winner" title={text("Đội thắng", "Winning team")}>
            <StreamIcon name="trophy" size={12} />
            {text("Thắng", "Win")}
          </span>
        )}
      </div>
      <span className="game-card-picks">
        {orderedParticipants(side.participants).map((participant) => (
          <ReferenceArt key={participant.lane} catalog={game.catalog} kind="heroes" selection={participant.hero} />
        ))}
      </span>
    </div>
  )
}

export function GameCard({ game }: { game: PublishedGame }) {
  const { text } = useStreamLocale()
  const [first, second] = game.content.sides
  return (
    <Link className="game-card" to={`/games/${game.id}`}>
      <div className="game-card-meta">
        <span>{game.tournament.name}</span>
        <span>
          {game.series.stage || `BO${game.series.bestOf}`} ·{" "}
          {text(`Ván ${game.content.number}`, `Game ${game.content.number}`)}
        </span>
      </div>
      <div className="game-card-matchup">
        {first && <CardTeam game={game} side={first} />}
        <span className="game-card-versus" aria-hidden="true">
          VS
        </span>
        {second && <CardTeam game={game} side={second} />}
      </div>
      <div className="game-card-bottom">
        <span>
          <StreamIcon name="clock" size={14} />
          {game.content.durationSeconds
            ? clock(game.content.durationSeconds)
            : text("Chưa rõ thời lượng", "Unknown duration")}
        </span>
        <span title={game.resolvedContext?.patchTitle || undefined}>
          {game.resolvedContext?.unknown
            ? text("Chưa xác định patch", "Unknown patch")
            : `${game.resolvedContext?.seasonName || ""} · ${game.resolvedContext?.patchCode || text("Patch đã lưu", "Saved patch")}`}
        </span>
        <StreamIcon name="arrow" size={16} />
      </div>
    </Link>
  )
}
