import type { DocumentView, TournamentContent } from "@aov/community-contracts"
import { TournamentAwards } from "@/features/esports/components/tournament-awards"
import { CompetitionStatistics } from "../competition-statistics"
import { FinalPlaces } from "./final-places"
import type { FinalOutcome } from "./final-state"
import type { Workspace } from "./parts"

/** The result and the final places first, checked against the matches, then the awards and the recorded games. */
export function FinalStep({
  ws,
  tournament,
  outcome,
}: {
  ws: Workspace
  /** The tournament record, which the final table is written to; absent while it loads. */
  tournament?: DocumentView<TournamentContent>
  outcome: FinalOutcome
}) {
  const { entry, plan } = ws
  const content = tournament?.content ?? entry.content.tournament
  return (
    <div className="space-y-8">
      <FinalPlaces ws={ws} tournament={tournament} content={content} outcome={outcome} />
      <div className="@container">
        <TournamentAwards
          content={content}
          team={(id) => ws.team(id)}
          player={(id) => {
            const known = entry.content.players[id]
            return known && { name: known.nickname, photoUrl: known.photoUrl }
          }}
        />
      </div>
      <CompetitionStatistics
        tournamentId={entry.id}
        seriesIds={plan.matches.flatMap((match) => (match.seriesId ? [match.seriesId] : []))}
      />
    </div>
  )
}
