import { useMemo } from "react"
import { useSearchParams } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { useUserTimeZone } from "@aov/ui/lib/time-zone"
import { useStreamLocale } from "../../../components/stream-locale"
import { filterOptions, passesFilter, type DirectoryFilter } from "../../../lib/competition-filters"
import { competitionMatches } from "../../../lib/match-model"
import { knownScheduleDay, matchSearchKey, scheduleDay, scheduleParts } from "../../../lib/match-schedule"
import { isLongMap } from "../../../lib/season-map"
import { useNow } from "../../../lib/use-now"
import { RegionChips } from "./region-chips"
import { scheduleDayLabel, scheduleScope, ScheduleScopePills } from "./schedule-controls"

/** How far from now a day may be to stand on the strip of days. */
const AROUND = 45 * 86_400_000

/** The directory's tab and filters, kept in the address, and the competitions that pass them. */
export function useDirectoryFilters(items: CompetitionView[]) {
  const [params, setParams] = useSearchParams()
  const tab = params.get("tab") === "schedule" ? "schedule" : "competitions"
  const region = params.get("region") || "all"
  const search = params.get("q") || ""
  const searching = !!search.trim()
  // The map of seasons shows one year, the newest unless another is chosen; a search reaches over all of them.
  const newest = Math.max(0, ...items.map(({ content }) => content.tournament.year ?? 0))
  const mapped = tab === "competitions" && !searching && newest > 0
  const year = tab === "schedule" ? "all" : params.get("year") || (mapped ? String(newest) : "all")
  const filter: DirectoryFilter = { region, year, search }
  // Each list holds what the other filters leave; the busiest region comes first.
  const regions = filterOptions(items, filter, "region", (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const years = filterOptions(items, filter, "year", (a, b) => Number(b[0]) - Number(a[0]))
  const update = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (!value || value === "all" || (key === "tab" && value === "competitions")) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: key === "q" },
    )
  // A map the reader sees whole, its flags beside its circuits, needs no narrowing.
  const long = mapped && isLongMap(items.filter((view) => passesFilter(view, filter, "region")))
  return {
    params,
    tab,
    filter,
    region,
    year,
    search,
    searching,
    regions: regions.map(([code]) => code),
    years: years.map(([value]) => value),
    long,
    update,
    visible: items.filter((view) => passesFilter(view, filter)),
    listKey: [region, year, search].join("|"),
    clearFilters: () => setParams(tab === "schedule" ? { tab: "schedule" } : {}),
  }
}

export type DirectoryFilterState = ReturnType<typeof useDirectoryFilters>

/**
 * The schedule tab: every match of the competitions that pass the filters. Its search also reads team names, and the
 * day chosen on the strip is named above the list.
 */
export function useDirectorySchedule(data: CompetitionView[] | undefined, filters: DirectoryFilterState) {
  const { languageTag } = useStreamLocale()
  const { params, tab, filter, region, search } = filters
  const timeZone = useUserTimeZone()
  const schedule = tab === "schedule"
  const matches = useMemo(
    () => (schedule ? competitionMatches(data || []).map((entry) => ({ entry, key: matchSearchKey(entry) })) : []),
    [data, schedule],
  )
  const switchable = useMemo(() => {
    const whole = scheduleParts(matches.map(({ entry }) => entry))
    return whole.upcoming.length > 0 && whole.results.length > 0
  }, [matches])
  const scope = switchable ? scheduleScope(params.get("scope")) : "all"
  const needle = foldSearchText(search.trim())
  const narrowed = matches
    .filter(
      ({ entry, key }) =>
        passesFilter(entry.competition, { ...filter, search: "" }) && (!needle || key.includes(needle)),
    )
    .map(({ entry }) => entry)
  const day = knownScheduleDay(narrowed, timeZone, params.get("date"))
  // The days worth choosing from are those around now: the schedule reaches back years.
  const now = useNow()
  const near = narrowed.filter(({ match }) => Math.abs(Date.parse(match.scheduledAt || "") - now) < AROUND)
  return {
    schedule,
    switchable,
    scope,
    fixtures: scheduleParts(day ? narrowed.filter((entry) => scheduleDay(entry, timeZone) === day) : narrowed),
    filtered: region !== "all" || !!needle || scope !== "all",
    dayLabel: day && scheduleDayLabel(day, languageTag),
    listKey: [region, day, needle].join("|"),
    near,
    day,
  }
}

export type DirectoryScheduleState = ReturnType<typeof useDirectorySchedule>

/** The regions of the map, offered once it is longer than a screen. The search is the app's own, in the bar above. */
export function MapRegions({ filters: { region, regions, long, update } }: { filters: DirectoryFilterState }) {
  if (!long && region === "all") return null
  return <RegionChips regions={regions} value={region} onChange={(value) => update("region", value)} />
}

/** What is ahead or played, and where. */
export function ScheduleBar({
  filters: { region, regions, update },
  schedule: { switchable, scope },
}: {
  filters: DirectoryFilterState
  schedule: DirectoryScheduleState
}) {
  if (!switchable && regions.length < 2 && region === "all") return null
  return (
    <div className="tn-schedule-bar">
      {switchable && (
        <ScheduleScopePills value={scope} onChange={(value) => update("scope", value)} className="tn-schedule-scope" />
      )}
      <RegionChips
        regions={regions}
        value={region}
        onChange={(value) => update("region", value)}
        className="tn-schedule-regions"
      />
    </div>
  )
}
