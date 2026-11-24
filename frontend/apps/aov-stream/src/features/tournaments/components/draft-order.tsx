import type { PublishedGame, Side } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import { draftPhases } from "../../../lib/series-model"
import { referenceName, seriesSides, UNKNOWN_REFERENCE } from "../../../lib/tournament-model"
import { ReferenceArt } from "./reference-art"
import "./draft-order.css"

const PHASES = {
  BAN: ["Cấm", "Bans"],
  PICK: ["Chọn", "Picks"],
} as const

/**
 * How the draft went, turn by turn: each turn stands on the line of the team that took it, so the order reads from
 * left to right. Nothing shows while the order is not recorded.
 */
export function DraftOrder({ game }: { game: PublishedGame }) {
  const { text } = useStreamLocale()
  const phases = draftPhases(game)
  const sides = seriesSides(game)
  if (!phases.length || sides.length < 2) return null
  const rounds = { BAN: 0, PICK: 0 }
  const lineOf = (side: Side) => sides.findIndex((item) => item.side === side) + 2
  return (
    <section className="tn-block" aria-labelledby="game-draft">
      <div className="tn-heading">
        <h2 id="game-draft">{text("Thứ tự cấm chọn", "Draft order")}</h2>
      </div>
      <div className="tn-order" tabIndex={0} role="group" aria-labelledby="game-draft">
        <div className="tn-order-teams" aria-hidden="true">
          {sides.map((side) => (
            <span key={side.side} data-side={side.side}>
              {game.teams[side.teamId]?.shortName || game.teams[side.teamId]?.name}
            </span>
          ))}
        </div>
        {phases.map(({ kind, turns }) => {
          rounds[kind] += 1
          return (
            <div className="tn-order-phase" key={turns[0]!.order} data-kind={kind}>
              <h3>
                {text(PHASES[kind][0], PHASES[kind][1])} {rounds[kind]}
              </h3>
              <ol>
                {turns.map((turn, index) => {
                  const team = sides.find((side) => side.side === turn.side)
                  const name = team && (game.teams[team.teamId]?.shortName || game.teams[team.teamId]?.name)
                  const hero = referenceName(game.catalog, "heroes", turn.hero, text(...UNKNOWN_REFERENCE))
                  return (
                    <li
                      key={turn.order}
                      data-side={turn.side}
                      style={{ gridColumn: index + 1, gridRow: lineOf(turn.side) - 1 }}
                      title={`${name}: ${hero}`}
                    >
                      <span className="sr-only">
                        {name}: {hero}
                      </span>
                      <ReferenceArt catalog={game.catalog} kind="heroes" selection={turn.hero} />
                    </li>
                  )
                })}
              </ol>
            </div>
          )
        })}
      </div>
    </section>
  )
}
