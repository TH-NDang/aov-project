import type { CompetitionView, PublishedGame, ResolvedContext, StagePatch } from "@aov/community-contracts"
import { dayKeyInZone } from "@aov/ui/lib/time-zone"
import { patchLine } from "./game-feed.ts"
import { findSeriesMatch, planZone } from "./match-model.ts"
import { playWeeks } from "./play-weeks.ts"

/** The patch a game was played on, as far as it is known; `day` (yyyy-mm-dd) is when it came out. */
export type GamePatch = { season: string | null; day: string | null; title: string | null }

/** A patch code that is the day the patch came out; any other code is the wiki's own and says nothing to a reader. */
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Whether a game names the day of its patch by itself. */
export const datedPatch = (context?: ResolvedContext | null) =>
  !!context && !context.unknown && !!context.patchCode && DAY.test(context.patchCode)

/** The patch the plan of a competition names for the week, or the stage, a game was played in. */
export function plannedPatch(
  view: CompetitionView,
  { content, series }: Pick<PublishedGame, "content" | "series">,
): StagePatch | null {
  const { plan } = view.content
  const match = findSeriesMatch(view, content.seriesId)?.match
  const code = match?.stageCode ?? series.stage
  const patches = plan.stages.find((stage) => stage.code === code)?.patches ?? []
  if (!patches.length) return null
  const zone = planZone(plan)
  const dayOf = (at?: string | null) => dayKeyInZone(at, zone) || null
  const days = plan.matches.filter((item) => item.stageCode === code).flatMap((item) => dayOf(item.scheduledAt) ?? [])
  const day = dayOf(match?.scheduledAt ?? series.scheduledAt)
  const line = patchLine(patches, day, day ? (playWeeks(days).get(day) ?? null) : null)
  return line ? (patches[line - 1] ?? null) : null
}

/**
 * The patch of a game. What the game names wins; the line of the plan adds the day where the game knows no more than
 * its season, or nothing. Null where neither knows.
 */
export function gamePatch(context?: ResolvedContext | null, planned?: StagePatch | null): GamePatch | null {
  const season = (!context?.unknown && context?.seasonName) || null
  if (context && datedPatch(context))
    return { season, day: context.patchCode ?? null, title: context.patchTitle || null }
  const line = planned && (!season || !planned.seasonName || planned.seasonName === season) ? planned : null
  if (!season && !line) return null
  return {
    season: season ?? line?.seasonName ?? null,
    day: line?.releasedOn || null,
    title: line?.name || null,
  }
}
