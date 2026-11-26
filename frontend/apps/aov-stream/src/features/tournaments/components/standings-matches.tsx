import type { CompetitionStage } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import type { CompetitionMatch } from "../../../lib/match-model"
import { matchRound } from "../../../lib/match-schedule"
import { roundUnderStep, stepMatchesWords } from "../../../lib/standing-words"
import type { StandingStep } from "../../../lib/standings-steps"
import { ScheduleDays } from "./schedule-list"
import "./standings-matches.css"

/** The matches of the step a table is read at, under their days. Their rows leave out what the headings say. */
export function StandingsMatches({
  stage,
  step,
  entries,
}: {
  stage: Pick<CompetitionStage, "name">
  step: StandingStep
  entries: CompetitionMatch[]
}) {
  const { text, languageTag } = useStreamLocale()
  const byKey = new Map(entries.map((entry) => [entry.match.key, entry]))
  const own = step.matches.flatMap((key) => byKey.get(key) ?? [])
  if (!own.length) return null
  return (
    <div className="tn-steps-matches">
      <h3>{stepMatchesWords(step, text, languageTag)}</h3>
      <ScheduleDays
        entries={own}
        part="results"
        roundOf={(entry) => roundUnderStep(matchRound(entry, languageTag), step, stage.name, text, languageTag)}
      />
    </div>
  )
}
