import type { DraftTurn, PublishedGame, Side } from "@aov/community-contracts"
import { BAN_FACE } from "@aov/ui/components/draft-marks"
import { useStreamLocale } from "../../../components/stream-locale"
import { WatchLink } from "../../../components/watch-link"
import { draftPhases } from "../../../lib/series-model"
import { present, referenceName, seriesSides } from "../../../lib/tournament-model"
import { turnAt } from "../../../lib/watch-rows"
import { timedGame } from "../../../lib/watch-story"
import { ReferenceArt } from "./reference-art"
import "./draft-order.css"

const PHASES = {
  BAN: ["Cấm", "Bans"],
  PICK: ["Chọn", "Picks"],
} as const

/** The hero of a turn, taken by the team called `name`; with the second of the game it was made at, it can be watched. */
function Turn({ game, turn, name, at }: { game: PublishedGame; turn: DraftTurn; name: string; at: number | null }) {
  const { text } = useStreamLocale()
  const known = present(turn.hero)
  const ban = turn.kind === "BAN"
  const hero = referenceName(game.catalog, "heroes", turn.hero, text("không cấm hoặc chưa rõ", "no ban, or not seen"))
  const art = known ? (
    <ReferenceArt catalog={game.catalog} kind="heroes" selection={turn.hero} className={ban ? BAN_FACE : ""} />
  ) : (
    <span
      className={ban ? `tn-order-open ${BAN_FACE}` : "tn-order-open"}
      data-empty={ban || undefined}
      aria-hidden="true"
    />
  )
  if (at == null)
    return (
      <span className="tn-order-turn" title={`${name}: ${hero}`}>
        {art}
        <span className="sr-only">
          {name}: {hero}
        </span>
      </span>
    )
  const unseen = ban
    ? text(`Xem lượt cấm của ${name}`, `Watch a ban of ${name}`)
    : text(`Xem lượt chọn của ${name}`, `Watch a pick of ${name}`)
  const seen = ban
    ? text(`Xem ${name} cấm ${hero}`, `Watch ${name} ban ${hero}`)
    : text(`Xem ${name} chọn ${hero}`, `Watch ${name} pick ${hero}`)
  const { seriesId, number } = game.content
  return (
    <WatchLink seriesId={seriesId} game={number} at={at} label={known ? seen : unseen} className="tn-order-turn">
      {art}
    </WatchLink>
  )
}

/**
 * How the draft went, turn by turn: each turn stands on the line of the team that took it, so the order reads from
 * left to right, and leads into the video where somebody timed it. Nothing shows while the order is not recorded.
 */
export function DraftOrder({ game }: { game: PublishedGame }) {
  const { text } = useStreamLocale()
  const phases = draftPhases(game)
  const sides = seriesSides(game)
  if (!phases.length || sides.length < 2) return null
  const chapter = timedGame(game)
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
                  return (
                    <li key={turn.order} style={{ gridColumn: index + 1, gridRow: lineOf(turn.side) - 1 }}>
                      <Turn game={game} turn={turn} name={name || ""} at={chapter && turnAt(chapter, turn.order)} />
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
