import { useLayoutEffect, useRef } from "react"

/**
 * Keeps what a reader pressed where it stands on the screen, whatever grows or shrinks above it once `change` has taken
 * effect. Not every browser does so by itself, and none where the change is in view.
 */
export function useHeldPlace(change: string | null) {
  const held = useRef<{ element: Element; top: number } | null>(null)
  useLayoutEffect(() => {
    const place = held.current
    held.current = null
    if (!place?.element.isConnected) return
    const moved = place.element.getBoundingClientRect().top - place.top
    if (moved) window.scrollBy({ top: moved, behavior: "instant" })
  }, [change])
  return (element: Element) => {
    held.current = { element, top: element.getBoundingClientRect().top }
  }
}
