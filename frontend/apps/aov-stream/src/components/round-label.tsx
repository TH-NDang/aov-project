import { bracketRoundOf, roundWeight } from "../lib/bracket-model"
import type { CompetitionMatch } from "../lib/match-model"
import { StreamIcon } from "./stream-icon"
import "./round-label.css"

/**
 * The round of a match, the later the stronger: a semifinal is bold, a lane's final takes the accent, and the final
 * wears a cup in medal gold.
 */
export function RoundLabel({ entry, label }: { entry: CompetitionMatch; label: string | null }) {
  if (!label) return null
  const round = bracketRoundOf(entry)
  const weight = round && roundWeight(round)
  return (
    <span className="tn-round" data-weight={weight ?? undefined}>
      {weight === "final" && <StreamIcon name="trophy" size={14} />}
      {label}
    </span>
  )
}
