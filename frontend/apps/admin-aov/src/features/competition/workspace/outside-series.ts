import type { CompetitionPlan, DocumentView, PlannedMatch, SeriesContent } from "@aov/community-contracts"
import { randomId } from "@/lib/random-id"

/**
 * Series that stand outside the schedule as planned matches, linked to the record they already are. Null while the
 * plan has no stage to hold them, or a team of theirs is no entrant: a slot may only name an entrant.
 */
export function plannedFromSeries(
  plan: Pick<CompetitionPlan, "stages" | "entrants" | "matches">,
  series: readonly DocumentView<SeriesContent>[],
): PlannedMatch[] | null {
  const entrants = new Set(plan.entrants.map((entry) => entry.teamId))
  const fallback = plan.stages[0]
  if (!fallback) return null
  if (!series.every(({ content }) => entrants.has(content.teamAId) && entrants.has(content.teamBId))) return null
  return [...series]
    .sort((a, b) => Date.parse(a.content.scheduledAt ?? "") - Date.parse(b.content.scheduledAt ?? ""))
    .map(({ id, content }) => ({
      key: `S_${randomId().slice(0, 8)}`,
      stageCode: plan.stages.find((stage) => stage.code === content.stage)?.code ?? fallback.code,
      round: 1,
      label: content.name ?? null,
      title: content.title ?? null,
      bestOf: content.bestOf,
      scheduledAt: content.scheduledAt ?? null,
      a: { type: "TEAM", teamId: content.teamAId },
      b: { type: "TEAM", teamId: content.teamBId },
      seriesId: id,
    }))
}
