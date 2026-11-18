import { useRef, useState } from "react"
import { flushSync } from "react-dom"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { CompetitionView } from "@aov/community-contracts"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { competitionCatalogQuery } from "../../lib/tournament-api"
import { byRecency, bySoonest, competitionStatus } from "../../lib/competition-model"
import { CompetitionCard, CompetitionFeature } from "../../components/competition-card"
import { ScheduleEmpty, ScheduleList, ScheduleNote, ScheduleScopePills } from "./competition-schedule"
import { DirectoryFilters, useDirectoryFilters, useDirectorySchedule } from "./competition-hub-filters"

/** Seasons a circuit shows before the rest fold away: two rows of three on a wide screen, three rows on a phone. */
const GROUP_PREVIEW = { wide: 6, compact: 3 }
const AHEAD = ["ONGOING", "UPCOMING", "ANNOUNCED"]

export function CompetitionDirectory() {
  const { text } = useStreamLocale()
  const query = useQuery(competitionCatalogQuery)
  const layout = usePageLayout()
  const items = query.data || []
  const filters = useDirectoryFilters(items)
  const { tab, update, clearFilters } = filters
  const schedule = useDirectorySchedule(query.data, filters)
  return (
    <StreamShell>
      <title>{text("Giải đấu & lịch thi đấu — AOV Stream", "Tournaments & schedule — AOV Stream")}</title>
      <div className="competition-hub cp-container">
        <header className="tn-page-head">
          <div>
            <h1>{text("Giải đấu", "Tournaments")}</h1>
            <p>
              {text(
                "Mùa giải, lịch thi đấu và kết quả từng trận.",
                "Seasons, schedules and the result of every match.",
              )}
            </p>
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
        <DirectoryFilters filters={filters} schedule={schedule} />
        {schedule.schedule && schedule.switchable && layout === "compact" && (
          <ScheduleScopePills value={schedule.scope} onChange={(value) => update("scope", value)} />
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
              {schedule.schedule ? (
                <div className="tn-schedule-view">
                  <ScheduleNote filters={schedule.linked} onClear={schedule.clearLinked} />
                  <ScheduleList
                    upcoming={schedule.fixtures.upcoming}
                    results={schedule.fixtures.results}
                    scope={schedule.scope}
                    competition
                    listKey={schedule.listKey}
                    empty={
                      <ScheduleEmpty
                        filtered={schedule.filtered || schedule.linked.length > 0 || schedule.scope !== "all"}
                        onClear={
                          (layout === "wide" && schedule.filtered) || schedule.linked.length ? undefined : clearFilters
                        }
                      />
                    }
                  />
                </div>
              ) : (
                <CompetitionGroups visible={filters.visible} filtered={filters.filtered} published={items.length} />
              )}
            </>
          )}
        </div>
      </div>
    </StreamShell>
  )
}

/**
 * The competitions tab: what is on or about to start, then each circuit with its seasons, the competitions outside
 * any circuit last. `published` counts every competition, to tell an empty catalog from filters that match nothing.
 */
function CompetitionGroups({
  visible,
  filtered,
  published,
}: {
  visible: CompetitionView[]
  filtered: boolean
  published: number
}) {
  const { text } = useStreamLocale()
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
  if (!ordered.length)
    return (
      <div className="hub-state">
        <h2>
          {published
            ? text("Không có giải phù hợp", "No matching tournaments")
            : text("Chưa có giải đấu được công bố", "No tournaments published yet")}
        </h2>
        <p>
          {published
            ? text("Thử khu vực, năm hoặc trạng thái khác.", "Try another region, year or status.")
            : text("Các mùa giải và lịch thi đấu sẽ xuất hiện tại đây.", "Seasons and schedules will appear here.")}
        </p>
      </div>
    )
  return (
    <>
      {ahead.length > 0 && (
        <section className="tn-group" aria-labelledby="competitions-ahead">
          <div className="tn-heading">
            <h2 id="competitions-ahead">
              {text("Đang và sắp diễn ra", "Current and upcoming")}{" "}
              <small>
                {text(`${ahead.length} giải`, `${ahead.length} ${ahead.length === 1 ? "tournament" : "tournaments"}`)}
              </small>
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
