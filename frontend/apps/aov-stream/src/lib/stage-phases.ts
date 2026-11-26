import type { CompetitionStage, CompetitionView } from "@aov/community-contracts"
import { dayKeyInZone } from "@aov/ui/lib/time-zone"
import { competitionStatus, playedOrder } from "./competition-model.ts"
import { competitionMatches, matchState, planZone, type CompetitionMatch } from "./match-model.ts"

export type StagePhase = {
  stage: CompetitionStage
  /** The first and the last day of its matches as yyyy-mm-dd, on the calendar where the event is played. */
  startsOn: string | null
  endsOn: string | null
  matches: number
  played: number
  state: "DONE" | "NOW" | "NEXT"
}

const decided = (entry: CompetitionMatch) => {
  const state = matchState(entry)
  return state === "FINISHED" || state === "SCORED"
}

/** The stages of a competition that have matches, in the order they are played, with how far each has come. */
export function stagePhases(view: CompetitionView, now = Date.now()): StagePhase[] {
  const { plan } = view.content
  const zone = planZone(plan)
  const entries = competitionMatches([view])
  const over = competitionStatus(view.content, now) === "FINISHED"
  return playedOrder(plan.stages, plan.matches).flatMap((stage): StagePhase[] => {
    const own = entries.filter((entry) => entry.match.stageCode === stage.code)
    if (!own.length) return []
    const days = own
      .flatMap((entry) => entry.match.scheduledAt || [])
      .map((at) => dayKeyInZone(at, zone))
      .filter(Boolean)
      .sort()
    const played = own.filter(decided).length
    const started = played > 0 || (!!days[0] && days[0] <= dayKeyInZone(now, zone))
    return [
      {
        stage,
        startsOn: days[0] ?? null,
        endsOn: days.at(-1) ?? null,
        matches: own.length,
        played,
        state: over || played === own.length ? "DONE" : started ? "NOW" : "NEXT",
      },
    ]
  })
}

/** How many matches of a competition are decided, out of how many. */
export function competitionProgress(view: CompetitionView) {
  const entries = competitionMatches([view])
  return { played: entries.filter(decided).length, total: entries.length }
}
