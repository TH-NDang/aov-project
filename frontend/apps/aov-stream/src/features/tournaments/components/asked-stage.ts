import { createContext, useContext, useEffect } from "react"
import { stageAnchor } from "./standings-anchors"

/** Room left between the pinned bars and the stage brought under them. */
const GAP = 16
/** What stays pinned at the top of the window once a page is scrolled past its head. */
const PINNED = ".hub-topbar, .wy-bar, .tn-sticky-tabs"

/** A stage the head of a competition asks the standings to open; they take it once, when they are drawn. */
export type StageAsk = { ask: (code: string | null) => void; take: () => string | null }

export function stageAsk(): StageAsk {
  let asked: string | null = null
  return {
    ask: (code) => {
      asked = code
    },
    take: () => {
      const code = asked
      asked = null
      return code
    },
  }
}

export const AskedStage = createContext<StageAsk>(stageAsk())

/** How far down the window the pinned bars reach, measured where they stand once they are pinned. */
function pinnedBottom() {
  let bottom = 0
  for (const bar of document.querySelectorAll<HTMLElement>(PINNED)) {
    const { position, top } = getComputedStyle(bar)
    if (position === "sticky" || position === "fixed")
      bottom = Math.max(bottom, (Number.parseFloat(top) || 0) + bar.offsetHeight)
  }
  return bottom
}

/**
 * Brings the table or the bracket of a stage under the pinned bars and gives it the focus. `glide` scrolls there, for a
 * reader who stays on the page; one who arrives is put there at once.
 */
export function showStage(code: string, glide: boolean) {
  const anchor = document.getElementById(stageAnchor(code))
  if (!anchor) return
  // A bracket is named by its drawing, which stands under the heading of its section.
  const box = anchor.closest("section") ?? anchor
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  window.scrollTo({
    top: Math.max(0, window.scrollY + box.getBoundingClientRect().top - pinnedBottom() - GAP),
    behavior: glide && !calm ? "smooth" : "instant",
  })
  anchor.focus({ preventScroll: true })
}

/**
 * Opens the stage the head asked for once the standings stand in the page. A passive effect runs after `Travel` has put
 * the page in its place, so this place is the last word; one that was taken is not opened again on the way back.
 */
export function useAskedStage() {
  const asked = useContext(AskedStage)
  useEffect(() => {
    const code = asked.take()
    if (code) showStage(code, false)
  }, [asked])
}
