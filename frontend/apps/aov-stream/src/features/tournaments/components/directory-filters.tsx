import { useMemo } from "react"
import { useSearchParams } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { PublicFilterSheet } from "@aov/ui/components/public-filter-sheet"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { useUserTimeZone } from "@aov/ui/lib/time-zone"
import { competitionStatusLabels } from "../../../components/community-ui"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import {
  COMPETITION_KIND_NAMES,
  COMPETITION_KINDS,
  competitionRegionName,
  filterOptions,
  passesFilter,
  type CompetitionKind,
  type DirectoryFilter,
} from "../../../lib/competition-filters"
import { TIER_NAMES, type CompetitionStatus } from "../../../lib/competition-model"
import { competitionMatches } from "../../../lib/match-model"
import { knownScheduleDay, matchSearchKey, scheduleDay, scheduleParts } from "../../../lib/match-schedule"
import { useNow } from "../../../lib/use-now"
import { FilterSelect, ScheduleScopePills, scheduleDayLabel, scheduleScope } from "./schedule-controls"

/** How far from now a day may be to stand on the strip of days. */
const AROUND = 45 * 86_400_000
const TIER_ORDER = ["S", "A", "B", "C", "D"]
const STATUS_ORDER: CompetitionStatus[] = ["ONGOING", "UPCOMING", "ANNOUNCED", "FINISHED"]

/** The directory's tab and filters, kept in the address, and the competitions that pass them. */
export function useDirectoryFilters(items: CompetitionView[]) {
  const [params, setParams] = useSearchParams()
  const tab = params.get("tab") === "schedule" ? "schedule" : "competitions"
  const filter: DirectoryFilter = {
    region: params.get("region") || "all",
    year: params.get("year") || "all",
    status: params.get("status") || "all",
    tier: params.get("tier") || "all",
    kind: params.get("kind") || "all",
    search: params.get("q") || "",
  }
  const { region, year, status, tier, kind, search } = filter
  // Each list counts what its options would show with the other filters as they are; the busiest region comes first.
  const regions = filterOptions(items, filter, "region", (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const years = filterOptions(items, filter, "year", (a, b) => Number(b[0]) - Number(a[0]))
  const statuses = filterOptions(
    items,
    filter,
    "status",
    (a, b) => STATUS_ORDER.indexOf(a[0] as CompetitionStatus) - STATUS_ORDER.indexOf(b[0] as CompetitionStatus),
  )
  const tiers = filterOptions(items, filter, "tier", (a, b) => TIER_ORDER.indexOf(a[0]) - TIER_ORDER.indexOf(b[0]))
  const kinds = filterOptions(
    items,
    filter,
    "kind",
    (a, b) => COMPETITION_KINDS.indexOf(a[0] as CompetitionKind) - COMPETITION_KINDS.indexOf(b[0] as CompetitionKind),
  )
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
  const visible = items.filter((view) => passesFilter(view, filter))
  const active = [region, year, status, tier, kind].filter((value) => value !== "all").length
  const filtered = active > 0 || !!search.trim()
  const listKey = [region, year, status, tier, kind, search].join("|")
  const clearFilters = () => setParams(tab === "schedule" ? { tab: "schedule" } : {})
  return {
    params,
    setParams,
    tab,
    filter,
    region,
    year,
    status,
    tier,
    kind,
    search,
    regions,
    years,
    statuses,
    tiers,
    kinds,
    update,
    visible,
    active,
    filtered,
    listKey,
    clearFilters,
  }
}

export type DirectoryFilterState = ReturnType<typeof useDirectoryFilters>

/**
 * The schedule tab: every match of the competitions that pass the filters. Its search also reads team names, and a
 * filter that only an address can carry (a competition status, a stage, a day) is applied and named above the list.
 */
export function useDirectorySchedule(data: CompetitionView[] | undefined, filters: DirectoryFilterState) {
  const { text, languageTag } = useStreamLocale()
  const items = data || []
  const { params, setParams, tab, filter, region, year, tier, kind, status, search } = filters
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
  const stage = params.get("stage") || ""
  const needle = foldSearchText(search.trim())
  const narrowed = matches
    .filter(({ entry, key }) => {
      return (
        passesFilter(entry.competition, { ...filter, search: "" }) &&
        (!stage || entry.match.stageCode === stage) &&
        (!needle || key.includes(needle))
      )
    })
    .map(({ entry }) => entry)
  const day = knownScheduleDay(narrowed, timeZone, params.get("date"))
  // The days worth choosing from are those around now: the schedule reaches back years.
  const now = useNow()
  const near = narrowed.filter(({ match }) => Math.abs(Date.parse(match.scheduledAt || "") - now) < AROUND)
  const fixtures = scheduleParts(day ? narrowed.filter((entry) => scheduleDay(entry, timeZone) === day) : narrowed)
  const fixtureCount =
    (scope === "results" ? 0 : fixtures.upcoming.length) + (scope === "upcoming" ? 0 : fixtures.results.length)
  const selects =
    Number(filters.regions.length > 1) + Number(filters.years.length > 1) + Number(filters.tiers.length > 1)
  const filtered = region !== "all" || year !== "all" || tier !== "all" || kind !== "all" || !!needle
  const statusName = (competitionStatusLabels()[status as CompetitionStatus] ?? status).toLowerCase()
  const stageName =
    items.flatMap((entry) => entry.content.plan.stages).find((item) => item.code === stage)?.name ?? stage
  const linked = [
    status !== "all" && text(`giải ${statusName}`, `${statusName} tournaments`),
    stage && text(`giai đoạn ${stageName}`, `stage ${stageName}`),
    day && scheduleDayLabel(day, languageTag),
  ].filter((label): label is string => !!label)
  const clearLinked = () =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      for (const key of ["status", "stage", "date"]) next.delete(key)
      return next
    })
  const listKey = [region, year, tier, kind, status, stage, day, needle].join("|")
  return {
    schedule,
    switchable,
    scope,
    fixtures,
    fixtureCount,
    selects,
    filtered,
    linked,
    clearLinked,
    listKey,
    near,
    day,
  }
}

export type DirectoryScheduleState = ReturnType<typeof useDirectorySchedule>

/** The search, the choice between upcoming matches and results, and the filters: in a sheet on phones. */
export function DirectoryFilters({
  filters,
  schedule,
}: {
  filters: DirectoryFilterState
  schedule: DirectoryScheduleState
}) {
  const { text, languageTag } = useStreamLocale()
  const layout = usePageLayout()
  const { region, year, status, tier, kind, search, update, visible, active, filtered, clearFilters } = filters
  const scheduled = schedule.schedule
  const count = (value: number) => value.toLocaleString(languageTag)
  // An option says how many competitions it would show; the one in use reads plainly, as the select's own label.
  const options = (entries: [string, number][], name: (value: string) => string, current: string) =>
    entries.map(([value, n]) => [value, value === current ? name(value) : `${name(value)} (${count(n)})`])
  const regionFilter = (
    <FilterSelect
      label={text("Khu vực", "Region")}
      value={region}
      onChange={(value) => update("region", value)}
      all={text("Mọi khu vực", "All regions")}
      options={options(filters.regions, (value) => competitionRegionName(value, languageTag), region)}
    />
  )
  const yearFilter = (
    <FilterSelect
      label={text("Năm", "Year")}
      value={year}
      onChange={(value) => update("year", value)}
      all={text("Mọi năm", "All years")}
      options={options(filters.years, (value) => value, year)}
    />
  )
  const tierFilter = (
    <FilterSelect
      label={text("Hạng giải", "Tier")}
      value={tier}
      onChange={(value) => update("tier", value)}
      all={text("Mọi hạng", "All tiers")}
      options={options(filters.tiers, (value) => text(...(TIER_NAMES[value] ?? [value, value])), tier)}
    />
  )
  const competitionFilters = (
    <>
      {regionFilter}
      {yearFilter}
      {tierFilter}
      <FilterSelect
        label={text("Loại giải", "Event type")}
        value={kind}
        onChange={(value) => update("kind", value)}
        all={text("Mọi loại giải", "All event types")}
        options={options(filters.kinds, (value) => text(...COMPETITION_KIND_NAMES[value as CompetitionKind]), kind)}
      />
      <FilterSelect
        label={text("Trạng thái giải", "Tournament status")}
        value={status}
        onChange={(value) => update("status", value)}
        all={text("Mọi trạng thái", "All statuses")}
        options={options(
          filters.statuses,
          (value) => competitionStatusLabels()[value as CompetitionStatus] ?? value,
          status,
        )}
      />
    </>
  )
  const scheduleFilters = (
    <>
      {filters.regions.length > 1 && regionFilter}
      {filters.years.length > 1 && yearFilter}
      {filters.tiers.length > 1 && tierFilter}
    </>
  )
  return (
    <div className="competition-filters">
      <label className="stream-search competition-search">
        <StreamIcon name="search" size={16} />
        <input
          aria-label={
            scheduled
              ? text("Tìm trận đấu theo đội hoặc giải", "Search matches by team or tournament")
              : text("Tìm giải đấu", "Search tournaments")
          }
          placeholder={
            scheduled
              ? text("Tìm đội, giải đấu…", "Search teams, tournaments…")
              : text("Tìm giải đấu, hệ thống giải…", "Search tournaments, circuits…")
          }
          value={search}
          onChange={(event) => update("q", event.target.value)}
        />
      </label>
      {scheduled && schedule.switchable && layout === "wide" && (
        <ScheduleScopePills
          value={schedule.scope}
          onChange={(value) => update("scope", value)}
          className="competition-scope"
        />
      )}
      {layout === "compact" ? (
        (!scheduled || schedule.selects > 0) && (
          <PublicFilterSheet
            title={scheduled ? text("Lọc trận đấu", "Filter matches") : text("Lọc giải đấu", "Filter tournaments")}
            triggerLabel={text("Lọc", "Filter")}
            count={scheduled ? [region, year, tier].filter((value) => value !== "all").length : active}
            resetLabel={text("Xóa lọc", "Clear filters")}
            onReset={clearFilters}
            resultLabel={
              scheduled
                ? text(
                    `Xem ${schedule.fixtureCount.toLocaleString(languageTag)} trận`,
                    `Show ${schedule.fixtureCount.toLocaleString(languageTag)} ${schedule.fixtureCount === 1 ? "match" : "matches"}`,
                  )
                : text(
                    `Xem ${count(visible.length)} giải đấu`,
                    `Show ${count(visible.length)} ${visible.length === 1 ? "tournament" : "tournaments"}`,
                  )
            }
          >
            <div className="competition-sheet-filters">{scheduled ? scheduleFilters : competitionFilters}</div>
          </PublicFilterSheet>
        )
      ) : (
        <div className="competition-filter-group">
          {scheduled ? scheduleFilters : competitionFilters}
          {(scheduled ? schedule.filtered : filtered) && (
            <>
              {!scheduled && (
                <span className="competition-result">
                  {text(
                    `${count(visible.length)} giải`,
                    `${count(visible.length)} ${visible.length === 1 ? "tournament" : "tournaments"}`,
                  )}
                </span>
              )}
              <button className="competition-clear" onClick={clearFilters}>
                {text("Xóa bộ lọc", "Clear filters")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
