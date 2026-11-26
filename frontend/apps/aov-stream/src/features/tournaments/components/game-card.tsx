import { Fragment } from "react"
import { Link } from "react-router"
import type { GameSide, PublishedGame } from "@aov/community-contracts"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { clock, orderedParticipants, seriesSides, unbroken } from "../../../lib/tournament-model"
import { ReferenceArt } from "./reference-art"
import "./game-card.css"

/** The five picks of one side in lane order, underlined in the colour of the side it played on. */
function PickStrip({ game, side, slot }: { game: PublishedGame; side: GameSide; slot: "a" | "b" }) {
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
        {side.side === "BLUE" ? text("Bên xanh:", "Blue side:") : text("Bên đỏ:", "Red side:")}
      </span>
      {orderedParticipants(side.participants).map((participant) => (
        <ReferenceArt key={participant.lane} catalog={game.catalog} kind="heroes" selection={participant.hero} />
      ))}
    </span>
  )
}

/**
 * One game of a match on a line: its number and length, both teams with the winner marked, and the five picks of
 * each. Teams keep the order of the series. The whole line opens the game.
 */
export function GameRow({ game }: { game: PublishedGame }) {
  const { text } = useStreamLocale()
  const { number, durationSeconds, winner } = game.content
  return (
    <Link className="tn-game" to={`/games/${game.id}`}>
      <span className="tn-game-title">
        <b>{text(`Ván ${number}`, `Game ${number}`)}</b>
        <span>
          <span className="sr-only">{text("Thời lượng", "Duration")} </span>
          {durationSeconds ? clock(durationSeconds) : "–"}
        </span>
      </span>
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
            <PickStrip game={game} side={side} slot={slot} />
          </Fragment>
        )
      })}
      <StreamIcon name="chevronRight" size={16} />
    </Link>
  )
}
