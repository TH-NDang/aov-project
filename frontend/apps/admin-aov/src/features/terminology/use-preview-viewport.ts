import { useLayoutEffect, useRef, useState } from "react"

export function usePreviewViewport() {
  const container = useRef<HTMLElement>(null)
  const [viewport, setViewport] = useState({
    narrow: false,
    keyboard: false,
    height: 520,
    top: 0,
    left: 0,
    width: 0,
    visibleHeight: 0,
  })

  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const visual = window.visualViewport
    let frame = 0
    let restingHeight = window.innerHeight
    let lastWidth = window.innerWidth
    const measure = () => {
      const bounds = element.getBoundingClientRect()
      const active = document.activeElement
      const editing =
        active instanceof HTMLElement &&
        (element.contains(active) || !!active.closest('[data-slot="entity-reference-suggestions"]'))
      if (Math.abs(window.innerWidth - lastWidth) > 80 || !editing) restingHeight = window.innerHeight
      lastWidth = window.innerWidth
      const visibleHeight = visual?.height ?? window.innerHeight
      const narrow = bounds.width > 0 && bounds.width < 576
      // Ignore pinch zoom and small viewport changes caused by browser chrome.
      const keyboard = narrow && editing && (visual?.scale ?? 1) === 1 && restingHeight - visibleHeight > 140
      setViewport((previous) => {
        const next = {
          narrow,
          keyboard,
          height: keyboard
            ? previous.height
            : Math.max(360, Math.min(680, visibleHeight - Math.max(0, bounds.top) - 20)),
          top: visual?.offsetTop ?? 0,
          left: visual?.offsetLeft ?? 0,
          width: visual?.width ?? window.innerWidth,
          visibleHeight,
        }
        return Object.keys(next).every((key) => next[key as keyof typeof next] === previous[key as keyof typeof next])
          ? previous
          : next
      })
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule)
    observer?.observe(element)
    window.addEventListener("resize", schedule)
    visual?.addEventListener("resize", schedule)
    visual?.addEventListener("scroll", schedule)
    document.addEventListener("focusin", schedule)
    document.addEventListener("focusout", schedule)
    measure()
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener("resize", schedule)
      visual?.removeEventListener("resize", schedule)
      visual?.removeEventListener("scroll", schedule)
      document.removeEventListener("focusin", schedule)
      document.removeEventListener("focusout", schedule)
    }
  }, [])

  return { container, ...viewport }
}
