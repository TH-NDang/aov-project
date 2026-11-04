import { useSearchParams } from "react-router"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/public-select"
import { StreamIcon } from "../../components/stream-icon"
import { MatchRow } from "./match-components"
import { groupMatchesByDay, matchState, type CompetitionMatch } from "./match-model"

export function CompetitionSchedule({
  entries,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: {
  entries: CompetitionMatch[]
  timeZone?: string
}) {
  const [params, setParams] = useSearchParams()
  const requestedScope = params.get("scope")
  const scope = requestedScope === "upcoming" || requestedScope === "results" ? requestedScope : "all"
  const stage = params.get("stage") || "all"
  const date = params.get("date") || ""
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
  const groups = groupMatchesByDay(filtered, timeZone).filter((group) => !date || group.key === date)
  if (scope === "results") groups.reverse()
  return (
    <div className="competition-schedule">
      <div className="competition-schedule-toolbar">
        <div className="hub-pills" role="group" aria-label="Trạng thái trận đấu">
          {[
            ["all", "Tất cả"],
            ["upcoming", "Lịch đấu"],
            ["results", "Kết quả"],
          ].map(([key, label]) => (
            <button key={key} aria-pressed={scope === key} onClick={() => update("scope", key!)}>
              {label}
            </button>
          ))}
        </div>
        <div className="competition-schedule-controls">
          {stages.length > 1 && (
            <Select value={stage} onValueChange={(value) => update("stage", value)}>
              <SelectTrigger aria-label="Giai đoạn" className="competition-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent drawerTitle="Giai đoạn">
                <SelectItem value="all">Mọi giai đoạn</SelectItem>
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
            <SelectTrigger aria-label="Ngày thi đấu" className="competition-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent drawerTitle="Ngày thi đấu">
              <SelectItem value="all">Mọi ngày</SelectItem>
              {groupMatchesByDay(entries, timeZone).map((group) => (
                <SelectItem key={group.key} value={group.key}>
                  {group.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="cp-meta">Giờ hiển thị: {timeZone}</p>
      {!groups.length && (
        <div className="hub-state">
          <StreamIcon name="calendar" size={28} />
          <h3>Chưa có trận phù hợp</h3>
          <p>
            {entries.length
              ? "Thử ngày, giai đoạn hoặc trạng thái khác."
              : "Lịch và kết quả sẽ xuất hiện khi được công bố."}
          </p>
        </div>
      )}
      {groups.map((group) => (
        <section key={group.key} className="match-day">
          <h3>{group.label}</h3>
          <div className="match-list">
            {group.items.map((entry) => (
              <MatchRow key={`${entry.competition.id}:${entry.match.key}`} entry={entry} timeZone={timeZone} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
