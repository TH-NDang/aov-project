import { useEffect, useRef, useState } from "react"

/**
 * Whether a bar that sticks to the top has reached it. `edge` goes on an empty element right above the bar: once that
 * one has scrolled out over the top, the bar is stuck. A bar that gets thinner then must give the height back as a
 * margin, or the page would move under it.
 */
export function useStuck<T extends HTMLElement>() {
  const edge = useRef<T>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const element = edge.current
    if (!element || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setStuck(!entry.isIntersecting && entry.boundingClientRect.top <= (entry.rootBounds?.top ?? 0))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { edge, stuck }
}
