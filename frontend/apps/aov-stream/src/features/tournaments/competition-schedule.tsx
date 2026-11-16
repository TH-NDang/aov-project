import { useSearchParams } from "react-router"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/public-select"
import { shownTimeZoneLabel, useUserTimeZone } from "@aov/ui/lib/time-zone"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { MatchRow } from "./match-components"
import { groupMatchesByDay, knownMatchDay, matchState, type CompetitionMatch } from "./match-model"

export function CompetitionSchedule({ entries }: { entries: CompetitionMatch[] }) {
  const { text, languageTag } = useStreamLocale()
  const timeZone = useUserTimeZone()
  const [params, setParams] = useSearchParams()
  const requestedScope = params.get("scope")
  const scope = requestedScope === "upcoming" || requestedScope === "results" ? requestedScope : "all"
  const stage = params.get("stage") || "all"
  const days = groupMatchesByDay(entries, timeZone, languageTag)
  const date = knownMatchDay(days, params.get("date"))
  const stages = [...new Set(entries.map((entry) => entry.match.stageCode))]
  const update = (key: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (!value || value === "all") next.delete(key)
      else next.set(key, value)
      return next
    })
  const filtered = entries.filter((entry) => {
    const state = matchState(entry)
    return (
      (stage === "all" || entry.match.stageCode === stage) &&
      (scope === "all" ||
        (scope === "results"
          ? state === "FINISHED" || state === "SCORED"
          : state === "UPCOMING" || state === "UNSCHEDULED" || state === "PENDING"))
    )
  })
  const groups = groupMatchesByDay(filtered, timeZone, languageTag).filter((group) => !date || group.key === date)
  if (scope === "results") groups.reverse()
  return (
    <div className="competition-schedule">
      <div className="competition-schedule-toolbar">
        <div className="hub-pills" role="group" aria-label={text("Trạng thái trận đấu", "Match status")}>
          {[
            ["all", text("Tất cả", "All")],
            ["upcoming", text("Lịch đấu", "Schedule")],
            ["results", text("Kết quả", "Results")],
          ].map(([key, label]) => (
            <button key={key} aria-pressed={scope === key} onClick={() => update("scope", key!)}>
              {label}
            </button>
          ))}
        </div>
        <div className="competition-schedule-controls">
          {stages.length > 1 && (
            <Select value={stage} onValueChange={(value) => update("stage", value)}>
              <SelectTrigger aria-label={text("Giai đoạn", "Stage")} className="competition-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent drawerTitle={text("Giai đoạn", "Stage")}>
                <SelectItem value="all">{text("Mọi giai đoạn", "All stages")}</SelectItem>
                {stages.map((code) => (
                  <SelectItem key={code} value={code}>
                    {entries
                      .flatMap((entry) => entry.competition.content.plan.stages)
                      .find((item) => item.code === code)?.name || code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={date || "all"} onValueChange={(value) => update("date", value)}>
            <SelectTrigger aria-label={text("Ngày thi đấu", "Match day")} className="competition-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent drawerTitle={text("Ngày thi đấu", "Match day")}>
              <SelectItem value="all">{text("Mọi ngày", "All days")}</SelectItem>
              {days.map((group) => (
                <SelectItem key={group.key} value={group.key}>
                  {group.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="cp-meta">
        {text("Giờ hiển thị:", "Times shown in:")} {shownTimeZoneLabel(undefined, languageTag)}
      </p>
      {!groups.length && (
        <div className="hub-state">
          <StreamIcon name="calendar" size={28} />
          <h3>{text("Chưa có trận phù hợp", "No matches to show yet")}</h3>
          <p>
            {entries.length
              ? text("Thử ngày, giai đoạn hoặc trạng thái khác.", "Try another day, stage or status.")
              : text(
                  "Lịch và kết quả sẽ xuất hiện khi được công bố.",
                  "The schedule and results will appear once they are published.",
                )}
          </p>
        </div>
      )}
      {groups.map((group) => (
        <section key={group.key} className="match-day">
          <h3>{group.label}</h3>
          <div className="match-list">
            {group.items.map((entry) => (
              <MatchRow key={`${entry.competition.id}:${entry.match.key}`} entry={entry} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
