import { useEffect, useRef, useState } from "react"
import type { CarouselApi } from "@aov/ui/components/carousel"

export function useBannerRotation(api: CarouselApi, interacting: boolean) {
  const duration = 6000
  const [selected, setSelected] = useState(0)
  const [cycle, setCycle] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )
  const [visible, setVisible] = useState(() => document.visibilityState === "visible")
  const remaining = useRef(duration)
  const running = Boolean(api && !paused && !reducedMotion && !interacting && visible)

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onPreference = () => {
      setReducedMotion(preference.matches)
      setCycle((value) => value + 1)
    }
    const onVisibility = () => setVisible(document.visibilityState === "visible")
    preference.addEventListener("change", onPreference)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      preference.removeEventListener("change", onPreference)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  useEffect(() => {
    if (!api) return
    let previousSelection: number | undefined
    const onSelect = () => {
      const nextSelection = api.selectedScrollSnap()
      // A layout reinitialization can keep the current banner and its remaining time.
      if (nextSelection === previousSelection) return
      previousSelection = nextSelection
      setSelected(nextSelection)
      setCycle((value) => value + 1)
    }
    onSelect()
    api.on("select", onSelect)
    api.on("reInit", onSelect)
    return () => {
      api.off("select", onSelect)
      api.off("reInit", onSelect)
    }
  }, [api])

  useEffect(() => {
    remaining.current = duration
  }, [cycle])

  useEffect(() => {
    if (!api || !running) return
    const startedAt = performance.now()
    const timer = window.setTimeout(() => api.scrollNext(), remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current = Math.max(0, remaining.current - (performance.now() - startedAt))
    }
  }, [api, running, cycle])

  return { selected, paused, setPaused, reducedMotion, cycle, running, duration }
}
