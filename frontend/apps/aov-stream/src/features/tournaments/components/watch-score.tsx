import type { ReactNode } from "react"
import { StreamImage } from "../../../components/stream-image"
import { useWatch } from "../../../components/use-watch"
import { scoreAfter, scoreAt } from "../../../lib/watch-place"
import type { Score, WatchMatch, WatchTeam } from "../../../lib/watch-types"
import { shortName } from "../../../lib/watch-words"
import { RoomEnds } from "./watch-icon"
import "./watch-score.css"

/** How the match stands where the video is; without a clock, as it stood before the game that was chosen. */
export function useScore(match: WatchMatch): Score {
  const place = useWatch((view) => (view.failure ? null : view.place))
  const chosen = useWatch((view) => view.chosen)
  return place && place.state !== "UNKNOWN" ? scoreAt(match, place) : scoreAfter(match, chosen)
}

function Team({ match, team, won, need }: { match: WatchMatch; team: WatchTeam; won: number; need: number }) {
  const { name, logoUrl, logoDarkUrl } = match.teams[team]
  return (
    <span className="tn-room-club" data-team={team}>
      <StreamImage src={logoUrl} darkSrc={logoDarkUrl} logo name={name} />
      <span>
        <b title={name}>{shortName(match, team)}</b>
        {need > 1 && (
          <span className="tn-room-pips" aria-hidden="true">
            {Array.from({ length: need }, (_, index) => (
              <i key={index} data-won={index < won || undefined} />
            ))}
          </span>
        )}
      </span>
    </span>
  )
}

/** Both teams around the games each has won so far, and how many more each needs. */
export function WatchScore({ match, children }: { match: WatchMatch; children?: ReactNode }) {
  const score = useScore(match)
  const need = Math.floor(match.story.bestOf / 2) + 1
  return (
    <div className="tn-room-score" data-ended={!!children || undefined}>
      <Team match={match} team="A" won={score.A} need={need} />
      <span className="tn-room-points">
        <b>{score.A}</b>
        <i>–</i>
        <b>{score.B}</b>
      </span>
      <Team match={match} team="B" won={score.B} need={need} />
      {children && <RoomEnds>{children}</RoomEnds>}
    </div>
  )
}
