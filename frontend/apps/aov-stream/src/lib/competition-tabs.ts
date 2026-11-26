import { STATS_KEYS } from "./statistics-routes.ts"

export type CompetitionTab = "overview" | "matches" | "standings" | "stats" | "teams" | "info"

/** What else the address may hold, each belonging to one tab: the filters of the schedule and what is open inside. */
const TAB_KEYS: Partial<Record<CompetitionTab, string[]>> = {
  matches: ["scope", "stage", "team", "date"],
  standings: ["team", "at"],
  stats: STATS_KEYS,
}

/** The address of a tab as it opens: nothing any tab has written there goes along, its own neither. */
export function freshTab(current: URLSearchParams, tab: CompetitionTab): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const key of Object.values(TAB_KEYS).flat()) next.delete(key)
  if (tab === "overview") next.delete("tab")
  else next.set("tab", tab)
  return next
}
