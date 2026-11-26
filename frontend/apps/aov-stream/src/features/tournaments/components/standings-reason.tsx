import type { CompetitionStage, CompetitionStanding, CompetitionView } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import type { CompetitionMatch } from "../../../lib/match-model"
import type { PlaceZone } from "../../../lib/place-zones"
import { borderReasons, reasonWords } from "../../../lib/standing-reasons"
import { countedMatches } from "../../../lib/standings-steps"
import { OrderNote } from "./standings-table"
import "./standings-reason.css"

/**
 * Why a border between two zones fell between teams level on points: one sentence for every such group of teams. Where
 * no border does, a stage that records no rule still says what it tells level teams apart by.
 */
export function StandingsReason({
  view,
  stage,
  rows,
  zones,
  entries,
  final,
}: {
  view: CompetitionView
  stage: CompetitionStage
  rows: CompetitionStanding[]
  zones: PlaceZone[]
  /** The matches the table counts. */
  entries: CompetitionMatch[]
  final: boolean
}) {
  const { text, languageTag } = useStreamLocale()
  const nameOf = (id: string) => view.content.teams[id]?.shortName || view.content.teams[id]?.name || "?"
  const reasons = borderReasons(stage, rows, zones, countedMatches(entries))
  if (!reasons.length) {
    const level = rows.some((row, index) => row.played > 0 && row.points === rows[index + 1]?.points)
    return level && !stage.tieBreakers.length ? <OrderNote /> : null
  }
  return (
    <div className="tn-reason">
      {reasons.map((reason) => {
        const { lead, figures, outcome } = reasonWords(reason, nameOf, final, text, languageTag)
        return (
          <p key={`${reason.rule}:${reason.teams[0]!.teamId}`}>
            {lead}
            <b>{figures}</b>. {outcome}
          </p>
        )
      })}
    </div>
  )
}
