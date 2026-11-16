import { Link } from "react-router"
import { LocalTime } from "@aov/ui/components/local-time"
import { StreamImage } from "../../components/stream-image"
import { matchUnderway } from "./competition-model"
import { competitionMatchHref, matchState, type CompetitionMatch } from "./match-model"
import { matchRound, matchSides } from "./match-schedule"

const when: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }

/**
 * What a match says about itself in a few words: on now, done, waiting for its result or for a date. `brief` leaves
 * out "finished", which the score already shows, for narrow places such as a bracket.
 */
function MatchStatus({ entry, brief = false }: { entry: CompetitionMatch; brief?: boolean }) {
  const { match, competition } = entry
  const state = matchState(entry)
  if (matchUnderway(entry)) return <span className="tn-live">Đang diễn ra</span>
  if (state === "UNSCHEDULED") return <span>Chờ lịch</span>
  const time = <LocalTime value={match.scheduledAt} sourceTimeZone={competition.content.plan.timezone} format={when} />
  if (state === "UPCOMING" || (brief && state !== "PENDING")) return time
  return (
    <span>
      {state === "PENDING" ? "Chờ kết quả" : "Đã kết thúc"} · {time}
    </span>
  )
}

/**
 * One match as two rows of team and score, the winner in full strength. `context` names the competition above the
 * teams, for lists that mix several; inside a competition's own page the round label takes that line.
 */
export function MatchCard({
  entry,
  context = false,
  brief = false,
}: {
  entry: CompetitionMatch
  context?: boolean
  brief?: boolean
}) {
  const { competition, match } = entry
  const { tournament } = competition.content
  const round = matchRound(entry)
  return (
    <Link
      className="tn-match"
      to={competitionMatchHref(competition.id, match.key)}
      data-live={matchUnderway(entry) || undefined}
    >
      {context ? (
        <span className="tn-match-meta" data-context="">
          {tournament.logoUrl && <img src={tournament.logoUrl} alt="" loading="lazy" />}
          <span>
            <span className="tn-match-competition">{tournament.name}</span>
            {round && <span className="tn-match-round">{round}</span>}
          </span>
        </span>
      ) : (
        (round || !brief) && (
          <span className="tn-match-meta">
            <span>{round ?? match.label}</span>
          </span>
        )
      )}
      {matchSides(entry).map((team) => (
        <span
          key={team.side}
          className="tn-match-team"
          data-won={team.won || undefined}
          data-lost={team.lost || undefined}
          data-open={!team.known || undefined}
        >
          <StreamImage src={team.logoUrl} name={team.name} />
          <strong title={team.fullName}>{team.name}</strong>
          <b>{team.score ?? "–"}</b>
        </span>
      ))}
      <span className="tn-match-foot">
        <MatchStatus entry={entry} brief={brief} />
        <span>BO{match.bestOf}</span>
      </span>
    </Link>
  )
}
