import type { ReactNode } from "react"
import { Link } from "react-router"
import { LocalTime } from "@aov/ui/components/local-time"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { ThemedLogo } from "../../../components/themed-logo"
import { matchUnderway } from "../../../lib/competition-model"
import { competitionMatchHref, matchState, type CompetitionMatch } from "../../../lib/match-model"
import { matchRound, matchSides, type MatchSide } from "../../../lib/match-schedule"
import { unbroken } from "../../../lib/tournament-model"
import "./match-row.css"

const clockTime: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }

/** Full names up to this length fit a row on a wide screen; longer ones keep the short name everywhere. */
const ROW_NAME = 24

/** Where a match stands, in Vietnamese and in English. */
export const matchStateLabels = {
  LIVE: ["Đang diễn ra", "Live"],
  FINISHED: ["Đã kết thúc", "Finished"],
  SCORED: ["Đã có tỷ số", "Score available"],
  UPCOMING: ["Sắp diễn ra", "Upcoming"],
  PENDING: ["Chờ kết quả", "Awaiting result"],
  UNSCHEDULED: ["Chờ lịch", "To be scheduled"],
} as const

/** Where a match stands in one word: on now, done, ahead, or waiting for its result or its date. */
export function matchStatus(entry: CompetitionMatch, now = Date.now()) {
  return matchUnderway(entry, now) ? "LIVE" : matchState(entry, now)
}

/** A name with a longer form for wide screens and a shorter one for narrow screens, when the two differ. */
export function TeamName({ wide, compact }: { wide: string; compact: string }) {
  if (wide === compact) return <>{unbroken(wide)}</>
  return (
    <>
      <span className="tn-name-wide">{unbroken(wide)}</span>
      <span className="tn-name-compact">{unbroken(compact)}</span>
    </>
  )
}

function RowTeam({ team }: { team: MatchSide }) {
  const wide = team.known && team.fullName.length <= ROW_NAME ? team.fullName : team.name
  return (
    <span
      className="tn-fixture-team"
      data-side={team.side}
      data-won={team.won || undefined}
      data-lost={team.lost || undefined}
      data-open={!team.known || undefined}
    >
      {team.known ? (
        <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.name} />
      ) : (
        <span className="tn-fixture-blank" aria-hidden="true" />
      )}
      <strong title={team.fullName}>
        <TeamName wide={wide} compact={team.brief} />
      </strong>
    </span>
  )
}

/** The score of a match between its teams, the winner's number in the accent. */
function RowScore({ a, b }: { a: MatchSide; b: MatchSide }) {
  if (a.score == null || b.score == null)
    return (
      <span className="tn-fixture-score">
        <i>vs</i>
      </span>
    )
  return (
    <span className="tn-fixture-score" data-scored="">
      <b data-won={a.won || undefined}>{a.score}</b>
      <i aria-hidden="true">–</i>
      <b data-won={b.won || undefined}>{b.score}</b>
    </span>
  )
}

/**
 * One match on a line of a schedule: its time, both teams around the score, its round and how many games decide it.
 * The whole row opens the match. `competition` adds the competition's name, for a list that mixes several.
 */
export function MatchRow({ entry, competition = false }: { entry: CompetitionMatch; competition?: boolean }) {
  const { text, languageTag } = useStreamLocale()
  const { match, competition: view } = entry
  const { plan, tournament } = view.content
  const [a, b] = matchSides(entry, languageTag)
  const status = matchStatus(entry)
  const round = matchRound(entry, languageTag)
  const meta: ReactNode[] = [
    status === "PENDING" && <em key="state">{text(...matchStateLabels.PENDING)}</em>,
    round && <span key="round">{round}</span>,
    competition && (
      <span key="competition" className="tn-fixture-event">
        <ThemedLogo src={tournament.logoUrl} darkSrc={tournament.logoDarkUrl} />
        {tournament.name}
      </span>
    ),
  ]
  return (
    <Link
      className="tn-fixture"
      to={competitionMatchHref(view.id, match.key)}
      data-live={status === "LIVE" || undefined}
    >
      <span className="tn-fixture-time">
        <LocalTime
          value={match.scheduledAt}
          sourceTimeZone={plan.timezone}
          format={clockTime}
          locale={languageTag}
          fallback="–"
        />
      </span>
      <RowTeam team={a} />
      <RowScore a={a} b={b} />
      <RowTeam team={b} />
      <span className="tn-fixture-meta">{meta}</span>
      <span className="tn-fixture-format">BO{match.bestOf}</span>
    </Link>
  )
}
