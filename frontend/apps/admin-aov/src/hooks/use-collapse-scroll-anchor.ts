import { useCallback, useLayoutEffect, useRef, type RefObject } from "react"

/** Keep a collapsed sticky group under the pointer before the browser paints. */
export function useCollapseScrollAnchor(root: RefObject<HTMLElement | null>, expanded: object) {
  const pending = useRef<{ header: HTMLElement; top: number } | null>(null)
  const preserve = useCallback((header: HTMLElement) => {
    pending.current = { header, top: header.getBoundingClientRect().top }
  }, [])
  useLayoutEffect(() => {
    const anchor = pending.current
    pending.current = null
    const scroller = root.current
    if (!anchor || !scroller || !scroller.contains(anchor.header)) return
    scroller.scrollTop += anchor.header.getBoundingClientRect().top - anchor.top
  }, [root, expanded])
  return preserve
}
