import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { defaultSpan, phaseSpan, timelineSpans } from "../../../model/broadcast-timeline"
import { phaseRange, placeAt, type Place } from "../../../model/playback-place"
import type { Playhead } from "../../../model/playhead"
import type { GameChapter } from "../../../model/series-vod"
import { usePlayheadValue } from "../../game/use-playhead"
import { useTimelineZoom } from "./use-timeline-zoom"

/** A value that changes while the track is scrolled or pointed at, so that only what shows it draws again. */
export type Store<T> = { get(): T; set(next: T): void; subscribe(listener: () => void): () => void }

export function createStore<T>(initial: T): Store<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return
      value = next
      for (const listener of [...listeners]) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export const useStore = <T>(store: Store<T>): T => useSyncExternalStore(store.subscribe, store.get)

/** Seconds of video the track shows between its two edges. */
export type Shown = { from: number; to: number }

/** Space left and right of the track inside the box it scrolls in, so a mark at either end is not cut. */
export const PLANE_MARGIN = 14
/** Size the track is drawn for until it has been measured. */
const UNMEASURED = { width: 800, height: 150 }
/** A change of the playhead by more than this between two readings is a jump, not the video playing on. */
const JUMP = 2
/** Part of the view kept before the playhead when the view turns a page. */
const PAGE_AIR = 0.05
/** Video shown on both sides of the playhead while the games of a match have no place in it. */
const AROUND = 600

type Range = { key: string; from: number; to: number }

/** The stretch of video that fits a game: its phase the video is in, or the game itself while the video is elsewhere. */
function rangeOf(chapter: GameChapter, chapters: GameChapter[], second: number, duration: number): Range | null {
  if (!chapter.synced) return null
  const here = placeAt(chapters, second)
  if (here.chapter?.gameId === chapter.gameId) return phaseRange(here, second, duration)
  const place: Place = { kind: chapter.live ? "play" : "draft", chapter, clock: 0 }
  return phaseRange(place, chapter.live ? chapter.start : chapter.from, duration)
}

/**
 * What the track shows: the phase the video is in until somebody zooms by hand, then the span they chose. It follows
 * the playhead after a jump and turns by one page when the video plays out of view. While a press on the track or on a
 * mark lasts, scale and scroll stand still: the video follows the pointer into another phase, and a track fitted to
 * that phase under the pointer would turn a few pixels into minutes. The new phase is fitted once the press ends.
 */
export function useTimelineView({
  playhead,
  duration,
  chapters,
  focused,
  playing,
  fit,
}: {
  playhead: Playhead
  duration: number
  chapters: GameChapter[]
  focused: GameChapter | null
  playing: boolean
  /** Changes when the phase of the chosen game is asked for. */
  fit: number
}) {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const plane = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(UNMEASURED)
  const [picked, setPicked] = useState<number | "whole" | null>(null)
  // State so that the end of a press draws again and fits the phase it waited for; the ref for the playhead's listener.
  const [holding, setHolding] = useState(false)
  const held = useRef(false)
  const hold = useCallback((on: boolean) => {
    held.current = on
    setHolding(on)
  }, [])

  const rangeAt = (second: number): Range | null =>
    phaseRange(placeAt(chapters, second), second, duration) ??
    (chapters.length ? { key: "around", from: second - AROUND, to: second + AROUND } : null)
  const key = usePlayheadValue(playhead, (second) => rangeAt(second)?.key ?? "")
  // The stretch is read when its key changes, not with the running second, so the track stands still meanwhile.
  const [range, setRange] = useState(() => rangeAt(playhead.get()))
  const [lastKey, setLastKey] = useState(key)
  const [lastFit, setLastFit] = useState(fit)
  if (fit !== lastFit) {
    const second = playhead.get()
    setLastFit(fit)
    setPicked(null)
    setRange((focused && rangeOf(focused, chapters, second, duration)) ?? rangeAt(second))
  } else if (key !== lastKey && !holding) {
    setLastKey(key)
    setRange(rangeAt(playhead.get()))
  }

  const from = range ? Math.min(duration, Math.max(0, range.from)) : 0
  const to = range ? Math.max(from, Math.min(duration, range.to)) : 0
  const middle = range ? (from + to) / 2 : null
  const automatic = range ? phaseSpan({ from, to }, duration) : defaultSpan(duration)
  const shown = picked === null ? automatic : picked === "whole" ? duration : Math.min(picked, duration)
  const zoom = duration / shown
  const planeWidth = Math.max(1, zoom * size.width - 2 * PLANE_MARGIN)
  const pxPerSecond = planeWidth / duration

  const [shownNow] = useState(() => createStore<Shown>({ from: 0, to: duration }))
  const { pinching, holdPoint } = useTimelineZoom({ viewport, plane, duration, shown, setSpan: setPicked })

  const tell = useEffectEvent(() => {
    const width = plane.current?.clientWidth
    if (viewport && width) {
      const second = (px: number) => Math.min(duration, Math.max(0, ((px - PLANE_MARGIN) / width) * duration))
      shownNow.set({ from: second(viewport.scrollLeft), to: second(viewport.scrollLeft + viewport.clientWidth) })
      return
    }
    // Folded, or drawn without a layout: what the track would show.
    const start = Math.min(duration - shown, Math.max(0, (middle ?? playhead.get()) - shown / 2))
    shownNow.set({ from: start, to: start + shown })
  })
  /** Scrolls a second to a part of the width, the middle unless it is said otherwise. */
  const scrollTo = (second: number, part = 0.5) => {
    if (!viewport || !plane.current) return
    const left = PLANE_MARGIN + (second / duration) * plane.current.clientWidth - part * viewport.clientWidth
    viewport.scrollTo?.({ left, behavior: "instant" })
  }

  // Keyed on the span and the stretch, not on the scale or the playhead: the player corrects the length of the video by
  // a second once it starts, and neither that nor the video playing on may move the track. A span chosen by hand does
  // not follow the phases, so a new stretch does not move it either.
  const settle = useEffectEvent(() => {
    if (!holdPoint()) scrollTo(picked === null && middle !== null ? middle : playhead.get())
    tell()
  })
  const followed = picked === null ? range : null
  useLayoutEffect(() => settle(), [shown, followed, fit, viewport])

  const measured = useRef<number | null>(null)
  const measure = useEffectEvent((box: HTMLDivElement) => {
    const { from, to } = shownNow.get()
    measured.current = box.clientWidth
    setSize({ width: box.clientWidth || UNMEASURED.width, height: box.clientHeight || UNMEASURED.height })
    // Another width is another scale: what stood in the middle stays there.
    scrollTo((from + to) / 2)
    tell()
  })
  useEffect(() => {
    if (!viewport) return
    // While the width changes, a scroll position still belongs to the width before; measuring puts it right.
    const onScroll = () => {
      if (measured.current === null || measured.current === viewport.clientWidth) tell()
    }
    viewport.addEventListener("scroll", onScroll, { passive: true })
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measure(viewport))
    observer?.observe(viewport)
    return () => {
      viewport.removeEventListener("scroll", onScroll)
      observer?.disconnect()
    }
  }, [viewport])

  const before = useRef(playhead.get())
  const follow = useEffectEvent(() => {
    const second = playhead.get()
    const last = before.current
    before.current = second
    if (held.current) return
    const { from, to } = shownNow.get()
    if (Math.abs(second - last) > JUMP) {
      if (second < from || second > to) scrollTo(second)
    } else if (playing && second > to && last >= from && last <= to) scrollTo(second, PAGE_AIR)
  })
  useEffect(() => playhead.subscribe(() => follow()), [playhead])

  const spans = timelineSpans(duration)
  const longer = shown < duration ? (spans.find((span) => span > shown) ?? duration) : null
  const shorter = [...spans].reverse().find((span) => span < shown) ?? null
  return {
    viewport: setViewport,
    plane,
    height: size.height,
    shown,
    zoom,
    pxPerSecond,
    shownNow,
    pinching,
    /** Holds scale and scroll while a press on the track or on a mark lasts; false fits what the press passed into. */
    hold,
    /** The two neighbouring steps; null where there is none. */
    longer: longer === null ? null : () => setPicked(longer),
    shorter: shorter === null ? null : () => setPicked(shorter),
    toggleWhole: () => {
      if (picked === null || shown < duration) return setPicked("whole")
      setPicked(null)
      setRange(rangeAt(playhead.get()))
    },
  }
}

export type TimelineView = ReturnType<typeof useTimelineView>
