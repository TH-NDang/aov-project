import type { ReactNode } from "react"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { useUserTimeZone } from "@aov/ui/lib/time-zone"
import { useStreamLocale } from "../../../components/stream-locale"
import type { CompetitionMatch } from "../../../lib/match-model"
import { dayHeading, scheduleGroups, type ScheduleGroup, type ScheduleScope } from "../../../lib/match-schedule"
import { useNow } from "../../../lib/use-now"
import { MatchRow } from "./match-row"

/** Matches shown before the reader scrolls for more. */
const STEP = 40

/** A filter that came with the address and has no control of its own: said in words, with the way out beside it. */
export function ScheduleNote({ filters, onClear }: { filters: string[]; onClear: () => void }) {
  const { text } = useStreamLocale()
  if (!filters.length) return null
  return (
    <p className="tn-schedule-note">
      <span>{text(`Đang xem ${filters.join(", ")}.`, `Showing ${filters.join(", ")}.`)}</span>
      <button type="button" onClick={onClear}>
        {text("Xem tất cả", "See all")}
      </button>
    </p>
  )
}

type Part = "upcoming" | "results"
const PART_TITLES: Record<Part, readonly [string, string]> = {
  upcoming: ["Lịch đấu", "Schedule"],
  results: ["Kết quả", "Results"],
}

function DayTitle({ group, part, timeZone, now }: { group: ScheduleGroup; part: Part; timeZone: string; now: number }) {
  const { text, languageTag } = useStreamLocale()
  if (group.key === "live")
    return (
      <h3 className="tn-day-title">
        <span className="tn-live">{text("Đang diễn ra", "Live")}</span>
      </h3>
    )
  if (group.at == null)
    return (
      <h3 className="tn-day-title">
        {part === "upcoming" ? text("Chờ xếp lịch", "To be scheduled") : text("Chưa rõ ngày", "Unknown date")}
      </h3>
    )
  const { near, date } = dayHeading(group.at, timeZone, now, languageTag)
  return (
    <h3 className="tn-day-title">
      {near && <b>{near}</b>}
      <span>{date}</span>
    </h3>
  )
}

/**
 * Matches already in reading order, under a heading for each day of the reader's zone. `part` says which side of
 * now they are on, which names the group of matches without a date.
 */
export function ScheduleDays({
  entries,
  part,
  competition = false,
}: {
  entries: CompetitionMatch[]
  part: Part
  competition?: boolean
}) {
  const timeZone = useUserTimeZone()
  const now = useNow()
  return scheduleGroups(entries, timeZone, now).map((group) => (
    <div className="tn-day" key={group.key}>
      <DayTitle group={group} part={part} timeZone={timeZone} now={now} />
      <div className="tn-fixtures">
        {group.items.map((entry) => (
          <MatchRow key={`${entry.competition.id}:${entry.match.key}`} entry={entry} competition={competition} />
        ))}
      </div>
    </div>
  ))
}

/**
 * A schedule in reading order: what is on now and what comes next, then what was played from the newest back. Days
 * of the reader's zone are the headings and more rows come as the reader scrolls. `scope` keeps one part only;
 * `listKey` names the filters in use, so a change starts again from the first rows.
 */
export function ScheduleList({
  upcoming,
  results,
  scope,
  competition = false,
  listKey,
  empty,
}: {
  upcoming: CompetitionMatch[]
  results: CompetitionMatch[]
  scope: ScheduleScope
  /** Names the competition on each row, for a list that mixes several. */
  competition?: boolean
  listKey: string
  empty: ReactNode
}) {
  const { text, languageTag } = useStreamLocale()
  const ahead = scope === "results" ? [] : upcoming
  const played = scope === "upcoming" ? [] : results
  const { rows, loader } = useRevealedRows([...ahead, ...played], `${listKey}:${scope}`, STEP)
  if (!ahead.length && !played.length) return <>{empty}</>
  const parts: [Part, number, CompetitionMatch[]][] = [
    ["upcoming", ahead.length, rows.slice(0, ahead.length)],
    ["results", played.length, rows.slice(ahead.length)],
  ]
  return (
    <div className="tn-schedule">
      {parts.map(
        ([part, total, shown]) =>
          shown.length > 0 && (
            <section className="tn-schedule-part" key={part} aria-labelledby={`schedule-${part}`}>
              <div className="tn-heading" data-flush="">
                <h2 id={`schedule-${part}`}>
                  {text(...PART_TITLES[part])}{" "}
                  <small>
                    {text(
                      `${total.toLocaleString(languageTag)} trận`,
                      `${total.toLocaleString(languageTag)} ${total === 1 ? "match" : "matches"}`,
                    )}
                  </small>
                </h2>
              </div>
              <ScheduleDays entries={shown} part={part} competition={competition} />
            </section>
          ),
      )}
      <InfiniteScroll
        query={loader}
        label={text("Đang tải thêm trận đấu", "Loading more matches")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </div>
  )
}

/**
 * What a schedule says when nothing is left to show. When filters caused it, `onClear` offers the way back to
 * everything; a page that already shows its own "clear filters" beside the controls leaves it out.
 */
export function ScheduleEmpty({ filtered, onClear }: { filtered: boolean; onClear?: () => void }) {
  const { text } = useStreamLocale()
  return (
    <div className="hub-state">
      <h2>
        {filtered
          ? text("Không có trận phù hợp", "No matching matches")
          : text("Chưa có lịch thi đấu", "No schedule yet")}
      </h2>
      <p>
        {filtered
          ? text("Không trận nào khớp với bộ lọc đang chọn.", "No match fits the chosen filters.")
          : text(
              "Lịch và kết quả sẽ xuất hiện tại đây khi được công bố.",
              "The schedule and results will appear here once they are published.",
            )}
      </p>
      {filtered && onClear && (
        <button type="button" className="cp-button" onClick={onClear}>
          {text("Xóa bộ lọc", "Clear filters")}
        </button>
      )}
    </div>
  )
}
