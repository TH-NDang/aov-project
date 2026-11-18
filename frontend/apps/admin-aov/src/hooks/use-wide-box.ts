import { useLayoutEffect, useState, type RefObject } from "react"

/** Whether a box is at least `minimum` pixels wide. An unmeasured box counts as wide, so tests and first paint get the full header. */
export function useWideBox(ref: RefObject<HTMLElement | null>, minimum: number) {
  const [wide, setWide] = useState(true)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return
    const measure = () => {
      const width = element.getBoundingClientRect().width
      if (width > 0) setWide(width >= minimum)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, minimum])
  return wide
}
