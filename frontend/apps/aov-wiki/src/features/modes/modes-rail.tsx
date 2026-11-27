import { useRef } from "react"
import { Link } from "react-router"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import type { ModeCard } from "./mode-api"
import { AvailabilityState, durationText, ModeArt, ModeHeading } from "./mode-ui"
import "./modes-rail.css"

/**
 * What can be played now: a row of wide cards that scrolls sideways and stops card by card, each with its art, the
 * game's own words for how long it stays open, the name and the match length. Wide screens add two buttons that move
 * the row by a screenful; phones swipe it, the next card peeking in at the edge.
 */
export function ModesRail({ modes, wide }: { modes: ModeCard[]; wide: boolean }) {
  const { href, locale } = useWikiContext()
  const text = useWikiText()
  const row = useRef<HTMLUListElement>(null)
  const move = (direction: 1 | -1) => {
    const element = row.current
    if (!element) return
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: "smooth" })
  }
  return (
    <section className="wiki-modes-rail" aria-labelledby="modes-rail-title">
      <ModeHeading
        id="modes-rail-title"
        title={text("Đang mở", "Open now")}
        count={modes.length}
        action={
          wide && (
            <>
              <button
                type="button"
                className="wiki-modes-rail-step"
                aria-label={text("Lùi", "Back")}
                onClick={() => move(-1)}
              >
                <WikiIcon name="chevronLeft" size={18} />
              </button>
              <button
                type="button"
                className="wiki-modes-rail-step"
                aria-label={text("Tiếp", "Next")}
                onClick={() => move(1)}
              >
                <WikiIcon name="chevronRight" size={18} />
              </button>
            </>
          )
        }
      />
      <ul ref={row} className="wiki-modes-rail-row">
        {modes.map((mode) => {
          const length = durationText(mode.duration, locale)
          return (
            <li key={mode.code}>
              <Link className="wiki-modes-rail-card" to={href(`/modes/${encodeURIComponent(mode.code)}`)}>
                <ModeArt className="wiki-modes-rail-art" image={mode.art} name={mode.name} inCard />
                <span className="wiki-modes-rail-state">
                  <AvailabilityState availability={mode.availability} />
                </span>
                <span className="wiki-modes-rail-text">
                  <strong>{mode.name}</strong>
                  {length && <small>{length}</small>}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
