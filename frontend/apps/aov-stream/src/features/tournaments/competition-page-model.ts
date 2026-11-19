import type { CompetitionView, Lane, RosterMembershipContent, TournamentAward } from "@aov/community-contracts"
import { playedOrder } from "../../lib/competition-model"

/** The tabs of a competition, each named in Vietnamese and in English. */
export const COMPETITION_TABS = [
  ["overview", ["Tổng quan", "Overview"]],
  ["matches", ["Lịch & kết quả", "Schedule & results"]],
  ["standings", ["BXH & nhánh đấu", "Standings & bracket"]],
  ["teams", ["Đội tham dự", "Participating teams"]],
] as const
export type CompetitionTab = (typeof COMPETITION_TABS)[number][0]

/** The tab the address asks for. The bracket stands on the standings tab, so `?tab=bracket` opens that tab. */
export function requestedTab(requested: string | null): CompetitionTab {
  return requested === "bracket"
    ? "standings"
    : (COMPETITION_TABS.find(([key]) => key === requested)?.[0] ?? "overview")
}

/** The address query that opens `next`: the overview needs no tab. */
export function tabSearch(current: URLSearchParams, next: CompetitionTab) {
  const updated = new URLSearchParams(current)
  if (next === "overview") updated.delete("tab")
  else updated.set("tab", next)
  // Filters of the schedule belong to that tab only.
  for (const key of ["scope", "stage", "team", "date"]) if (next !== "matches") updated.delete(key)
  return updated
}

/** The main stage of each kind: the table with the most matches and the last elimination stage played. */
export function mainStages(view: CompetitionView) {
  const { plan, standings } = view.content
  const count = (code: string) => plan.matches.filter((match) => match.stageCode === code).length
  const table = [...standings].sort((a, b) => count(b.stageCode) - count(a.stageCode))[0]
  const knockout = playedOrder(plan.stages, plan.matches)
    .filter((stage) => stage.format !== "ROUND_ROBIN" && count(stage.code) > 0)
    .at(-1)
  return { table, knockout }
}

/** Every table in the order its stage is played, and every elimination stage that has matches. */
export function standingsAndBrackets(view: CompetitionView) {
  const { plan } = view.content
  const stages = playedOrder(plan.stages, plan.matches)
  const position = (code: string) => stages.findIndex((stage) => stage.code === code)
  const standings = [...view.content.standings].sort((a, b) => position(a.stageCode) - position(b.stageCode))
  const knockouts = stages.filter(
    (stage) => stage.format !== "ROUND_ROBIN" && plan.matches.some((match) => match.stageCode === stage.code),
  )
  return { standings, knockouts }
}

const LANE_ORDER: Lane[] = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]
const ROSTER_ORDER = ["ACTIVE", "SUBSTITUTE", "UNKNOWN", "INACTIVE"]

/** The players of one team: starters, substitutes, unconfirmed, then inactive, each group in lane order. */
export function teamRoster(rosters: RosterMembershipContent[], teamId: string) {
  const order = (row: RosterMembershipContent) =>
    ROSTER_ORDER.indexOf(row.status ?? "UNKNOWN") * 10 + (row.lane ? LANE_ORDER.indexOf(row.lane) : 9)
  return rosters.filter((row) => row.teamId === teamId).sort((a, b) => order(a) - order(b))
}

/** Awards grouped by title, in the order the titles first appear, since a weekly award names several players. */
export function awardGroups(awards: TournamentAward[]) {
  const groups = new Map<string, TournamentAward[]>()
  for (const award of awards) groups.set(award.title, [...(groups.get(award.title) ?? []), award])
  return [...groups]
}
