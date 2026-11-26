import type { CompetitionStage, CompetitionView } from "@aov/community-contracts"
import { bracketTeams } from "./bracket-journey.ts"
import { stageDrawing } from "./bracket-rounds.ts"
import { playedOrder } from "./competition-model.ts"
import { standingGroups } from "./standings-model.ts"
import { steppedTable, type SteppedTable } from "./standings-steps.ts"

type Table = CompetitionView["content"]["standings"][number]

/** A stage as the standings show it: its table and the steps of it, or the bracket a stage without a table is. */
export type ShownStage = { stage: CompetitionStage; table: Table | null; stepped: SteppedTable | null }

const DAY = 24 * 60 * 60 * 1000

/** Stages played beside each other, such as the groups of an event: they begin within a day and overlap. */
function besideEachOther(view: CompetitionView, stages: CompetitionStage[]): CompetitionStage[][] {
  const { plan } = view.content
  const times = (code: string) =>
    plan.matches
      .filter((match) => match.stageCode === code)
      .map((match) => Date.parse(match.scheduledAt || ""))
      .filter((at) => !Number.isNaN(at))
  const blocks: { stages: CompetitionStage[]; from: number; to: number }[] = []
  for (const stage of stages) {
    const [from, to] = [Math.min(...times(stage.code)), Math.max(...times(stage.code))]
    const last = blocks.at(-1)
    if (last && from - last.from < DAY && from <= last.to) {
      last.stages.push(stage)
      last.to = Math.max(last.to, to)
    } else blocks.push({ stages: [stage], from, to })
  }
  return blocks.map((block) => [...block.stages].sort((x, y) => plan.stages.indexOf(x) - plan.stages.indexOf(y)))
}

/** Every stage that has a table or a bracket, the one played last first, since it decides. */
export function shownStages(view: CompetitionView): ShownStage[] {
  const { plan, standings } = view.content
  const played = playedOrder(
    plan.stages.filter((stage) => plan.matches.some((match) => match.stageCode === stage.code)),
    plan.matches,
  )
  return besideEachOther(view, played)
    .reverse()
    .flat()
    .flatMap((stage): ShownStage[] => {
      const table = standings.find((item) => item.stageCode === stage.code)
      if (!table) return stage.format === "ROUND_ROBIN" ? [] : [{ stage, table: null, stepped: null }]
      return [{ stage, table, stepped: steppedTable(view, table) }]
    })
}

/** The teams of one stage, the one that went furthest first; groups beside each other by the rank of their teams. */
function stageTeams(view: CompetitionView, { stage, table }: ShownStage): string[] {
  if (!table) return bracketTeams(stageDrawing(view, stage))
  return standingGroups(view, table)
    .flatMap(({ rows }) => rows)
    .sort((x, y) => x.rank - y.rank)
    .map(({ teamId }) => teamId)
}

/** Every team of some stages once, each where the first of the stages it played in left it. */
export const teamOrder = (view: CompetitionView, stages: ShownStage[]): string[] => [
  ...new Set(stages.flatMap((shown) => stageTeams(view, shown))),
]
