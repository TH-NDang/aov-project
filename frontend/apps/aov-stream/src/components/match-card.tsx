import { Link } from "react-router"
import { MatchTime } from "./match-time"
import { RoundLabel } from "./round-label"
import { StreamImage } from "./stream-image"
import { useStreamLocale } from "./stream-locale"
import { ThemedLogo } from "./themed-logo"
import { bracketRoundOf, roundWeight } from "../lib/bracket-model"
import { matchUnderway } from "../lib/competition-model"
import { competitionMatchHref, matchState, type CompetitionMatch } from "../lib/match-model"
import { matchRound, matchSides, type MatchSide } from "../lib/match-schedule"
import { shortCompetitionName } from "../lib/season-name"
import { useNow } from "../lib/use-now"
import "./match-card.css"

/** Where a match stands: on now, when it starts, or that its result is still to come. */
export function MatchStatus({ entry, dayNamed }: { entry: CompetitionMatch; dayNamed?: boolean }) {
  const { text } = useStreamLocale()
  const now = useNow()
  if (matchUnderway(entry, now)) return <span className="tn-live">{text("Đang diễn ra", "Live")}</span>
  if (matchState(entry, now) === "PENDING") return <span>{text("Chờ kết quả", "Awaiting result")}</span>
  return <MatchTime entry={entry} dayNamed={dayNamed} />
}

/** One side of a card: its logo, its short name and its score, the winner in full strength. */
export function MatchCardSide({ team }: { team: MatchSide }) {
  return (
    <span
      className="tn-match-team"
      data-won={team.won || undefined}
      data-lost={team.lost || undefined}
      data-open={!team.known || undefined}
    >
      {team.known ? (
        <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.name} />
      ) : (
        <span className="tn-match-blank" aria-hidden="true" />
      )}
      <strong title={team.fullName}>{team.brief}</strong>
      {team.score != null && <b>{team.score}</b>}
    </span>
  )
}

/**
 * One match as two rows of team and score. `context` names the competition under the teams, for lists that mix
 * several; inside a competition's own page the round alone takes that line, and `brief` leaves it out. `dayNamed` gives the hour
 * alone, under a heading that names the day.
 */
export function MatchCard({
  entry,
  context = false,
  brief = false,
  dayNamed = false,
}: {
  entry: CompetitionMatch
  context?: boolean
  brief?: boolean
  dayNamed?: boolean
}) {
  const { languageTag } = useStreamLocale()
  const now = useNow()
  const { competition, match } = entry
  const { tournament } = competition.content
  const round = matchRound(entry, languageTag)
  const stage = bracketRoundOf(entry)
  return (
    <Link
      className="tn-match"
      to={competitionMatchHref(competition.id, match.key)}
      data-live={matchUnderway(entry, now) || undefined}
      data-weight={(stage && roundWeight(stage)) ?? undefined}
    >
      <span className="tn-match-head">
        <MatchStatus entry={entry} dayNamed={dayNamed} />
        <span>BO{match.bestOf}</span>
      </span>
      {matchSides(entry, languageTag).map((team) => (
        <MatchCardSide key={team.side} team={team} />
      ))}
      {context ? (
        <span className="tn-match-foot" data-context="">
          <ThemedLogo src={tournament.logoUrl} darkSrc={tournament.logoDarkUrl} />
          <span>
            <span className="tn-match-competition" title={tournament.name}>
              {shortCompetitionName(competition)}
            </span>
            <RoundLabel entry={entry} label={round} />
          </span>
        </span>
      ) : (
        !brief &&
        round && (
          <span className="tn-match-foot">
            <RoundLabel entry={entry} label={round} />
          </span>
        )
      )}
    </Link>
  )
}
