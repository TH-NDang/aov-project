import { Fragment } from "react"
import { Link } from "react-router"
import type { GameSide, PublishedGame } from "@aov/community-contracts"
import { LocalTime } from "@aov/ui/components/local-time"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { clock, orderedParticipants, seriesRound, seriesSides, unbroken } from "../../../lib/tournament-model"
import { ReferenceArt } from "./reference-art"
import "./game-card.css"

/** The five picks of one side in lane order, underlined in the colour of the side it played on. */
function PickStrip({
  game,
  side,
  slot,
  heroId,
}: {
  game: PublishedGame
  side: GameSide
  slot: "a" | "b"
  heroId?: string | null
}) {
  const { text } = useStreamLocale()
  const { winner } = game.content
  return (
    <span
      className="tn-picks"
      data-side={side.side}
      data-slot={slot}
      data-lost={(winner && winner !== side.side) || undefined}
    >
      <span className="sr-only">
        {side.side === "BLUE" ? text("Phe xanh:", "Blue side:") : text("Phe đỏ:", "Red side:")}
      </span>
      {orderedParticipants(side.participants).map((participant) => (
        <ReferenceArt
          key={participant.lane}
          className={heroId && participant.hero.id === heroId ? "tn-pick-marked" : ""}
          catalog={game.catalog}
          kind="heroes"
          selection={participant.hero}
        />
      ))}
    </span>
  )
}

/**
 * One game of a match on a line: its number and length, both teams with the winner marked, and the five picks of
 * each. Teams keep the order of the series. The whole line opens the game. In the list of a hero (`heroId`) its pick
 * is marked among the ten, and the line says who played it, in which round and when.
 */
export function GameRow({ game, heroId }: { game: PublishedGame; heroId?: string | null }) {
  const { text, languageTag } = useStreamLocale()
  const { number, durationSeconds, winner, sides } = game.content
  const named = text(`Ván ${number}`, `Game ${number}`)
  const length = (
    <span>
      <span className="sr-only">{text("Thời lượng", "Duration")} </span>
      {durationSeconds ? clock(durationSeconds) : "–"}
    </span>
  )
  const seat = heroId
    ? sides.flatMap((side) => side.participants).find((participant) => participant.hero.id === heroId)
    : undefined
  const player = seat?.playerId ? game.players[seat.playerId]?.nickname : undefined
  return (
    <Link className="tn-game" data-placed={heroId ? "" : undefined} to={`/games/${game.id}`}>
      {heroId ? (
        <span className="tn-game-title">
          <b>{player || named}</b>
          <span>{seriesRound(game.series, languageTag)}</span>
          <span className="tn-game-when">
            {player && <span>{named}</span>}
            {game.series.scheduledAt && (
              <LocalTime
                value={game.series.scheduledAt}
                format={{ day: "2-digit", month: "2-digit", year: "numeric" }}
                locale={languageTag}
              />
            )}
            {length}
          </span>
        </span>
      ) : (
        <span className="tn-game-title">
          <b>{named}</b>
          {length}
        </span>
      )}
      {seriesSides(game).map((side, index) => {
        const team = game.teams[side.teamId]
        const name = team?.shortName || team?.name || text("Đội", "Team")
        const slot = index === 0 ? "a" : "b"
        const won = winner === side.side
        return (
          <Fragment key={side.side}>
            <span
              className="tn-game-team"
              data-slot={slot}
              data-won={won || undefined}
              data-lost={(winner && !won) || undefined}
            >
              <StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={name} />
              <strong title={team?.name}>{unbroken(name)}</strong>
              {won && (
                <span className="tn-win">
                  <StreamIcon name="trophy" size={14} />
                  <span>{text("Thắng", "Won")}</span>
                </span>
              )}
            </span>
            <PickStrip game={game} side={side} slot={slot} heroId={heroId} />
          </Fragment>
        )
      })}
      <StreamIcon name="chevronRight" size={16} />
    </Link>
  )
}
