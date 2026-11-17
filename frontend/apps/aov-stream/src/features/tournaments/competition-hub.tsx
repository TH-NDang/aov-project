import { useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { Link, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { CompetitionView } from "@aov/community-contracts"
import { useUserTimeZone } from "@aov/ui/lib/time-zone"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { competitionStatusLabels } from "../community/community-ui"
import { competitionCatalogQuery } from "./tournament-api"
import { competitionMatches } from "./match-model"
import { byRecency, bySoonest, competitionStatus, type CompetitionStatus } from "./competition-model"
import { CompetitionCard, CompetitionFeature } from "./competition-card"
import {
  FilterSelect,
  ScheduleEmpty,
  ScheduleList,
  ScheduleNote,
  ScheduleScopePills,
  scheduleDayLabel,
  scheduleScope,
} from "./competition-schedule"
import { knownScheduleDay, matchSearchKey, scheduleDay, scheduleParts } from "./match-schedule"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { PublicFilterSheet } from "@aov/ui/components/public-filter-sheet"
import { foldSearchText } from "@aov/ui/lib/search-text"

/** Seasons a circuit shows before the rest fold away: two rows of three on a wide screen, three rows on a phone. */
const GROUP_PREVIEW = { wide: 6, compact: 3 }
const AHEAD = ["ONGOING", "UPCOMING", "ANNOUNCED"]

export function CompetitionDirectory() {
  const { text, languageTag } = useStreamLocale()
  const query = useQuery(competitionCatalogQuery)
  const layout = usePageLayout()
  const [params, setParams] = useSearchParams()
  const tab = params.get("tab") === "schedule" ? "schedule" : "competitions"
  const region = params.get("region") || "all"
  const year = params.get("year") || "all"
  const status = params.get("status") || "all"
  const search = params.get("q") || ""
  const items = query.data || []
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
  const filters = (
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

  // The schedule tab: every match of the competitions that pass the filters. Its search also reads team names, and a
  // filter that only an address can carry (a competition status, a stage, a day) is applied and named above the list.
  const timeZone = useUserTimeZone()
  const schedule = tab === "schedule"
  const matches = useMemo(
    () =>
      schedule ? competitionMatches(query.data || []).map((entry) => ({ entry, key: matchSearchKey(entry) })) : [],
    [query.data, schedule],
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
  const scheduleFilters = (
    <>
      {regions.length > 1 && regionFilter}
      {years.length > 1 && yearFilter}
    </>
  )
  const scheduleSelects = Number(regions.length > 1) + Number(years.length > 1)
  const scheduleFiltered = region !== "all" || year !== "all" || !!needle
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
  // What is on or about to start leads the page; a filtered list is already what the reader asked for.
  const ahead = filtered
    ? []
    : visible
        .filter((entry) => AHEAD.includes(competitionStatus(entry.content) ?? ""))
        .sort((a, b) => {
          const status = competitionStatus(a.content)!
          return (
            AHEAD.indexOf(status) - AHEAD.indexOf(competitionStatus(b.content)!) ||
            (status === "ONGOING" ? byRecency(a, b) : bySoonest(a, b))
          )
        })
  const circuits = new Map<string, CompetitionView[]>()
  for (const entry of [...visible].sort(byRecency)) {
    const key = entry.content.circuit?.id || entry.content.plan.circuit || "other"
    circuits.set(key, [...(circuits.get(key) || []), entry])
  }
  // A circuit with a single season is not worth a heading of its own: those gather at the end.
  const groups = new Map<string, CompetitionView[]>()
  const single: CompetitionView[] = []
  for (const [key, entries] of circuits) {
    if (key === "other" || entries.length === 1) single.push(...entries)
    else groups.set(key, entries)
  }
  if (single.length) groups.set("other", single.sort(byRecency))
  // Circuits follow their newest season; competitions outside any circuit close the list.
  const ordered = [...groups].sort(([a, first], [b, second]) =>
    a === "other" ? 1 : b === "other" ? -1 : byRecency(first[0]!, second[0]!),
  )
  return (
    <StreamShell>
      <title>{text("Giải đấu & lịch thi đấu — AOV Stream", "Tournaments & schedule — AOV Stream")}</title>
      <div className="competition-hub cp-container">
        <header className="tn-page-head">
          <div>
            <h1>{text("Giải đấu", "Tournaments")}</h1>
            <p>Mùa giải, lịch thi đấu và kết quả từng trận.</p>
          </div>
          <Link className="cp-button" to="/games">
            <StreamIcon name="search" size={15} />
            {text("Tra cứu ván đấu", "Game lookup")}
          </Link>
        </header>
        <nav className="cp-tabs" aria-label={text("Nội dung giải đấu", "Tournament content")}>
          <button
            aria-current={tab === "competitions" ? "page" : undefined}
            onClick={() => update("tab", "competitions")}
          >
            {text("Các giải đấu", "Tournaments")}
          </button>
          <button aria-current={tab === "schedule" ? "page" : undefined} onClick={() => update("tab", "schedule")}>
            {text("Lịch & kết quả", "Schedule & results")}
          </button>
        </nav>
        <div className="competition-filters">
          <label className="stream-search">
            <StreamIcon name="search" size={16} />
            <input
              aria-label={schedule ? "Tìm trận đấu theo đội hoặc giải" : text("Tìm giải đấu", "Search tournaments")}
              placeholder={
                schedule ? "Tìm đội, giải đấu…" : text("Tìm giải đấu, hệ thống giải…", "Search tournaments, circuits…")
              }
              value={search}
              onChange={(event) => update("q", event.target.value)}
            />
          </label>
          {schedule && switchable && layout === "wide" && (
            <ScheduleScopePills value={scope} onChange={(value) => update("scope", value)} />
          )}
          {layout === "compact" ? (
            (!schedule || scheduleSelects > 0) && (
              <PublicFilterSheet
                title={schedule ? "Lọc trận đấu" : text("Lọc giải đấu", "Filter tournaments")}
                triggerLabel={text("Lọc", "Filter")}
                count={[region, year, ...(schedule ? [] : [status])].filter((value) => value !== "all").length}
                resetLabel={text("Xóa lọc", "Clear filters")}
                onReset={clearFilters}
                resultLabel={
                  schedule
                    ? `Xem ${fixtureCount.toLocaleString(languageTag)} trận`
                    : text(
                        `Xem ${visible.length} giải đấu`,
                        `Show ${visible.length} ${visible.length === 1 ? "tournament" : "tournaments"}`,
                      )
                }
              >
                <div className="competition-sheet-filters">{schedule ? scheduleFilters : filters}</div>
              </PublicFilterSheet>
            )
          ) : (
            <div className="competition-filter-group">
              {schedule ? scheduleFilters : filters}
              {(schedule ? scheduleFiltered : filtered) && (
                <button className="competition-clear" onClick={clearFilters}>
                  {text("Xóa bộ lọc", "Clear filters")}
                </button>
              )}
            </div>
          )}
        </div>
        {schedule && switchable && layout === "compact" && (
          <ScheduleScopePills value={scope} onChange={(value) => update("scope", value)} />
        )}
        <div className="competition-hub-results">
          {query.isPending ? (
            <div
              className="hub-skeleton-rows"
              role="status"
              aria-label={text("Đang tải giải đấu", "Loading tournaments")}
            />
          ) : query.isError && !query.data ? (
            <div className="hub-state" role="alert">
              <h2>{text("Chưa tải được giải đấu", "Tournaments could not be loaded")}</h2>
              <button className="cp-button" onClick={() => void query.refetch()}>
                {text("Thử lại", "Retry")}
              </button>
            </div>
          ) : (
            <>
              {query.isError && (
                <p className="cp-error" role="alert">
                  {text(
                    "Chưa cập nhật được dữ liệu. Đang hiển thị bản đã tải.",
                    "The data could not be updated. Showing the version already loaded.",
                  )}{" "}
                  <button onClick={() => void query.refetch()}>{text("Thử lại", "Retry")}</button>
                </p>
              )}
              {schedule ? (
                <div className="tn-schedule-view">
                  <ScheduleNote filters={linked} onClear={clearLinked} />
                  <ScheduleList
                    upcoming={fixtures.upcoming}
                    results={fixtures.results}
                    scope={scope}
                    competition
                    listKey={[region, year, status, stage, day, needle].join("|")}
                    empty={
                      <ScheduleEmpty
                        filtered={scheduleFiltered || linked.length > 0 || scope !== "all"}
                        onClear={(layout === "wide" && scheduleFiltered) || linked.length ? undefined : clearFilters}
                      />
                    }
                  />
                </div>
              ) : ordered.length ? (
                <>
                  {ahead.length > 0 && (
                    <section className="tn-group" aria-labelledby="competitions-ahead">
                      <div className="tn-heading">
                        <h2 id="competitions-ahead">
                          Đang và sắp diễn ra <small>{ahead.length} giải</small>
                        </h2>
                      </div>
                      <div className="tn-feature-grid">
                        {ahead.map((entry) => (
                          <CompetitionFeature key={entry.id} entry={entry} />
                        ))}
                      </div>
                    </section>
                  )}
                  {ordered.map(([key, entries]) => (
                    <CircuitGroup key={key} entries={entries} open={filtered} other={key === "other"} />
                  ))}
                </>
              ) : (
                <div className="hub-state">
                  <h2>
                    {items.length
                      ? text("Không có giải phù hợp", "No matching tournaments")
                      : text("Chưa có giải đấu được công bố", "No tournaments published yet")}
                  </h2>
                  <p>
                    {items.length
                      ? text("Thử khu vực, năm hoặc trạng thái khác.", "Try another region, year or status.")
                      : text(
                          "Các mùa giải và lịch thi đấu sẽ xuất hiện tại đây.",
                          "Seasons and schedules will appear here.",
                        )}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </StreamShell>
  )
}

/** One circuit and its seasons, newest first. Older seasons fold away until asked for; a filtered list shows them all. */
function CircuitGroup({ entries, open, other }: { entries: CompetitionView[]; open: boolean; other: boolean }) {
  const { text } = useStreamLocale()
  const [expanded, setExpanded] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const preview = GROUP_PREVIEW[usePageLayout()]
  const fold = () => {
    const before = toggle.current?.getBoundingClientRect().top ?? 0
    flushSync(() => setExpanded(!expanded))
    const after = toggle.current?.getBoundingClientRect().top ?? before
    if (expanded) window.scrollBy({ top: after - before, behavior: "instant" })
  }
  const { circuit, plan } = entries[0]!.content
  const name = other ? text("Các giải đấu khác", "Other tournaments") : circuit?.name || plan.circuit
  const shown = open || expanded ? entries : entries.slice(0, preview)
  const hidden = entries.length - shown.length
  return (
    <section className="tn-group">
      <div className="tn-heading">
        <h2>
          {name}{" "}
          <small>
            {other
              ? `${entries.length} giải`
              : text(`${entries.length} mùa giải`, `${entries.length} ${entries.length === 1 ? "season" : "seasons"}`)}
          </small>
        </h2>
        {!other && circuit?.published && (
          <Link to={`/pages/${circuit.code}`}>
            {text("Hệ thống giải", "Tournament circuit")} <StreamIcon name="arrow" size={14} />
          </Link>
        )}
      </div>
      <div className="tn-card-grid">
        {shown.map((entry) => (
          <CompetitionCard key={entry.id} entry={entry} within={other ? null : name} />
        ))}
      </div>
      {(hidden > 0 || (expanded && !open && entries.length > preview)) && (
        <button ref={toggle} type="button" className="tn-more" aria-expanded={expanded} onClick={fold}>
          {expanded ? text("Thu gọn", "Show less") : `Xem thêm ${hidden} ${other ? "giải" : "mùa giải"}`}
          <StreamIcon name={expanded ? "chevronLeft" : "chevronRight"} size={14} />
        </button>
      )}
    </section>
  )
}
