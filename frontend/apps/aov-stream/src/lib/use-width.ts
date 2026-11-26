import { useCallback, useState } from "react"

/**
 * The width of an element, read before the first paint, so nothing is drawn for one width and then for another. `first`
 * stands in until the element is laid out; while it is hidden, the width it had stays.
 */
export function useWidth<T extends HTMLElement>(first = 0) {
  const [width, setWidth] = useState(first)
  const ref = useCallback((element: T | null) => {
    if (!element) return
    const measure = () => setWidth((current) => element.clientWidth || current)
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}
