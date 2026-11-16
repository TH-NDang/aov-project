import type { ReactNode } from "react"
import { useSearchParams } from "react-router"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { PublicFilterSheet } from "@aov/ui/components/public-filter-sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/public-select"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { formatCalendarDate, useUserTimeZone } from "@aov/ui/lib/time-zone"
import { MatchRow } from "./match-components"
import type { CompetitionMatch } from "./match-model"
import {
  dayHeading,
  knownScheduleDay,
  matchSides,
  scheduleDay,
  scheduleGroups,
  scheduleParts,
  type ScheduleGroup,
  type ScheduleScope,
} from "./match-schedule"

/** Matches shown before the reader scrolls for more. */
const STEP = 40

const SCOPES: [ScheduleScope, string][] = [
  ["all", "Tất cả"],
  ["upcoming", "Lịch đấu"],
  ["results", "Kết quả"],
]

export function scheduleScope(value: string | null): ScheduleScope {
  return value === "upcoming" || value === "results" ? value : "all"
}

/** How a day picked from an address reads in a sentence. */
export function scheduleDayLabel(day: string) {
  return day === "unscheduled" ? "các trận chờ xếp lịch" : `ngày ${formatCalendarDate(day)}`
}

/** The quick switch between everything, what is ahead and what was played. */
export function ScheduleScopePills({
  value,
  onChange,
}: {
  value: ScheduleScope
  onChange: (scope: ScheduleScope) => void
}) {
  return (
    <div className="hub-pills" role="group" aria-label="Trạng thái trận đấu">
      {SCOPES.map(([key, label]) => (
        <button type="button" key={key} aria-pressed={value === key} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  )
}

/** A filter with an "all" choice first. */
export function FilterSelect({
  label,
  value,
  onChange,
  all,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  all: string
  options: string[][]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="competition-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent drawerTitle={label}>
        <SelectItem value="all">{all}</SelectItem>
        {options.map(([key, text]) => (
          <SelectItem key={key} value={key!}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** A filter that came with the address and has no control of its own: said in words, with the way out beside it. */
export function ScheduleNote({ filters, onClear }: { filters: string[]; onClear: () => void }) {
  if (!filters.length) return null
  return (
    <p className="tn-schedule-note">
      <span>Đang xem {filters.join(", ")}.</span>
      <button type="button" onClick={onClear}>
        Xem tất cả
      </button>
    </p>
  )
}

function DayTitle({ group, part, timeZone, now }: { group: ScheduleGroup; part: Part; timeZone: string; now: number }) {
  if (group.key === "live")
    return (
      <h3 className="tn-day-title">
        <span className="tn-live">Đang diễn ra</span>
      </h3>
    )
  if (group.at == null) return <h3 className="tn-day-title">{part === "upcoming" ? "Chờ xếp lịch" : "Chưa rõ ngày"}</h3>
  const { near, date } = dayHeading(group.at, timeZone, now)
  return (
    <h3 className="tn-day-title">
      {near && <b>{near}</b>}
      <span>{date}</span>
    </h3>
  )
}

type Part = "upcoming" | "results"
const PART_TITLES: Record<Part, string> = { upcoming: "Lịch đấu", results: "Kết quả" }

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
  const now = Date.now()
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
              <div className="tn-heading">
                <h2 id={`schedule-${part}`}>
                  {PART_TITLES[part]} <small>{total.toLocaleString("vi-VN")} trận</small>
                </h2>
              </div>
              <ScheduleDays entries={shown} part={part} competition={competition} />
            </section>
          ),
      )}
      <InfiniteScroll query={loader} label="Đang tải thêm trận đấu" />
    </div>
  )
}

/**
 * What a schedule says when nothing is left to show. When filters caused it, `onClear` offers the way back to
 * everything; a page that already shows its own "clear filters" beside the controls leaves it out.
 */
export function ScheduleEmpty({ filtered, onClear }: { filtered: boolean; onClear?: () => void }) {
  return (
    <div className="hub-state">
      <h2>{filtered ? "Không có trận phù hợp" : "Chưa có lịch thi đấu"}</h2>
      <p>
        {filtered
          ? "Không trận nào khớp với bộ lọc đang chọn."
          : "Lịch và kết quả sẽ xuất hiện tại đây khi được công bố."}
      </p>
      {filtered && onClear && (
        <button type="button" className="cp-button" onClick={onClear}>
          Xóa bộ lọc
        </button>
      )}
    </div>
  )
}

const FILTER_KEYS = ["scope", "stage", "team", "date"]

/**
 * The schedule of one competition: every match under its day, filtered by stage and by team. A filter that has a
 * single value is not offered, and the quick switch only appears while the competition has both matches ahead and
 * matches played.
 */
export function CompetitionSchedule({ entries }: { entries: CompetitionMatch[] }) {
  const layout = usePageLayout()
  const timeZone = useUserTimeZone()
  const [params, setParams] = useSearchParams()
  const update = (key: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (!value || value === "all") next.delete(key)
      else next.set(key, value)
      return next
    })
  const clear = () =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      for (const key of FILTER_KEYS) next.delete(key)
      return next
    })

  const plan = entries[0]?.competition.content.plan
  const teams = entries[0]?.competition.content.teams ?? {}
  const stages = (plan?.stages ?? []).filter((item) => entries.some((entry) => entry.match.stageCode === item.code))
  const teamIds = [...new Set(entries.flatMap((entry) => matchSides(entry).flatMap((side) => side.teamId ?? [])))]
    .filter((id) => teams[id])
    .sort((a, b) => teams[a]!.name.localeCompare(teams[b]!.name, "vi"))

  const requestedStage = params.get("stage")
  const stage = stages.some((item) => item.code === requestedStage) ? requestedStage! : "all"
  const requestedTeam = params.get("team")
  const team = requestedTeam && teamIds.includes(requestedTeam) ? requestedTeam : "all"
  const day = knownScheduleDay(entries, timeZone, params.get("date"))

  const whole = scheduleParts(entries)
  const switchable = whole.upcoming.length > 0 && whole.results.length > 0
  const scope = switchable ? scheduleScope(params.get("scope")) : "all"
  const shown = scheduleParts(
    entries.filter(
      (entry) =>
        (stage === "all" || entry.match.stageCode === stage) &&
        (team === "all" || matchSides(entry).some((side) => side.teamId === team)) &&
        (!day || scheduleDay(entry, timeZone) === day),
    ),
  )
  const selects = (
    <>
      {stages.length > 1 && (
        <FilterSelect
          label="Giai đoạn"
          value={stage}
          onChange={(value) => update("stage", value)}
          all="Mọi giai đoạn"
          options={stages.map((item) => [item.code, item.name])}
        />
      )}
      {teamIds.length > 2 && (
        <FilterSelect
          label="Đội"
          value={team}
          onChange={(value) => update("team", value)}
          all="Mọi đội"
          options={teamIds.map((id) => [id, teams[id]!.name])}
        />
      )}
    </>
  )
  const selectCount = Number(stages.length > 1) + Number(teamIds.length > 2)
  const active = Number(stage !== "all") + Number(team !== "all")
  const filtered = active > 0 || !!day
  const total = (scope === "results" ? 0 : shown.upcoming.length) + (scope === "upcoming" ? 0 : shown.results.length)
  // On a narrow screen the switch takes the row and the selects fold away; without the switch they fit as they are.
  const folded = layout === "compact" && switchable
  return (
    <div className="tn-schedule-view">
      {(switchable || selectCount > 0) && (
        <div className="tn-schedule-bar">
          {switchable && <ScheduleScopePills value={scope} onChange={(value) => update("scope", value)} />}
          {selectCount > 0 &&
            (folded ? (
              <PublicFilterSheet
                title="Lọc trận đấu"
                triggerLabel="Lọc"
                count={active}
                resetLabel="Xóa lọc"
                onReset={clear}
                resultLabel={`Xem ${total.toLocaleString("vi-VN")} trận`}
              >
                <div className="competition-sheet-filters">{selects}</div>
              </PublicFilterSheet>
            ) : (
              <div className="competition-filter-group">
                {selects}
                {active > 0 && (
                  <button type="button" className="competition-clear" onClick={clear}>
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
      <ScheduleNote filters={day ? [scheduleDayLabel(day)] : []} onClear={() => update("date", "")} />
      <ScheduleList
        upcoming={shown.upcoming}
        results={shown.results}
        scope={scope}
        listKey={`${stage}:${team}:${day}`}
        empty={
          <ScheduleEmpty
            filtered={filtered || scope !== "all"}
            onClear={(active > 0 && !folded) || day ? undefined : clear}
          />
        }
      />
    </div>
  )
}
