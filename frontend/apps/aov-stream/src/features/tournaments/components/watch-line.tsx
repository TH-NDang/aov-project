import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import type { Score, WatchMatch, WatchTeam } from "../../../lib/watch-types"
import { shortName } from "../../../lib/watch-words"
import type { RoomFacts } from "./watch-facts"
import { RoomClose, RoomEnds, RoomShrink } from "./watch-icon"
import { CopyLink } from "./watch-tools"
import "./watch-line.css"

/** The games of a match that are recorded with a winner; null while there is none. */
function gamesWon({ story }: WatchMatch): Score | null {
  const winners = story.chapters.flatMap(({ winner }) => winner ?? [])
  const won = (team: WatchTeam) => winners.filter((winner) => winner === team).length
  return winners.length ? { A: won("A"), B: won("B") } : null
}

/**
 * Under a video nothing is recorded of, or a stream that is on: who plays, how the match stands as far as it is recorded,
 * and what can be done with the video.
 */
export function WatchLine({ match, facts }: { match: WatchMatch; facts: RoomFacts }) {
  const { text } = useStreamLocale()
  const score = facts.score ?? gamesWon(match)
  const team = (key: WatchTeam) => {
    const { name, logoUrl, logoDarkUrl } = match.teams[key]
    return (
      <span className="tn-room-line-team" data-team={key}>
        <StreamImage src={logoUrl} darkSrc={logoDarkUrl} logo name={name} />
        <b title={name}>{shortName(match, key)}</b>
      </span>
    )
  }
  return (
    <div className="tn-room-line">
      {match.live && (
        <span className="tn-live">
          <span className="tn-room-line-live">{text("Trực tiếp", "Live")}</span>
        </span>
      )}
      <span className="tn-room-line-score">
        {team("A")}
        <span>
          {score && <b>{score.A}</b>}
          <i>–</i>
          {score && <b>{score.B}</b>}
        </span>
        {team("B")}
      </span>
      <span className="tn-room-line-round">
        {facts.round}
        {facts.round ? ", " : ""}BO{facts.bestOf}
      </span>
      <RoomEnds>
        <CopyLink match={match} />
        <RoomShrink />
        <RoomClose />
      </RoomEnds>
    </div>
  )
}
