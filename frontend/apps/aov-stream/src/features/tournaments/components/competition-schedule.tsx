import { useSearchParams } from "react-router"
import { useUserTimeZone } from "@aov/ui/lib/time-zone"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { stageName } from "../../../lib/match-labels"
import type { CompetitionMatch } from "../../../lib/match-model"
import { knownScheduleDay, matchSides, scheduleDay, scheduleParts } from "../../../lib/match-schedule"
import { DayStrip } from "./day-strip"
import { FilterMenu, FilterTokens, type FilterGroup } from "./filter-menu"
import { scheduleDayLabel, scheduleScope, ScheduleScopePills, type FilterOption } from "./schedule-controls"
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
  const filters = useScheduleFilters(entries)
  const { update, clear, stages, stage, teams, teamIds, team, day, switchable, scope, narrowed, shown } = filters
  const groups: FilterGroup[] = [
    {
      key: "stage",
      label: text("Giai đoạn", "Stage"),
      value: stage,
      options: stages.map((item): FilterOption => [item.code, stageName(item.name)]),
    },
    {
      key: "team",
      label: text("Đội", "Team"),
      value: team,
      options:
        teamIds.length > 2
          ? teamIds.map((id): FilterOption => {
              const { name, shortName, logoUrl, logoDarkUrl } = teams[id]!
              return [id, name, <StreamImage src={logoUrl} darkSrc={logoDarkUrl} logo name={shortName || name} />]
            })
          : [],
    },
  ]
  const active = Number(stage !== "all") + Number(team !== "all")
  const total = (scope === "results" ? 0 : shown.upcoming.length) + (scope === "upcoming" ? 0 : shown.results.length)
  const counted = total.toLocaleString(languageTag)
  return (
    <div className="tn-schedule-view">
      {(switchable || stages.length > 1 || teamIds.length > 2) && (
        <div className="tn-schedule-bar">
          {switchable && (
            <ScheduleScopePills
              value={scope}
              onChange={(value) => update("scope", value)}
              className="tn-schedule-scope"
            />
          )}
          <FilterMenu
            title={text("Lọc trận đấu", "Filter matches")}
            groups={groups}
            result={text(`${counted} trận`, `${counted} ${total === 1 ? "match" : "matches"}`)}
            onChange={update}
            onReset={clear}
            className={switchable ? "tn-schedule-filter" : undefined}
            align={switchable ? "end" : "start"}
          />
          <FilterTokens groups={groups} onChange={update} onReset={clear} />
        </div>
      )}
      <DayStrip entries={narrowed} value={day} onChange={(value) => update("date", value)} />
      <ScheduleNote day={day && scheduleDayLabel(day, languageTag)} onClear={() => update("date", "")} />
      <ScheduleList
        upcoming={shown.upcoming}
        results={shown.results}
        scope={scope}
        listKey={`${stage}:${team}:${day}`}
        empty={<ScheduleEmpty filtered={active > 0 || !!day || scope !== "all"} onClear={day ? undefined : clear} />}
      />
    </div>
  )
}
