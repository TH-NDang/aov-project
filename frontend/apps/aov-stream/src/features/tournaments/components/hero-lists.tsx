import { useMemo } from "react"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText } from "../../../lib/feed-words"
import { findGames, NOTHING_ASKED, sortFound, type Question } from "../../../lib/finder-model"
import type { HeroRecord } from "../../../lib/hero-model"
import type { HeroList } from "../../../lib/hero-page-model"
import { statsHref } from "../../../lib/statistics-routes"
import { useGameOrder } from "../../../lib/use-game-order"
import { GameBar } from "./game-bar"
import { GameList } from "./game-list"
import type { StatsData } from "./stats-data"
import "./hero-lists.css"

/**
 * The games a hero was picked or banned in, each seen from the side that did it. More conditions are asked in the
 * finder, where the hero is placed already.
 */
export function HeroLists({ data, record: { hero }, list }: { data: StatsData; record: HeroRecord; list: HeroList }) {
  const { text, languageTag } = useStreamLocale()
  const { order } = useGameOrder()
  const { games } = data.feed
  const asked = useMemo((): Partial<Question> => (list === "picks" ? { pick: [hero] } : { banA: [hero] }), [list, hero])
  const found = useMemo(() => findGames(games, { ...NOTHING_ASKED, ...asked }), [games, asked])
  const count = gamesText(found.length, text, languageTag)
  return (
    <section className="tn-hh-games" aria-labelledby="hero-games">
      <h2 className="sr-only" id="hero-games">
        {list === "picks"
          ? text(`${count} ${hero.name} được chọn`, `${count} with ${hero.name} picked`)
          : text(`${count} ${hero.name} bị cấm`, `${count} with ${hero.name} banned`)}
      </h2>
      <GameBar
        found={found}
        finder={statsHref(data.view.id, {
          question: list === "picks" ? { pick: [hero] } : { ban: [hero] },
          sort: order,
          scope: data.period?.key,
        })}
      />
      <GameList
        view={data.view}
        found={sortFound(found, order)}
        asked={asked}
        name={[hero.key, list, order, data.period?.key].join(":")}
      />
    </section>
  )
}
