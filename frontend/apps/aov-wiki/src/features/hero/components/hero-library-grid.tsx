import { Fragment, memo, useState, type CSSProperties } from "react"
import { WikiIcon } from "../../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import type { HeroListItem } from "../../../lib/hero-api"
import type { HeroRun, HeroStanding } from "../model/hero-order"
import { HeroCard, HeroSearchHighlight } from "./hero-card"
import { HeroPreview } from "./hero-preview"
import "./hero-library-grid.css"

/** The id of a run's index card, which the letter rail scrolls to. */
export function heroRunAnchor(key: string) {
  return `wiki-hero-run-${key}`
}

/**
 * The library's grid. Unfiltered, an index card opens each run of heroes, as in a printed library: a letter, a tier or
 * a difficulty, after the order the reader chose. While a search or a filter is on, the heroes it keeps come first in
 * the order `matched` ranks them, with the searched part of their names lit, and every other hero follows faded under a
 * line that counts them, so nothing leaves the page; that part folds away with one press. Every card stays mounted in
 * one grid and only moves by its CSS order and fades by its cell, so typing never rebuilds the cards or reloads their
 * pictures. With a mouse, resting on a card opens a preview of its hero.
 */
export const HeroLibraryGrid = memo(function HeroLibraryGrid({
  runs,
  total,
  matched,
  filtering,
  search,
  from,
  standings,
  preview,
}: {
  runs: readonly HeroRun<HeroListItem>[]
  total: number
  matched: readonly HeroListItem[]
  filtering: boolean
  search: string
  from: string
  standings: ReadonlyMap<string, HeroStanding>
  /** Whether resting the pointer on a card opens its preview: only on a wide screen with a mouse. */
  preview: boolean
}) {
  const { locale } = useWikiContext()
  const [restShown, setRestShown] = useState(true)
  // While a search or a filter is on, a kept hero stands at its place in `matched`, which is ranked; then the line, then
  // the others in the library's order.
  const place = new Map(matched.map((hero, index) => [hero.id, index]))
  const leftOut = total - matched.length
  const line: CSSProperties = { order: matched.length }
  const after: CSSProperties = { order: matched.length + 1 }

  return (
    // A new search only relights the names; the cards themselves are not drawn again.
    <HeroSearchHighlight.Provider value={filtering ? search : ""}>
      <div className="wiki-hero-grid wiki-hero-library-grid" data-filtering={filtering || undefined}>
        {runs.map(({ key, label, labelKind, heroes: run }) => (
          <Fragment key={key}>
            {label !== null && (
              <div id={heroRunAnchor(key)} className="wiki-hero-letter" data-label={labelKind} aria-hidden="true">
                <span>{label}</span>
                <small>
                  {wikiText(locale, `${run.length} tướng`, `${run.length} ${run.length === 1 ? "hero" : "heroes"}`)}
                </small>
              </div>
            )}
            {run.map((hero) => {
              const rank = place.get(hero.id)
              const keeps = !filtering || rank !== undefined
              const card = <HeroCard hero={hero} from={from} credit />
              return (
                <div
                  key={hero.id}
                  className="wiki-hero-library-cell"
                  data-left-out={!keeps || undefined}
                  style={filtering ? (rank !== undefined ? { order: rank } : after) : undefined}
                  hidden={!keeps && !restShown}
                >
                  {preview ? (
                    <HeroPreview hero={hero} standing={standings.get(hero.id)}>
                      {card}
                    </HeroPreview>
                  ) : (
                    card
                  )}
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
