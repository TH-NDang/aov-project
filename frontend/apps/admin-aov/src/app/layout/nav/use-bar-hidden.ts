import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { useLocation } from "react-router"
import { barAtTop, followScroll } from "./nav-model"

/** How long the page may still move after the bar comes or goes, while the space it leaves settles. */
const SETTLE_MS = 300

/**
 * Whether the phone bar is out of the way: it slides off while the reader scrolls down `content` and comes back after
 * a short scroll up, at the top of the page, on a new page and when it takes focus.
 */
export function useBarHidden(content: RefObject<HTMLElement | null>, active: boolean) {
  const { pathname } = useLocation()
  const [hidden, setHidden] = useState(false)
  const state = useRef(barAtTop)

  useEffect(() => {
    const element = content.current
    setHidden(false)
    if (!element || !active) return
    state.current = { ...barAtTop, last: element.scrollTop }
    let settleUntil = 0
    // A page put back where it was left scrolls by itself while its rows load; only the reader's own scrolling counts.
    let engaged = false
    const engage = () => {
      engaged = true
    }
    const onScroll = () => {
      // Overscroll at either end bounces back on its own; only movement inside the page counts.
      const max = Math.max(0, element.scrollHeight - element.clientHeight)
      const top = Math.min(Math.max(element.scrollTop, 0), max)
      // The space the bar gives up or takes back can move the page by itself too.
      if (!engaged || performance.now() < settleUntil) {
        state.current = { ...state.current, last: top, travel: 0 }
        return
      }
      const next = followScroll(state.current, top)
      if (next.hidden !== state.current.hidden) {
        settleUntil = performance.now() + SETTLE_MS
        setHidden(next.hidden)
      }
      state.current = next
    }
    const starts = ["pointerdown", "wheel", "keydown"] as const
    for (const start of starts) element.addEventListener(start, engage, { passive: true })
    element.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      for (const start of starts) element.removeEventListener(start, engage)
      element.removeEventListener("scroll", onScroll)
    }
  }, [content, pathname, active])

  const show = useCallback(() => {
    state.current = { ...state.current, hidden: false, travel: 0 }
    setHidden(false)
  }, [])

  return { hidden: active && hidden, show }
}
