import { Fragment, memo, useState, type CSSProperties } from "react"
import { WikiIcon } from "../../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import type { HeroListItem } from "../../../lib/hero-api"
import { HeroCard, HeroSearchHighlight } from "./hero-card"
import "./hero-library-grid.css"

/** The heroes in runs by the first letter of their code, which is the order the library lists them in. */
function letterRuns(heroes: readonly HeroListItem[]) {
  const runs: { letter: string; heroes: HeroListItem[] }[] = []
  for (const hero of heroes) {
    const letter = (hero.code.charAt(0) || "#").toUpperCase()
    const last = runs.at(-1)
    if (last?.letter === letter) last.heroes.push(hero)
    else runs.push({ letter, heroes: [hero] })
  }
  return runs
}

/**
 * The library's grid. Unfiltered, an index card with the first letter opens each run of heroes, as in a printed
 * library. While a search or a filter is on, the heroes it keeps come first in the order `matched` ranks them, with the
 * searched part of their names lit,
 * and every other hero follows faded under a line that counts them, so nothing leaves the page; that part folds away
 * with one press. Every card stays mounted in one grid and only moves by its CSS order and fades by its cell, so typing
 * never rebuilds the cards or reloads their pictures.
 */
export const HeroLibraryGrid = memo(function HeroLibraryGrid({
  heroes,
  matched,
  filtering,
  search,
  from,
}: {
  heroes: readonly HeroListItem[]
  matched: readonly HeroListItem[]
  filtering: boolean
  search: string
  from: string
}) {
  const { locale } = useWikiContext()
  const [restShown, setRestShown] = useState(true)
  // While a search or a filter is on, a kept hero stands at its place in `matched`, which is ranked; then the line, then
  // the others in the library's order.
  const place = new Map(matched.map((hero, index) => [hero.id, index]))
  const leftOut = heroes.length - matched.length
  const line: CSSProperties = { order: matched.length }
  const after: CSSProperties = { order: matched.length + 1 }

  return (
    // A new search only relights the names; the cards themselves are not drawn again.
    <HeroSearchHighlight.Provider value={filtering ? search : ""}>
      <div className="wiki-hero-grid wiki-hero-library-grid" data-filtering={filtering || undefined}>
        {letterRuns(heroes).map(({ letter, heroes: run }) => (
          <Fragment key={letter}>
            <div className="wiki-hero-letter" aria-hidden="true">
              <span>{letter}</span>
              <small>
                {wikiText(locale, `${run.length} tướng`, `${run.length} ${run.length === 1 ? "hero" : "heroes"}`)}
              </small>
            </div>
            {run.map((hero) => {
              const rank = place.get(hero.id)
              const keeps = !filtering || rank !== undefined
              return (
                <div
                  key={hero.id}
                  className="wiki-hero-library-cell"
                  data-left-out={!keeps || undefined}
                  style={filtering ? (rank !== undefined ? { order: rank } : after) : undefined}
                  hidden={!keeps && !restShown}
                >
                  <HeroCard hero={hero} from={from} credit />
                </div>
              )
            })}
          </Fragment>
        ))}
        {filtering && leftOut > 0 && (
          <header className="wiki-hero-rest-head" style={line}>
            <span>
              {wikiText(locale, "Không khớp", "Left out")} · {leftOut}
            </span>
            <button type="button" aria-expanded={restShown} onClick={() => setRestShown(!restShown)}>
              {restShown ? wikiText(locale, "Thu gọn", "Fold away") : wikiText(locale, "Hiện", "Show")}
              <WikiIcon name="chevron" size={16} />
            </button>
          </header>
        )}
      </div>
    </HeroSearchHighlight.Provider>
  )
})
