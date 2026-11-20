import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"
import { useLocation, useNavigationType } from "react-router"

/** How long a restore keeps trying while a list is still loading back the rows it had. */
const RESTORE_WINDOW_MS = 4000

/** A page opened under the one before it (a drawer over a list) or closed back to it keeps the list where it was. */
function sameFamily(previous: string, next: string) {
  return previous === next || next.startsWith(`${previous}/`) || previous.startsWith(`${next}/`)
}

/**
 * Remembers how far each visit of a page was scrolled in Admin's content region and puts it back on Back or Forward, so
 * a long list opened from far down returns to the row the reader left. A new page starts at the top. The restore keeps
 * trying while the page loads its rows back, and stops as soon as the reader scrolls themself.
 */
export function useContentScrollMemory(ref: RefObject<HTMLElement | null>) {
  const location = useLocation()
  const navigation = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const previousPath = useRef(location.pathname)
  const currentKey = useRef(location.key)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const key = location.key
    // A page swap clamps the scroll after the new page is in; that late event must not overwrite the old visit's place.
    const save = () => {
      if (currentKey.current === key) positions.current.set(key, element.scrollTop)
    }
    element.addEventListener("scroll", save, { passive: true })
    return () => element.removeEventListener("scroll", save)
  }, [ref, location.key])

  useLayoutEffect(() => {
    const element = ref.current
    const from = previousPath.current
    previousPath.current = location.pathname
    currentKey.current = location.key
    if (!element) return

    const target = navigation === "POP" ? positions.current.get(location.key) : undefined
    if (target === undefined) {
      if (!sameFamily(from, location.pathname)) element.scrollTop = 0
      return
    }

    let frame = 0
    let stopped = false
    const started = performance.now()
    const stop = () => {
      stopped = true
      cancelAnimationFrame(frame)
    }
    const tick = () => {
      if (stopped) return
      element.scrollTop = target
      if (Math.abs(element.scrollTop - target) > 2 && performance.now() - started < RESTORE_WINDOW_MS)
        frame = requestAnimationFrame(tick)
    }
    tick()
    // The reader's own scrolling wins over a restore that is still waiting for rows.
    element.addEventListener("wheel", stop, { passive: true })
    element.addEventListener("touchstart", stop, { passive: true })
    element.addEventListener("keydown", stop)
    return () => {
      stop()
      element.removeEventListener("wheel", stop)
      element.removeEventListener("touchstart", stop)
      element.removeEventListener("keydown", stop)
    }
  }, [ref, location.key, location.pathname, navigation])
}
