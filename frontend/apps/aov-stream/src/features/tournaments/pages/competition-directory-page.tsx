import { useMemo } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { CompetitionView } from "@aov/community-contracts"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { PlaceTrail, useSections } from "../../../components/place-trail"
import { StreamShell } from "../../../components/stream-shell"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionStatus } from "../../../lib/competition-model"
import { aheadCompetitions, circuitGroups } from "../../../lib/directory-model"
import { championBanners } from "../../../lib/season-map"
import { competitionCatalogQuery } from "../../../lib/tournament-api"
import { ChampionRafters } from "../components/champion-rafters"
import { CircuitSection } from "../components/circuit-section"
import { MapRegions, ScheduleBar, useDirectoryFilters, useDirectorySchedule } from "../components/directory-filters"
import { ComingEvent, EventStage } from "../components/event-stage"
import { DirectorySkeleton } from "../components/directory-skeleton"
import { DayStrip } from "../components/day-strip"
import { ScoreRibbon } from "../components/score-ribbon"
import { SeasonMap } from "../components/season-map"
import { YearPills } from "../components/year-pills"
import { ScheduleEmpty, ScheduleList, ScheduleNote } from "../components/schedule-list"
import "./competition-directory-page.css"

/** Circuits listed before the reader scrolls for more, once a search leaves lists of seasons. */
const CIRCUITS = 6

export function CompetitionDirectory() {
  const { text } = useStreamLocale()
  const query = useQuery(competitionCatalogQuery)
  const items = query.data || []
  const filters = useDirectoryFilters(items)
  const { update, clearFilters } = filters
  const schedule = useDirectorySchedule(query.data, filters)
  const whole = schedule.schedule
  const { tournaments } = useSections()
  return (
    <StreamShell
      search={{
        value: filters.search,
        onChange: (value) => update("q", value),
        label: whole
          ? text("Tìm trận đấu theo đội hoặc giải", "Search matches by team or tournament")
          : text("Tìm giải đấu", "Search tournaments"),
        placeholder: whole
          ? text("Tìm đội, giải đấu…", "Search teams, tournaments…")
          : text("Tìm giải đấu, hệ thống giải…", "Search tournaments, circuits…"),
      }}
    >
      <title>
        {whole
          ? text("Lịch thi đấu — AOV Stream", "Schedule — AOV Stream")
          : text("Giải đấu — AOV Stream", "Tournaments — AOV Stream")}
      </title>
      <div className="tn-directory cp-container">
        <h1 className="sr-only">{whole ? text("Lịch thi đấu", "Schedule") : text("Giải đấu", "Tournaments")}</h1>
        {whole && <PlaceTrail places={[tournaments]} current={text("Lịch & kết quả", "Schedule & results")} />}
        {query.isPending ? (
          <DirectorySkeleton schedule={whole} />
        ) : query.isError && !query.data ? (
          <div className="hub-state" role="alert">
            <h2>{text("Chưa tải được giải đấu", "Tournaments could not be loaded")}</h2>
            <p>
              {text(
                "Kho dữ liệu giải đấu chưa phản hồi. Thử lại sau ít phút.",
                "The tournament data store is not answering. Try again in a few minutes.",
              )}
            </p>
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
            {!whole && !filters.searching && <DirectoryLead items={items} />}
            {!whole && items.length > 0 && (
              <div className="tn-heading" data-flush="">
                <h2>{text("Các mùa giải", "Seasons")}</h2>
                <YearPills
                  years={filters.years}
                  value={filters.year}
                  all={filters.searching}
                  onChange={(year) => update("year", year)}
                />
              </div>
            )}
            {whole ? <ScheduleBar filters={filters} schedule={schedule} /> : <MapRegions filters={filters} />}
            {filters.search.trim() && (
              <Link className="tn-search-all" to={`/explore?${new URLSearchParams({ q: filters.search.trim() })}`}>
                {text(
                  `Tìm “${filters.search.trim()}” trên toàn AOV Stream`,
                  `Search all of AOV Stream for “${filters.search.trim()}”`,
                )}
                <StreamIcon name="arrow" size={15} />
              </Link>
            )}
            {whole ? (
              <div className="tn-schedule-view">
                <DayStrip entries={schedule.near} value={schedule.day} onChange={(day) => update("date", day)} />
                <ScheduleNote day={schedule.dayLabel} onClear={() => update("date", "")} />
                <ScheduleList
                  upcoming={schedule.fixtures.upcoming}
                  results={schedule.fixtures.results}
                  scope={schedule.scope}
                  competition
                  listKey={schedule.listKey}
                  empty={
                    <ScheduleEmpty
                      filtered={schedule.filtered || !!schedule.day}
                      onClear={schedule.day ? undefined : clearFilters}
                    />
                  }
                />
              </div>
            ) : (
              <Seasons
                visible={filters.visible}
                year={filters.searching ? null : Number(filters.year)}
                published={items.length}
                listKey={filters.listKey}
                onClear={clearFilters}
              />
            )}
          </>
        )}
      </div>
    </StreamShell>
  )
}

/**
 * What leads the directory: the events on now, the other matches in one line, the events that start next, then the
 * champions of the circuits.
 */
function DirectoryLead({ items }: { items: CompetitionView[] }) {
  const { text } = useStreamLocale()
  const ahead = useMemo(() => aheadCompetitions(items), [items])
  const on = useMemo(() => ahead.filter((entry) => competitionStatus(entry.content) === "ONGOING"), [ahead])
  const coming = ahead.filter((entry) => !on.includes(entry))
  const banners = useMemo(() => championBanners(items), [items])
  return (
    <>
      {on.length > 0 && (
        <section className="tn-directory-part" aria-labelledby="competitions-on">
          <div className="tn-heading" data-flush="">
            <h2 id="competitions-on">{text("Đang diễn ra", "Ongoing")}</h2>
          </div>
          {on.map((entry) => (
            <EventStage key={entry.id} entry={entry} />
          ))}
        </section>
      )}
      <ScoreRibbon items={items} staged={on} />
      {coming.length > 0 && (
        <section className="tn-directory-part" aria-labelledby="competitions-ahead">
          <div className="tn-heading" data-flush="">
            <h2 id="competitions-ahead">{text("Sắp diễn ra", "Coming up")}</h2>
          </div>
          <div className="tn-coming-grid">
            {coming.map((entry) => (
              <ComingEvent key={entry.id} entry={entry} alone={coming.length === 1} />
            ))}
          </div>
        </section>
      )}
      <ChampionRafters banners={banners} />
    </>
  )
}

/**
 * The seasons of a year as a map, or what a search finds in every year, listed by circuit. `published` counts every
 * competition, to tell an empty catalog from a search that finds nothing.
 */
function Seasons({
  visible,
  year,
  published,
  listKey,
  onClear,
}: {
  visible: CompetitionView[]
  /** The year of the map; null for lists. */
  year: number | null
  published: number
  listKey: string
  onClear: () => void
}) {
  const { text } = useStreamLocale()
  const groups = circuitGroups(visible)
  const { rows, loader } = useRevealedRows(groups, listKey, CIRCUITS)
  if (!groups.length)
    return (
      <div className="hub-state">
        <h2>
          {published
            ? text("Không có giải phù hợp", "No matching tournaments")
            : text("Chưa có giải đấu được công bố", "No tournaments published yet")}
        </h2>
        <p>
          {published
            ? text("Thử khu vực, năm hoặc từ khóa khác.", "Try another region, year or search.")
            : text("Các mùa giải và lịch thi đấu sẽ xuất hiện tại đây.", "Seasons and schedules will appear here.")}
        </p>
        {published > 0 ? (
          <button type="button" className="cp-button" onClick={onClear}>
            {text("Xóa bộ lọc", "Clear filters")}
          </button>
        ) : (
          <Link className="cp-button" to="/explore">
            {text("Khám phá đội và tuyển thủ", "Explore teams and players")}
          </Link>
        )}
      </div>
    )
  if (year) return <SeasonMap views={visible} year={year} />
  return (
    <div className="tn-circuits">
      {rows.map((group) => (
        <CircuitSection key={group.key} group={group} open />
      ))}
      <InfiniteScroll
        query={loader}
        label={text("Đang tải thêm giải đấu", "Loading more tournaments")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </div>
  )
}
