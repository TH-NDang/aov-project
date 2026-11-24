import { useMemo } from "react"
import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { formatInZone, useUserTimeZone } from "@aov/ui/lib/time-zone"
import { MatchCard } from "../../../components/match-card"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { eventMatches } from "../../../lib/competition-model"
import { competitionMatches, type CompetitionMatch } from "../../../lib/match-model"
import { dayHeading, scheduleGroups, scheduleParts, type ScheduleGroup } from "../../../lib/match-schedule"
import { dayMonthInZone } from "../../../lib/match-time"
import { useNow } from "../../../lib/use-now"
import "./match-ribbon.css"

/** Matches the ribbon holds: those ahead, then the latest results. The whole schedule is one press away. */
const AHEAD = 10
const RESULTS = 12

const keyOf = ({ competition, match }: CompetitionMatch) => `${competition.id}:${match.key}`

/** A day of the ribbon under its short name, its matches side by side. */
function Day({ group, past }: { group: ScheduleGroup; past: boolean }) {
  const { text, languageTag } = useStreamLocale()
  const timeZone = useUserTimeZone()
  const now = useNow()
  const near = group.at == null ? null : dayHeading(group.at, timeZone, now, languageTag).near
  const date =
    group.at == null
      ? null
      : `${formatInZone(group.at, timeZone, { weekday: "short" }, languageTag)}, ${dayMonthInZone(group.at, timeZone, languageTag)}`
  const live = group.key === "live"
  return (
    <section className="tn-ribbon-day" data-past={past || undefined}>
      <h3>
        {live ? (
          <span className="tn-ribbon-live">{text("Đang đấu", "Live")}</span>
        ) : group.key === "open" ? (
          text("Chờ lịch", "To be scheduled")
        ) : (
          <>
            {near && <b>{near}</b>} {date}
          </>
        )}
      </h3>
      <div>
        {group.items.map((entry) => (
          <MatchCard key={keyOf(entry)} entry={entry} context dayNamed={group.at != null} />
        ))}
      </div>
    </section>
  )
}

/**
 * Every tournament's matches in one line, the way a scoreboard runs: what is on, what comes next, then the latest
 * results, each under its day. It ends in the ways on to the whole schedule and to the games. `staged` are the events
 * whose own stage already shows their nearest matches, which the line then leaves out.
 */
export function MatchRibbon({ items, staged = [] }: { items: CompetitionView[]; staged?: CompetitionView[] }) {
  const { text } = useStreamLocale()
  const timeZone = useUserTimeZone()
  const now = useNow()
  const parts = useMemo(() => {
    const onStage = new Set(
      staged.flatMap((event) => eventMatches(competitionMatches([event]), now).map((entry) => keyOf(entry))),
    )
    return scheduleParts(
      competitionMatches(items).filter((entry) => !onStage.has(keyOf(entry))),
      now,
    )
  }, [items, staged, now])
  const ahead = parts.upcoming.filter((entry) => entry.match.scheduledAt).slice(0, AHEAD)
  const results = parts.results.filter((entry) => entry.match.scheduledAt).slice(0, RESULTS)
  if (!ahead.length && !results.length) return null
  return (
    <div className="tn-ribbon">
      <div
        className="tn-ribbon-row"
        tabIndex={0}
        role="group"
        aria-label={text("Trận sắp diễn ra và kết quả mới nhất", "Upcoming matches and latest results")}
      >
        {scheduleGroups(ahead, timeZone, now).map((group) => (
          <Day key={group.key} group={group} past={false} />
        ))}
        {scheduleGroups(results, timeZone, now).map((group) => (
          <Day key={`past:${group.key}`} group={group} past />
        ))}
      </div>
      <nav className="tn-ribbon-ways" aria-label={text("Lịch và ván đấu", "Schedule and games")}>
        <Link to="/competitions?tab=schedule">
          <StreamIcon name="calendar" size={18} />
          {text("Toàn bộ lịch", "Full schedule")}
        </Link>
        <Link to="/games">
          <StreamIcon name="gamepad" size={18} />
          {text("Ván đấu", "Games")}
        </Link>
      </nav>
    </div>
  )
}
