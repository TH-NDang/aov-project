import { useMemo } from "react"
import { useSearchParams } from "react-router"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText } from "../../../lib/feed-words"
import { findGames, NOTHING_ASKED, ordersByLength, sortFound } from "../../../lib/finder-model"
import { withParam } from "../../../lib/params"
import { namesOf } from "../../../lib/question-words"
import { statsHref } from "../../../lib/statistics-routes"
import { useGameOrder } from "../../../lib/use-game-order"
import { ChoiceTrack } from "./choice-track"
import { GameBar } from "./game-bar"
import { GameList } from "./game-list"
import type { StatsData } from "./stats-data"
import "./club-games.css"

type Result = "win" | "loss"

/** What a team's games are narrowed to, in Vietnamese and in English. */
const RESULTS: Record<Result, readonly [string, string]> = {
  win: ["Thắng", "Won"],
  loss: ["Thua", "Lost"],
}

/** Every game of a team, or those it won or lost, in the order asked for; the finder narrows them further. */
export function ClubGames({ data, teamId }: { data: StatsData; teamId: string }) {
  const { text, languageTag } = useStreamLocale()
  const [params] = useSearchParams()
  const asked = useGameOrder()
  const { view, feed, period } = data
  const all = useMemo(() => findGames(feed.games, { ...NOTHING_ASKED, team: teamId }), [feed, teamId])
  const of = (result: Result | null) => (result ? all.filter(({ won }) => won === (result === "win")) : all)
  // A result every game had narrows nothing, and one no game had leaves nothing.
  const results = (Object.keys(RESULTS) as Result[]).filter(
    (result) => of(result).length > 0 && of(result).length < all.length,
  )
  const result = results.find((item) => item === params.get("result")) ?? null
  const order = ordersByLength(all) ? asked.order : "new"
  return (
    <section className="tn-club-games" aria-labelledby="club-games">
      <h2 className="sr-only" id="club-games">
        {text(
          `${gamesText(all.length, text, languageTag)} của ${namesOf(view, text).team(teamId)}`,
          `${gamesText(all.length, text, languageTag)} of ${namesOf(view, text).team(teamId)}`,
        )}
      </h2>
      <GameBar
        found={all}
        finder={statsHref(view.id, {
          question: { team: teamId, won: result && result === "win" },
          sort: order,
          scope: period?.key,
        })}
      >
        {results.length > 0 && (
          <ChoiceTrack
            label={text("Kết quả", "Result")}
            fill="phone"
            value={result}
            choices={[null, ...results].map((item) => ({
              key: item,
              to: { search: `?${withParam(params, "result", item)}` },
              name: (
                <>
                  {item ? text(...RESULTS[item]) : text("Tất cả", "All")}{" "}
                  <small>{of(item).length.toLocaleString(languageTag)}</small>
                </>
              ),
            }))}
          />
        )}
      </GameBar>
      <GameList
        view={view}
        found={sortFound(of(result), order)}
        name={[teamId, result, order, period?.key].join(":")}
      />
    </section>
  )
}
