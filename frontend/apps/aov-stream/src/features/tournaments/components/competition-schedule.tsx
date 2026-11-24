import { useSearchParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useUserTimeZone } from "@aov/ui/lib/time-zone"
import { useStreamLocale } from "../../../components/stream-locale"
import { stageName } from "../../../lib/match-labels"
import type { CompetitionMatch } from "../../../lib/match-model"
import { knownScheduleDay, matchSides, scheduleDay, scheduleParts } from "../../../lib/match-schedule"
import { DayStrip } from "./day-strip"
import {
  FilterSelect,
  ScheduleFilterSheet,
  scheduleDayLabel,
  scheduleScope,
  ScheduleScopePills,
} from "./schedule-controls"
import { ScheduleEmpty, ScheduleList, ScheduleNote } from "./schedule-list"

const FILTER_KEYS = ["scope", "stage", "team", "date"]

/** The filters of a competition's schedule, kept in the address. */
function useScheduleFilters(entries: CompetitionMatch[]) {
  const timeZone = useUserTimeZone()
  const [params, setParams] = useSearchParams()
  const change = (edit: (next: URLSearchParams) => void) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      edit(next)
      return next
    })
  const update = (key: string, value: string) =>
    change((next) => (!value || value === "all" ? next.delete(key) : next.set(key, value)))
  const clear = () => change((next) => FILTER_KEYS.forEach((key) => next.delete(key)))

  const content = entries[0]?.competition.content
  const teams = content?.teams ?? {}
  const stages = (content?.plan.stages ?? []).filter((item) =>
    entries.some((entry) => entry.match.stageCode === item.code),
  )
  const teamIds = [...new Set(entries.flatMap((entry) => matchSides(entry).flatMap((side) => side.teamId ?? [])))]
    .filter((id) => teams[id])
    .sort((a, b) => teams[a]!.name.localeCompare(teams[b]!.name, "vi"))
  const requested = { stage: params.get("stage"), team: params.get("team") }
  const stage = stages.some((item) => item.code === requested.stage) ? requested.stage! : "all"
  const team = requested.team && teamIds.includes(requested.team) ? requested.team : "all"
  const day = knownScheduleDay(entries, timeZone, params.get("date"))
  const whole = scheduleParts(entries)
  const switchable = whole.upcoming.length > 0 && whole.results.length > 0
  const scope = switchable ? scheduleScope(params.get("scope")) : "all"
  const narrowed = entries.filter(
    (entry) =>
      (stage === "all" || entry.match.stageCode === stage) &&
      (team === "all" || matchSides(entry).some((side) => side.teamId === team)),
  )
  const shown = scheduleParts(narrowed.filter((entry) => !day || scheduleDay(entry, timeZone) === day))
  return { update, clear, stages, stage, teams, teamIds, team, day, switchable, scope, narrowed, shown }
}

/**
 * The schedule of one competition: its days on a strip, then every match under its day, filtered by stage and by
 * team. A filter with a single value is not offered, and the quick switch only appears while the competition has both
 * matches ahead and matches played.
 */
export function CompetitionSchedule({ entries }: { entries: CompetitionMatch[] }) {
  const { text, languageTag } = useStreamLocale()
  const layout = usePageLayout()
  const filters = useScheduleFilters(entries)
  const { update, clear, stages, stage, teams, teamIds, team, day, switchable, scope, narrowed, shown } = filters
  const selects = (
    <>
      {stages.length > 1 && (
        <FilterSelect
          label={text("Giai đoạn", "Stage")}
          value={stage}
          onChange={(value) => update("stage", value)}
          all={text("Mọi giai đoạn", "All stages")}
          options={stages.map((item) => [item.code, stageName(item.name)])}
        />
      )}
      {teamIds.length > 2 && (
        <FilterSelect
          label={text("Đội", "Team")}
          value={team}
          onChange={(value) => update("team", value)}
          all={text("Mọi đội", "All teams")}
          options={teamIds.map((id) => [id, teams[id]!.name])}
        />
      )}
    </>
  )
  const selectCount = Number(stages.length > 1) + Number(teamIds.length > 2)
  const active = Number(stage !== "all") + Number(team !== "all")
  const total = (scope === "results" ? 0 : shown.upcoming.length) + (scope === "upcoming" ? 0 : shown.results.length)
  // On a narrow screen the switch takes the row and the selects fold away; without the switch they fit as they are.
  const folded = layout === "compact" && switchable
  return (
    <div className="tn-schedule-view">
      {(switchable || selectCount > 0) && (
        <div className="tn-schedule-bar">
          {switchable && (
            <ScheduleScopePills
              value={scope}
              onChange={(value) => update("scope", value)}
              className="tn-schedule-scope"
            />
          )}
          {selectCount > 0 &&
            (folded ? (
              <ScheduleFilterSheet count={active} total={total} onReset={clear}>
                {selects}
              </ScheduleFilterSheet>
            ) : (
              <div className="competition-filter-group">
                {selects}
                {active > 0 && (
                  <button type="button" className="competition-clear" onClick={clear}>
                    {text("Xóa bộ lọc", "Clear filters")}
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
      <DayStrip entries={narrowed} value={day} onChange={(value) => update("date", value)} />
      <ScheduleNote filters={day ? [scheduleDayLabel(day, languageTag)] : []} onClear={() => update("date", "")} />
      <ScheduleList
        upcoming={shown.upcoming}
        results={shown.results}
        scope={scope}
        listKey={`${stage}:${team}:${day}`}
        empty={
          <ScheduleEmpty
            filtered={active > 0 || !!day || scope !== "all"}
            onClear={(active > 0 && !folded) || day ? undefined : clear}
          />
        }
      />
    </div>
  )
}
