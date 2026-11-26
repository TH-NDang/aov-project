import { Link } from "react-router"
import { useUserTimeZone } from "@aov/ui/lib/time-zone"
import { MatchStatus } from "../../../components/match-card"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText } from "../../../lib/feed-words"
import type { GameFeed } from "../../../lib/game-feed"
import { competitionMatchHref } from "../../../lib/match-model"
import { matchRound } from "../../../lib/match-schedule"
import {
  gamesOfPair,
  meetingOutcome,
  meetingScore,
  sumMarks,
  sumOutcome,
  type Meeting,
} from "../../../lib/meetings-model"
import { figures, meetingDay, meetingWords, playedDay } from "../../../lib/meetings-words"
import { statsHref } from "../../../lib/statistics-routes"
import { GameMarks } from "./game-marks"
import "./meetings-card.css"

/** Two teams, the first of them the one the card is seen from. */
export type Pair = { team: string; opponent: string }

/** One match on a line: its round and day, its games in order and its score. The line opens the match. */
function Line({ meeting }: { meeting: Meeting }) {
  const { text, languageTag } = useStreamLocale()
  const timeZone = useUserTimeZone()
  const { entry, marks } = meeting
  const outcome = meetingOutcome(meeting)
  const round = matchRound(entry, languageTag)
  const day = outcome && playedDay(meeting, languageTag)
  const said = meetingWords(meeting, meetingDay(meeting, timeZone, languageTag), text)
  return (
    <li>
      <Link
        className="tn-meet-line"
        to={competitionMatchHref(entry.competition.id, entry.match.key)}
        aria-label={[round, day, said].filter(Boolean).join(", ")}
      >
        <span className="tn-meet-when">
          <b>{round}</b>
          {day && <span>{day}</span>}
        </span>
        {marks.length > 0 && <GameMarks marks={marks} unit={6} height={18} />}
        {outcome ? (
          <span className="tn-meet-figures" data-outcome={outcome}>
            {figures(meeting)}
          </span>
        ) : (
          <span className="tn-meet-wait">
            <MatchStatus entry={entry} />
          </span>
        )}
        <StreamIcon name="chevronRight" size={14} />
      </Link>
    </li>
  )
}

/** What the games of several matches add up to. Where the teams met elsewhere too, it opens the games it counts. */
function Total({ list, games, to }: { list: Meeting[]; games: string; to: string | null }) {
  const { text } = useStreamLocale()
  const score = meetingScore(list)
  const name = text("Cộng lại", "In all")
  const drawn = (
    <>
      <span className="tn-meet-when">
        <b>{name}</b>
        {to && <span>{games}</span>}
      </span>
      {list.some(({ marks }) => marks.length > 0) && <GameMarks marks={sumMarks(score)} unit={6} height={18} />}
      <span className="tn-meet-figures" data-outcome={sumOutcome(score)}>
        {figures(score)}
      </span>
    </>
  )
  if (!to) return <p className="tn-meet-total">{drawn}</p>
  return (
    <Link className="tn-meet-total" to={to} aria-label={`${name} ${figures(score)}, ${games}`}>
      {drawn}
      <StreamIcon name="chevronRight" size={14} />
    </Link>
  )
}

/** Every match of two teams in a stage, what their games add up to, and the way to every game between the two. */
export function MeetingsCard({ list, pair, feed }: { list: Meeting[]; pair: Pair; feed: GameFeed | null }) {
  const { text, languageTag } = useStreamLocale()
  const { own, rival, played } = meetingScore(list)
  const scope = list[0]?.entry.match.stageCode ?? null
  const { every, here } = gamesOfPair(feed, pair.team, pair.opponent, scope)
  const games = (count: number) => gamesText(count, text, languageTag)
  const finder = (period: string | null) =>
    feed && statsHref(feed.view.id, { question: { team: pair.team, opp: pair.opponent }, scope: period })
  return (
    <>
      <ol className="tn-meet-lines">
        {list.map((meeting) => (
          <Line key={meeting.entry.match.key} meeting={meeting} />
        ))}
      </ol>
      {played > 1 && (
        <Total list={list} games={games(here)} to={here === own + rival && here < every ? finder(scope) : null} />
      )}
      {feed && every > 0 && (
        <Link className="tn-meet-every" to={finder(null)!}>
          <span>{text(`Mọi ván giữa hai đội: ${games(every)}`, `Every game between the two: ${games(every)}`)}</span>
          <StreamIcon name="arrow" size={16} />
        </Link>
      )}
    </>
  )
}
