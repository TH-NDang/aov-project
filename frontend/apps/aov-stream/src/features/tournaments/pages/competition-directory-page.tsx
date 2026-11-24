import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { CompetitionView } from "@aov/community-contracts"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { ChampionCard } from "../../../components/champion-card"
import { StreamShell } from "../../../components/stream-shell"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionStatus } from "../../../lib/competition-model"
import { aheadCompetitions, circuitGroups, recentChampions } from "../../../lib/directory-model"
import { competitionCatalogQuery } from "../../../lib/tournament-api"
import { CircuitSection } from "../components/circuit-section"
import { DirectoryFilters, useDirectoryFilters, useDirectorySchedule } from "../components/directory-filters"
import { ComingEvent, EventStage } from "../components/event-stage"
import { DirectorySkeleton } from "../components/directory-skeleton"
import { DayStrip } from "../components/day-strip"
import { ScheduleScopePills } from "../components/schedule-controls"
import { ScheduleEmpty, ScheduleList, ScheduleNote } from "../components/schedule-list"
import "./competition-directory-page.css"

/** Champions on the shelf, and circuits shown before the reader scrolls for more. */
const CHAMPIONS = 6
const CIRCUITS = 6

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
      <div className="tn-directory cp-container">
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
        {query.isPending ? (
          <DirectorySkeleton schedule={tab === "schedule"} />
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
            {!schedule.schedule && !filters.filtered && <DirectoryLead items={items} />}
            {items.length > 0 && <DirectoryFilters filters={filters} schedule={schedule} />}
            {schedule.schedule ? (
              <>
                {schedule.switchable && layout === "compact" && (
                  <ScheduleScopePills value={schedule.scope} onChange={(value) => update("scope", value)} />
                )}
                <div className="tn-schedule-view">
                  <DayStrip entries={schedule.near} value={schedule.day} onChange={(day) => update("date", day)} />
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
              </>
            ) : (
              <Circuits
                visible={filters.visible}
                filtered={filters.filtered}
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

/** What leads the directory: the events on now, those that start next, then the latest champions. */
function DirectoryLead({ items }: { items: CompetitionView[] }) {
  const { text } = useStreamLocale()
  const ahead = aheadCompetitions(items)
  const on = ahead.filter((entry) => competitionStatus(entry.content) === "ONGOING")
  const coming = ahead.filter((entry) => !on.includes(entry))
  const champions = recentChampions(items, CHAMPIONS)
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
      {coming.length > 0 && (
        <section className="tn-directory-part" aria-labelledby="competitions-ahead">
          <div className="tn-heading" data-flush="">
            <h2 id="competitions-ahead">{text("Sắp diễn ra", "Coming up")}</h2>
          </div>
          <div className="tn-coming-grid">
            {coming.map((entry) => (
              <ComingEvent key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}
      {champions.length > 0 && (
        <section className="tn-directory-part" aria-labelledby="competitions-champions">
          <div className="tn-heading" data-flush="">
            <h2 id="competitions-champions">{text("Nhà vô địch gần đây", "Recent champions")}</h2>
          </div>
          <div
            className="tn-champ-shelf"
            tabIndex={0}
            role="group"
            aria-label={text("Nhà vô địch gần đây", "Recent champions")}
          >
            {champions.map((entry) => (
              <ChampionCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

/**
 * Every circuit with its seasons. `published` counts every competition, to tell an empty catalog from filters that
 * match nothing.
 */
function Circuits({
  visible,
  filtered,
  published,
  listKey,
  onClear,
}: {
  visible: CompetitionView[]
  filtered: boolean
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
            ? text("Thử khu vực, năm hoặc trạng thái khác.", "Try another region, year or status.")
            : text("Các mùa giải và lịch thi đấu sẽ xuất hiện tại đây.", "Seasons and schedules will appear here.")}
        </p>
        {published > 0 && filtered ? (
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
  return (
    <div className="tn-circuits">
      {rows.map((group) => (
        <CircuitSection key={group.key} group={group} open={filtered} />
      ))}
      <InfiniteScroll
        query={loader}
        label={text("Đang tải thêm giải đấu", "Loading more tournaments")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </div>
  )
}
