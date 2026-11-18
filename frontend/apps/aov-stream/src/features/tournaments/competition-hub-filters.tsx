import { useMemo } from "react"
import { useSearchParams } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { PublicFilterSheet } from "@aov/ui/components/public-filter-sheet"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { useUserTimeZone } from "@aov/ui/lib/time-zone"
import { competitionStatusLabels } from "../../components/community-ui"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { competitionStatus, type CompetitionStatus } from "../../lib/competition-model"
import { competitionMatches } from "../../lib/match-model"
import { knownScheduleDay, matchSearchKey, scheduleDay, scheduleParts } from "../../lib/match-schedule"
import { FilterSelect, ScheduleScopePills, scheduleDayLabel, scheduleScope } from "./competition-schedule"

/** The directory's tab and filters, kept in the address, and the competitions that pass them. */
export function useDirectoryFilters(items: CompetitionView[]) {
  const [params, setParams] = useSearchParams()
  const tab = params.get("tab") === "schedule" ? "schedule" : "competitions"
  const region = params.get("region") || "all"
  const year = params.get("year") || "all"
  const status = params.get("status") || "all"
  const search = params.get("q") || ""
  const regions = [...new Set(items.map((entry) => entry.content.tournament.region).filter(Boolean))].sort()
  const years = [...new Set(items.map((entry) => entry.content.tournament.year).filter((value) => value != null))].sort(
    (a, b) => b - a,
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
  const visible = items.filter(
    ({ content: { tournament, plan } }) =>
      (region === "all" || region === tournament.region) &&
      (year === "all" || year === String(tournament.year)) &&
      (status === "all" || status === competitionStatus({ tournament, plan })) &&
      (!search.trim() ||
        foldSearchText(`${tournament.name} ${plan.circuit} ${plan.organizer}`).includes(foldSearchText(search.trim()))),
  )
  const filtered = region !== "all" || year !== "all" || status !== "all" || !!search.trim()
  const clearFilters = () => setParams(tab === "schedule" ? { tab: "schedule" } : {})
  return {
    params,
    setParams,
    tab,
    region,
    year,
    status,
    search,
    regions,
    years,
    update,
    visible,
    filtered,
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
  const { params, setParams, tab, region, year, status, search } = filters
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
      const { tournament } = entry.competition.content
      return (
        (region === "all" || region === tournament.region) &&
        (year === "all" || year === String(tournament.year)) &&
        (status === "all" || status === competitionStatus(entry.competition.content)) &&
        (!stage || entry.match.stageCode === stage) &&
        (!needle || key.includes(needle))
      )
    })
    .map(({ entry }) => entry)
  const day = knownScheduleDay(narrowed, timeZone, params.get("date"))
  const fixtures = scheduleParts(day ? narrowed.filter((entry) => scheduleDay(entry, timeZone) === day) : narrowed)
  const fixtureCount =
    (scope === "results" ? 0 : fixtures.upcoming.length) + (scope === "upcoming" ? 0 : fixtures.results.length)
  const selects = Number(filters.regions.length > 1) + Number(filters.years.length > 1)
  const filtered = region !== "all" || year !== "all" || !!needle
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
  const listKey = [region, year, status, stage, day, needle].join("|")
  return { schedule, switchable, scope, fixtures, fixtureCount, selects, filtered, linked, clearLinked, listKey }
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
  const { region, year, status, search, regions, years, update, visible, filtered, clearFilters } = filters
  const scheduled = schedule.schedule
  const regionFilter = (
    <FilterSelect
      label={text("Khu vực", "Region")}
      value={region}
      onChange={(value) => update("region", value)}
      all={text("Mọi khu vực", "All regions")}
      options={regions.map((value) => [value, value])}
    />
  )
  const yearFilter = (
    <FilterSelect
      label={text("Năm", "Year")}
      value={year}
      onChange={(value) => update("year", value)}
      all={text("Mọi năm", "All years")}
      options={years.map((value) => [String(value), String(value)])}
    />
  )
  const competitionFilters = (
    <>
      {regionFilter}
      {yearFilter}
      <FilterSelect
        label={text("Trạng thái giải", "Tournament status")}
        value={status}
        onChange={(value) => update("status", value)}
        all={text("Mọi trạng thái", "All statuses")}
        options={Object.entries(competitionStatusLabels())}
      />
    </>
  )
  const scheduleFilters = (
    <>
      {regions.length > 1 && regionFilter}
      {years.length > 1 && yearFilter}
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
            count={[region, year, ...(scheduled ? [] : [status])].filter((value) => value !== "all").length}
            resetLabel={text("Xóa lọc", "Clear filters")}
            onReset={clearFilters}
            resultLabel={
              scheduled
                ? text(
                    `Xem ${schedule.fixtureCount.toLocaleString(languageTag)} trận`,
                    `Show ${schedule.fixtureCount.toLocaleString(languageTag)} ${schedule.fixtureCount === 1 ? "match" : "matches"}`,
                  )
                : text(
                    `Xem ${visible.length} giải đấu`,
                    `Show ${visible.length} ${visible.length === 1 ? "tournament" : "tournaments"}`,
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
            <button className="competition-clear" onClick={clearFilters}>
              {text("Xóa bộ lọc", "Clear filters")}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
