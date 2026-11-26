import { Link } from "react-router"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText } from "../../../lib/feed-words"
import { conditions, findGames, NOTHING_ASKED } from "../../../lib/finder-model"
import { unseenMvps } from "../../../lib/found-model"
import { conditionWords } from "../../../lib/question-words"
import { statsHref } from "../../../lib/statistics-routes"
import type { Finder } from "./find-question"
import "./find-nothing.css"

/**
 * The ways out of a question no game answers: the player asked about as the MVP, where no seat names the player, and
 * each of its conditions that can be let go of, with the games that would be left.
 */
export function FindNothing({ finder }: { finder: Finder }) {
  const { text, languageTag } = useStreamLocale()
  const { data, question, names, order } = finder
  // Other games of the competition may answer what those of the period counted do not.
  const anywhere = data.period ? findGames(data.whole.games, question).length : 0
  const mvps = unseenMvps(data.feed.games, question)
  const player = question.player ? names.player(question.player) : ""
  const ways = conditions(question)
    .map((condition) => ({ condition, games: findGames(data.feed.games, condition.without).length }))
    .filter(({ games }) => games > 0)
    .sort((x, y) => y.games - x.games)
  return (
    <ul className="tn-find-nothing">
      {mvps > 0 && (
        <li>
          <Link to={finder.href({ ...question, mvp: true })} onClick={finder.follow}>
            {text(
              `${player} là MVP, có ${gamesText(mvps, text, languageTag)}`,
              `${player} as the MVP: ${gamesText(mvps, text, languageTag)}`,
            )}
          </Link>
        </li>
      )}
      {ways.map(({ condition, games }) => {
        const name = conditionWords(condition, question, names, text, languageTag)
        const left = gamesText(games, text, languageTag)
        return (
          <li key={`${condition.key}:${condition.hero?.key ?? ""}`}>
            <Link to={finder.href(condition.without)} onClick={finder.follow}>
              {text(`Bỏ lọc ${name}, còn ${left}`, `Without ${name}: ${left}`)}
            </Link>
          </li>
        )
      })}
      {anywhere > 0 && (
        <li>
          <Link to={statsHref(data.view.id, { question, sort: order })} onClick={finder.follow}>
            {text(
              `Tính cả giải, có ${gamesText(anywhere, text, languageTag)}`,
              `In the whole tournament: ${gamesText(anywhere, text, languageTag)}`,
            )}
          </Link>
        </li>
      )}
      <li>
        <Link to={finder.href(NOTHING_ASKED)} onClick={finder.follow}>
          {text("Xóa hết", "Clear all")}
        </Link>
      </li>
    </ul>
  )
}
