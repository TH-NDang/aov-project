import { useMemo } from "react"
import { useStreamLocale } from "../../../components/stream-locale"
import { usedBefore } from "../../../lib/watch-place"
import type { Chapter, WatchMatch, WatchTeam } from "../../../lib/watch-types"
import { shortName } from "../../../lib/watch-words"
import { ReferenceArt } from "./reference-art"
import "./watch-used.css"

const TEAMS: WatchTeam[] = ["A", "B"]

/** The heroes each team has played in the games before, while it may not pick them again. */
export function WatchUsed({ match, chapter }: { match: WatchMatch; chapter: Chapter }) {
  const { text } = useStreamLocale()
  const used = useMemo(() => usedBefore(match.story, chapter), [match.story, chapter])
  if (!used.A.length && !used.B.length) return null
  return (
    <section className="tn-room-used">
      <h3>{text("Đã chơi ở các ván trước", "Played in earlier games")}</h3>
      {TEAMS.map((team) => (
        <p key={team}>
          <b title={match.teams[team].name}>{shortName(match, team)}</b>
          <span>
            {used[team].map(({ hero, game }, index) => (
              <ReferenceArt key={index} catalog={game.catalog} kind="heroes" selection={hero} />
            ))}
          </span>
        </p>
      ))}
    </section>
  )
}
