import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import { Stage } from "./stage"
import { StreamImage } from "./stream-image"
import { useStreamLocale } from "./stream-locale"
import { competitionChampion } from "../lib/champion-model"
import "./champion-card.css"

/** A competition told by who won it: the champion's logo on a stage of its own light, then the event it won. */
export function ChampionCard({ entry }: { entry: CompetitionView }) {
  const { text, languageTag } = useStreamLocale()
  const { tournament } = entry.content
  const won = competitionChampion(entry)
  if (!won) return null
  const { winner, runnerUp, score } = won
  const day = tournament.endsOn ?? tournament.startsOn
  return (
    <Link className="tn-champ" to={`/competitions/${entry.id}`}>
      <Stage
        tint={winner.name}
        lights={[{ src: winner.logoUrl, darkSrc: winner.logoDarkUrl, at: "center" }]}
        className="tn-champ-stage"
      >
        <span className="tn-champ-crest">
          <StreamImage src={winner.logoUrl} darkSrc={winner.logoDarkUrl} logo name={winner.name} />
        </span>
        <strong>{winner.name}</strong>
        {runnerUp && (
          <span className="tn-champ-final">
            {score
              ? text(`Thắng ${score} ${runnerUp.name}`, `Beat ${runnerUp.name} ${score}`)
              : text(`Á quân ${runnerUp.name}`, `Runner-up ${runnerUp.name}`)}
          </span>
        )}
      </Stage>
      <span className="tn-champ-event">
        <span title={tournament.name}>{tournament.name}</span>
        {day && <small>{formatCalendarDate(day.slice(0, 10), undefined, languageTag)}</small>}
      </span>
    </Link>
  )
}
