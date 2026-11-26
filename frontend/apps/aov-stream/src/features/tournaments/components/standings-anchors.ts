import type { MouseEvent } from "react"
import type { BracketRound } from "../../../lib/bracket-model"
import type { PlaceWay } from "../../../lib/place-zones"

/** The name a stage goes by inside the page. */
export const stageAnchor = (stageCode: string) => `stage-${stageCode}`

/** The name a round of a bracket goes by inside the page; its cards carry it as `data-round`. */
export const roundAnchor = (stageCode: string, { lane, order }: Pick<BracketRound, "lane" | "order">) =>
  `${stageAnchor(stageCode)}-${lane}-${order}`

/** Where in the page a way leads: the round of a bracket, or the table of another stage. */
export function wayAnchor(way: PlaceWay): string | null {
  if (way.kind === "ROUND") return roundAnchor(way.stage.code, way.round)
  return way.kind === "STAGE" ? stageAnchor(way.stage.code) : null
}

/**
 * Opens a place of the page a link names: brings it into view with its matches, moves the focus to its heading and rings
 * the matches for a moment, so the eye finds them.
 */
export function openAnchor(event: MouseEvent<HTMLAnchorElement>) {
  const anchor = decodeURIComponent(event.currentTarget.hash.slice(1))
  const place = document.getElementById(anchor)
  if (!place || event.metaKey || event.ctrlKey || event.shiftKey) return
  event.preventDefault()
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const cards = [...document.querySelectorAll<HTMLElement>(`[data-round="${CSS.escape(anchor)}"]`)]
  const first = cards[0] ?? place
  first.scrollIntoView({
    behavior: calm ? "auto" : "smooth",
    block: cards.length ? "center" : "start",
    inline: "center",
  })
  place.focus({ preventScroll: true })
  for (const card of cards)
    card.animate(
      [
        { boxShadow: "0 0 0 3px var(--hub-accent)", offset: 0 },
        { boxShadow: "0 0 0 3px var(--hub-accent)", offset: 0.5 },
        { boxShadow: "0 0 0 3px transparent", offset: 1 },
      ],
      { duration: 1800, easing: "ease-out" },
    )
}
