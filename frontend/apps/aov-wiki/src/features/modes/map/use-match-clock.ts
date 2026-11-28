import { useEffect, useRef, useState } from "react"
import { crossed, type TempoMoment } from "@aov/ui/lib/battle-map"

export const CLOCK_SPEEDS = [1, 10, 60] as const
export type ClockSpeed = (typeof CLOCK_SPEEDS)[number]

/**
 * A match clock for the timeline. At x1 it keeps real time, so a reader can start it with their own match; it reads the
 * time that passed rather than counting ticks, so a tab in the background stays on time. `onCross` hears each mark the
 * running clock passes, never one the reader jumps to.
 */
export function useMatchClock(tempo: readonly TempoMoment[], end: number, onCross: (moment: TempoMoment) => void) {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState<ClockSpeed>(1)
  const at = useRef(0)
  const listener = useRef(onCross)

  useEffect(() => {
    listener.current = onCross
  })

  useEffect(() => {
    if (!running) return
    let previous = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const next = Math.min(end, at.current + ((now - previous) / 1000) * speed)
      previous = now
      const passed = crossed(tempo, at.current, next)
      at.current = next
      setSeconds(next)
      const last = passed.at(-1)
      if (last) listener.current(last)
      if (next >= end) setRunning(false)
    }, 250)
    return () => window.clearInterval(timer)
  }, [running, speed, end, tempo])

  const seek = (value: number) => {
    at.current = Math.max(0, Math.min(end, value))
    setSeconds(at.current)
  }

  return {
    seconds,
    running,
    speed,
    setSpeed,
    seek,
    toggle: () => {
      if (!running && at.current >= end) seek(0)
      setRunning((value) => !value)
    },
    reset: () => {
      setRunning(false)
      seek(0)
    },
  }
}

const AUTO_SHOW_KEY = "wiki-map-auto-show"

/** Whether the timeline shows each mark by itself when the clock reaches it; kept in this browser only. */
export function readAutoShow() {
  try {
    return window.localStorage.getItem(AUTO_SHOW_KEY) !== "off"
  } catch {
    return true
  }
}

export function writeAutoShow(on: boolean) {
  try {
    window.localStorage.setItem(AUTO_SHOW_KEY, on ? "on" : "off")
  } catch {
    // Without storage the choice lasts for this visit only.
  }
}
