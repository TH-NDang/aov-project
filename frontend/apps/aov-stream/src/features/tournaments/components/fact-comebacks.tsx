import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import type { Comeback } from "../../../lib/facts-model"
import { score } from "../../../lib/feed-words"
import { tally } from "../../../lib/hero-model"
import { competitionMatchHref } from "../../../lib/match-model"
import { matchRound } from "../../../lib/match-schedule"
import { dayMonth } from "../../../lib/match-time"
import { namesOf } from "../../../lib/question-words"
import { FactRow } from "./fact-row"
import { FactWords } from "./fact-words"
import { GameMarks } from "./game-marks"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./fact-comebacks.css"

/** Matches won after being two games behind, with their games in order; each opens its match. */
export function FactComebacks({ data, comebacks }: { data: StatsData; comebacks: Comeback[] }) {
  const { text, languageTag } = useStreamLocale()
  const names = namesOf(data.view, text)
  const { teams } = data.view.content
  return (
    <Section title={text("Lội ngược dòng", "Comebacks")} note={text("từ chỗ kém hai ván", "from two games down")}>
      <ol className="tn-fact-comebacks">
        {comebacks.map(({ seriesId, game: { entry, day }, winnerId, loserId, marks }) => {
          const team = teams[winnerId]
          const result = score(tally(marks))
          const place = [entry && matchRound(entry, languageTag), day && dayMonth(day, languageTag)]
            .filter(Boolean)
            .join(", ")
          const words = text(
            `*${names.team(winnerId)}* thắng ngược *${names.team(loserId)}* ${result}`,
            `*${names.team(winnerId)}* came back to beat *${names.team(loserId)}* ${result}`,
          )
          return (
            <FactRow
              key={seriesId}
              to={entry ? competitionMatchHref(data.view.id, entry.match.key) : `/matches/${seriesId}`}
              art={<StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={names.team(winnerId)} />}
              figure={<GameMarks marks={marks} height={18} />}
              said={[words.replaceAll("*", ""), place].filter(Boolean).join(", ")}
            >
              <span>
                <FactWords words={words} />
              </span>
              {place && <small>{place}</small>}
            </FactRow>
          )
        })}
      </ol>
    </Section>
  )
}
