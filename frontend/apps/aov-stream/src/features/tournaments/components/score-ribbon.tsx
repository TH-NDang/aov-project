import { useMemo } from "react"
import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { formatInZone, useUserTimeZone } from "@aov/ui/lib/time-zone"
import { MatchStatus } from "../../../components/match-card"
import { RoundLabel } from "../../../components/round-label"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { ThemedLogo } from "../../../components/themed-logo"
import { eventMatches, matchUnderway } from "../../../lib/competition-model"
import { competitionMatches, competitionMatchHref, type CompetitionMatch } from "../../../lib/match-model"
import { dayHeading, matchRound, matchSides, scheduleGroups, scheduleParts } from "../../../lib/match-schedule"
import type { ScheduleGroup } from "../../../lib/match-schedule"
import { dayMonthInZone } from "../../../lib/match-time"
import { shortCompetitionName } from "../../../lib/season-name"
import { useNow } from "../../../lib/use-now"
import "./score-ribbon.css"

/** Matches the ribbon holds: those ahead, then the latest results. The whole schedule is one press away. */
const AHEAD = 10
const RESULTS = 14

const keyOf = ({ competition, match }: CompetitionMatch) => `${competition.id}:${match.key}`

/**
 * Every tournament's matches in one line, the way the board around an arena runs: what is on, what comes next, then
 * the latest results, day by day. `staged` are the events whose own stage already shows their nearest matches, which
 * the line then leaves out.
 */
export function ScoreRibbon({ items, staged = [] }: { items: CompetitionView[]; staged?: CompetitionView[] }) {
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
        {[...scheduleGroups(ahead, timeZone, now), ...scheduleGroups(results, timeZone, now)].map((group, at) => (
          <Day key={`${at}:${group.key}`} group={group} />
        ))}
      </div>
      <Link className="tn-ribbon-all" to="/competitions?tab=schedule">
        {text("Lịch & kết quả", "Schedule & results")}
        <StreamIcon name="arrow" size={16} />
      </Link>
    </div>
  )
}

/** A day of the ribbon: its name once, then its matches side by side. */
function Day({ group }: { group: ScheduleGroup }) {
  const { text, languageTag } = useStreamLocale()
  const timeZone = useUserTimeZone()
  const now = useNow()
  const near = group.at == null ? null : dayHeading(group.at, timeZone, now, languageTag).near
  return (
    <section className="tn-ribbon-day">
      <h3>
        {group.key === "live" ? (
          <span className="tn-live">{text("Đang đấu", "Live")}</span>
        ) : group.at == null ? (
          text("Chờ lịch", "To be scheduled")
        ) : (
          (near ??
          `${formatInZone(group.at, timeZone, { weekday: "short" }, languageTag)}, ${dayMonthInZone(group.at, timeZone, languageTag)}`)
        )}
      </h3>
      {group.items.map((entry) => (
        <Score key={keyOf(entry)} entry={entry} />
      ))}
    </section>
  )
}

function Score({ entry }: { entry: CompetitionMatch }) {
  const { languageTag } = useStreamLocale()
  const now = useNow()
  const { competition, match } = entry
  const { tournament } = competition.content
  return (
    <Link
      className="tn-score"
      to={competitionMatchHref(competition.id, match.key)}
      data-live={matchUnderway(entry, now) || undefined}
    >
      <span className="tn-score-head">
        <MatchStatus entry={entry} dayNamed />
        <span className="tn-score-event" title={tournament.name}>
          <ThemedLogo src={tournament.logoUrl} darkSrc={tournament.logoDarkUrl} />
          <span className="sr-only">{shortCompetitionName(competition)}</span>
        </span>
      </span>
      {matchSides(entry, languageTag).map((team) => (
        <span
          key={team.side}
          className="tn-score-team"
          data-lost={team.lost || undefined}
          data-open={!team.known || undefined}
        >
          {team.known ? (
            <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.name} />
          ) : (
            <i aria-hidden="true" />
          )}
          <strong title={team.fullName}>{team.brief}</strong>
          {team.score != null && <b>{team.score}</b>}
        </span>
      ))}
      <span className="tn-score-round">
        <RoundLabel entry={entry} label={matchRound(entry, languageTag)} />
      </span>
    </Link>
  )
}
