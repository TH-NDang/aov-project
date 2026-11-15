import { Fragment } from "react"
import { Link } from "react-router"
import type { GameSide, PublishedGame } from "@aov/community-contracts"
import { StreamIcon } from "../../components/stream-icon"
import { StreamImage } from "../../components/stream-image"
import { ReferenceArt } from "./reference-art"
import { clock, orderedParticipants, seriesRound, seriesSides, unbroken } from "./tournament-model"

/** The five picks of one side in lane order, underlined in the colour of the side it played on. */
export function PickStrip({ game, side, slot }: { game: PublishedGame; side: GameSide; slot?: "a" | "b" }) {
  return (
    <span className="tn-picks" data-side={side.side} data-slot={slot}>
      <span className="sr-only">{side.side === "BLUE" ? "Phe xanh:" : "Phe đỏ:"}</span>
      {orderedParticipants(side.participants).map((participant) => (
        <ReferenceArt key={participant.lane} catalog={game.catalog} kind="heroes" selection={participant.hero} />
      ))}
    </span>
  )
}

/**
 * One game: its number, how long it lasted, both teams with the winner marked and the five picks of each. Teams keep
 * the order of the series. A card names the round unless the list holds one match only (`round` false) and, in a list
 * that mixes competitions, the competition; `row` is for the games of one match, which the page already names, and
 * lies on one line on a wide screen.
 */
export function GameCard({
  game,
  layout = "card",
  competition = false,
  round: named = true,
}: {
  game: PublishedGame
  layout?: "card" | "row"
  competition?: boolean
  round?: boolean
}) {
  const { number, durationSeconds, winner } = game.content
  const round = layout === "card" && named ? seriesRound(game.series.name) : null
  return (
    <Link className="tn-game" data-layout={layout} to={`/games/${game.id}`}>
      <span className="tn-game-title">
        {round && <span>{round}</span>}
        <b>Ván {number}</b>
      </span>
      <span className="tn-game-time">
        <StreamIcon name="clock" size={13} />
        <span className="sr-only">Thời lượng</span>
        {durationSeconds ? clock(durationSeconds) : "—"}
      </span>
      {seriesSides(game).map((side, index) => {
        const team = game.teams[side.teamId]
        const name = team?.shortName || team?.name || "Đội"
        const slot = index === 0 ? "a" : "b"
        return (
          <Fragment key={side.side}>
            <span
              className="tn-game-team"
              data-slot={slot}
              data-won={winner === side.side || undefined}
              data-lost={(winner && winner !== side.side) || undefined}
            >
              <StreamImage src={team?.logoUrl} name={name} />
              <strong title={team?.name}>{unbroken(name)}</strong>
              {winner === side.side && (
                <span className="tn-win">
                  <StreamIcon name="trophy" size={12} />
                  <span>Thắng</span>
                </span>
              )}
            </span>
            <PickStrip game={game} side={side} slot={slot} />
          </Fragment>
        )
      })}
      {competition && <span className="tn-game-context">{game.tournament.name}</span>}
      {layout === "row" && <StreamIcon name="chevronRight" size={16} />}
    </Link>
  )
}
