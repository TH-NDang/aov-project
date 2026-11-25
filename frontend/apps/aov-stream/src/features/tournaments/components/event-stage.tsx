import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { LocalPrizeText } from "@aov/ui/components/local-money"
import { TierEmblem } from "@aov/ui/components/tier-emblem"
import { dayRange } from "../../../components/community-ui"
import { CompetitionClock, CompetitionLogo, StatusBadge } from "../../../components/competition-card"
import { MatchStatus } from "../../../components/match-card"
import { RegionMark } from "../../../components/region-mark"
import { Stage } from "../../../components/stage"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { ThemedLogo } from "../../../components/themed-logo"
import { codeName, competitionStatus, eventMatches, matchUnderway, TIER_NAMES } from "../../../lib/competition-model"
import { competitionMatches, competitionMatchHref, type CompetitionMatch } from "../../../lib/match-model"
import { matchSides } from "../../../lib/match-schedule"
import { competitionProgress } from "../../../lib/stage-phases"
import { useNow } from "../../../lib/use-now"
import "./event-stage.css"

/** One match on an event's stage: both teams by their short names, the score or when it starts. */
function StageMatch({ entry }: { entry: CompetitionMatch }) {
  const { languageTag } = useStreamLocale()
  const now = useNow()
  const [a, b] = matchSides(entry, languageTag)
  return (
    <Link
      className="tn-event-match"
      to={competitionMatchHref(entry.competition.id, entry.match.key)}
      data-live={matchUnderway(entry, now) || undefined}
    >
      <span className="tn-event-when">
        <MatchStatus entry={entry} />
      </span>
      {[a, b].map((team) => (
        <span
          key={team.side}
          className="tn-event-side"
          data-side={team.side}
          data-lost={team.lost || undefined}
          data-open={!team.known || undefined}
        >
          {team.known && <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.name} />}
          <span title={team.fullName}>{team.brief}</span>
        </span>
      ))}
      <span className="tn-event-score">{a.score != null && b.score != null ? `${a.score} – ${b.score}` : "vs"}</span>
    </Link>
  )
}

/** How far an event that is on has come, as a line under its facts. */
function ProgressLine({ entry }: { entry: CompetitionView }) {
  const { text } = useStreamLocale()
  const { played, total } = competitionProgress(entry)
  if (!total) return null
  return (
    <div className="tn-event-progress">
      <span>{text(`${played}/${total} trận đã đấu`, `${played} of ${total} matches played`)}</span>
      <progress value={played} max={total} aria-label={text("Tiến độ giải", "Tournament progress")} />
    </div>
  )
}

/**
 * An event a reader can follow now: its facts on its own stage, and beside them the matches on now and the next ones.
 */
export function EventStage({ entry }: { entry: CompetitionView }) {
  const { text, languageTag } = useStreamLocale()
  const now = useNow()
  const { tournament, plan } = entry.content
  const tier = codeName(TIER_NAMES, tournament.tier, text)
  const shown = eventMatches(competitionMatches([entry]), now)
  return (
    <Stage
      tint={tournament.name}
      lights={[{ src: tournament.logoUrl, darkSrc: tournament.logoDarkUrl, at: "left" }]}
      className="tn-event"
    >
      <div className="tn-event-facts">
        {(tournament.logoDarkUrl || tournament.logoUrl) && (
          <ThemedLogo className="tn-event-logo" src={tournament.logoUrl} darkSrc={tournament.logoDarkUrl} />
        )}
        <div className="tn-event-text">
          <span className="tn-event-marks">
            <StatusBadge status={competitionStatus(entry.content, now)} tone="banner" />
            {tier && <TierEmblem tier={tournament.tier} label={tier} />}
            <RegionMark code={tournament.region} />
          </span>
          <h3>
            <Link to={`/competitions/${entry.id}`}>{tournament.name}</Link>
          </h3>
          <p>
            <span>{dayRange(tournament.startsOn, tournament.endsOn)}</span>
            {plan.entrants.length > 0 && (
              <span>{text(`${plan.entrants.length} đội`, `${plan.entrants.length} teams`)}</span>
            )}
            {plan.prizePool && (
              <span>
                <LocalPrizeText
                  text={plan.prizePool}
                  currency={plan.currency}
                  on={tournament.endsOn ?? tournament.startsOn}
                  locale={languageTag}
                />
              </span>
            )}
          </p>
          <ProgressLine entry={entry} />
        </div>
      </div>
      {shown.length > 0 && (
        <div className="tn-event-matches">
          {shown.map((item) => (
            <StageMatch key={item.match.key} entry={item} />
          ))}
        </div>
      )}
    </Stage>
  )
}

/** The teams an event already has, as a row of their logos. */
function Entrants({ entry }: { entry: CompetitionView }) {
  const { text } = useStreamLocale()
  const { plan, teams } = entry.content
  const known = plan.entrants.filter((entrant) => teams[entrant.teamId])
  if (!known.length) return null
  return (
    <ul className="tn-coming-teams" aria-label={text("Các đội tham dự", "Teams")}>
      {known.map(({ teamId }) => {
        const { name, shortName, logoUrl, logoDarkUrl } = teams[teamId]!
        return (
          <li key={teamId} title={name}>
            <StreamImage src={logoUrl} darkSrc={logoDarkUrl} logo name={name} />
            <span>{shortName || name}</span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * An event that starts later, as a small stage: its logo, its name and how long until it begins. One that stands
 * `alone` takes the whole row and names its teams.
 */
export function ComingEvent({ entry, alone }: { entry: CompetitionView; alone?: boolean }) {
  const { text } = useStreamLocale()
  const { tournament, plan } = entry.content
  const tier = codeName(TIER_NAMES, tournament.tier, text)
  return (
    <Link className="tn-coming" data-alone={alone || undefined} to={`/competitions/${entry.id}`}>
      <Stage
        tint={tournament.name}
        lights={[{ src: tournament.logoUrl, darkSrc: tournament.logoDarkUrl, at: "left" }]}
        className="tn-coming-stage"
      >
        {tournament.logoDarkUrl || tournament.logoUrl ? (
          <ThemedLogo className="tn-coming-logo" src={tournament.logoUrl} darkSrc={tournament.logoDarkUrl} />
        ) : (
          <CompetitionLogo name={tournament.name} size="card" />
        )}
        <span className="tn-coming-text">
          <b>
            <CompetitionClock entry={entry} />
            {tier && <TierEmblem tier={tournament.tier} size={18} label={tier} />}
            <RegionMark code={tournament.region} size={16} />
          </b>
          <strong title={tournament.name}>{tournament.name}</strong>
          <span>
            <span>{dayRange(tournament.startsOn, tournament.endsOn, text("Chờ lịch", "To be scheduled"))}</span>
            {plan.entrants.length > 1 && (
              <span>{text(`${plan.entrants.length} đội`, `${plan.entrants.length} teams`)}</span>
            )}
          </span>
        </span>
        {alone && <Entrants entry={entry} />}
      </Stage>
    </Link>
  )
}
