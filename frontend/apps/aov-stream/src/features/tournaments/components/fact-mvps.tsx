import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText } from "../../../lib/feed-words"
import { winsOf, type topMvps } from "../../../lib/highlights"
import { namesOf } from "../../../lib/question-words"
import { ENOUGH_FOR_SHARE, shareText } from "../../../lib/shares"
import { statsHref } from "../../../lib/statistics-routes"
import { FactRow } from "./fact-row"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./fact-mvps.css"

/** The players named the best of a game most often, with their share of the games their teams won. */
export function FactMvps({ data, mvps: { rows, level } }: { data: StatsData; mvps: ReturnType<typeof topMvps> }) {
  const { text, languageTag } = useStreamLocale()
  const { games } = data.feed
  const { teams } = data.view.content
  const names = namesOf(data.view, text)
  const named = games.filter(({ mvpId }) => mvpId).length
  const least = rows.at(-1)?.games.length ?? 0
  return (
    <Section
      title={text("MVP nhiều nhất", "Most MVPs")}
      note={
        named < games.length &&
        text(
          `${named.toLocaleString(languageTag)} trong ${gamesText(games.length, text, languageTag)} có ghi MVP`,
          `${named.toLocaleString(languageTag)} of ${gamesText(games.length, text, languageTag)} name one`,
        )
      }
    >
      <ol className="tn-fact-mvps">
        {rows.map(({ playerId, teamId, games: own }) => {
          const team = teamId ? teams[teamId] : undefined
          const wins = teamId ? winsOf(games, teamId) : { won: 0, named: 0 }
          const share = shareText(own.length, wins.named)
          const won =
            wins.named >= ENOUGH_FOR_SHARE &&
            (wins.named === wins.won
              ? text(`${share} số ván đội thắng`, `${share} of the team's wins`)
              : text(`${share} số ván đội thắng có ghi MVP`, `${share} of the team's wins that name one`))
          const count = gamesText(own.length, text, languageTag)
          const who = [names.player(playerId), teamId && names.team(teamId)].filter(Boolean).join(", ")
          return (
            <FactRow
              key={playerId}
              to={statsHref(data.view.id, { question: { player: playerId, mvp: true }, scope: data.period?.key })}
              art={
                <StreamImage
                  src={team?.logoUrl}
                  darkSrc={team?.logoDarkUrl}
                  logo
                  name={teamId ? names.team(teamId) : names.player(playerId)}
                />
              }
              figure={count}
              said={[`${who}: ${text(`MVP của ${count}`, `MVP of ${count}`)}`, won].filter(Boolean).join(", ")}
            >
              <span>
                <b>{names.player(playerId)}</b> {teamId && names.team(teamId)}
              </span>
              {won && <small>{won}</small>}
            </FactRow>
          )
        })}
      </ol>
      {level > 0 && (
        <p className="tn-fact-level">
          {text(
            `Thêm ${level} tuyển thủ cùng có ${gamesText(least, text, languageTag)}.`,
            `${level} more ${level === 1 ? "player has" : "players have"} ${least}, too.`,
          )}
        </p>
      )}
    </Section>
  )
}
