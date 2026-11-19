import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import type { Selection } from "@aov/community-contracts"
import { formatClock } from "@/lib/clock"
import { timelineTicks, type BroadcastChapter } from "../../model/broadcast-timeline"
import type { GameView } from "../../model/game-view"
import { chapterAt, type GameChapter } from "../../model/series-vod"
import { clusterEvents, type EventCluster, type TimelineEvent } from "../../model/timeline"
import type { ItemLookups } from "../game/cluster-card"
import { TimelineHint, TimelineToolbar } from "./timeline-controls"
import { DraftMarkers } from "./timeline-draft"
import { TimelineLanes, TimelineOverview } from "./timeline-frame"
import { TrackBackground, TrackReadouts } from "./timeline-guides"
import { LoadoutMarks, StartFlags } from "./timeline-markers"
import { EventPills } from "./timeline-pills"
import { PILL_PX, ROW_TOP, rowOf, type TimelineEditing, type TimelineRow } from "./timeline-rows"
import { useMarkerDrag } from "./use-marker-drag"
import { useTimelineView } from "./use-timeline-view"

/**
 * Timeline of the whole broadcast. The overview always shows the full video with every game as a chapter; the
 * detail track below can be zoomed and scrolled, with blue and red rows for kills and items and a middle row for
 * objectives, so a single moment is readable without hovering. Each row is named after what it holds. While
 * recording, a row's plus button or a double click records a moment there and markers of the focused game can be
 * dragged to another second: moments, ban/pick turns, the edges of the ban/pick phase and the moments the broadcast
 * showed loadouts. The video follows a drag, so a marker is placed by the picture and not by the number.
 */
export function BroadcastTimeline({
  duration,
  current,
  chapters,
  flags = [],
  events,
  views,
  chapterTitle,
  focusedGameId,
  activeId,
  isDimmed,
  lookups,
  label = "Dòng thời gian video",
  heroIcon,
  editing,
  notice,
  onSeek,
  onSelect,
  onOpen,
}: {
  duration: number
  current: number
  chapters: GameChapter[]
  flags?: BroadcastChapter[]
  /** Moments already converted to video seconds (see `broadcastEvents`). */
  events: TimelineEvent[]
  views: Record<string, GameView>
  chapterTitle: (chapter: GameChapter) => string
  focusedGameId: string | null
  activeId: string | null
  isDimmed: (event: TimelineEvent) => boolean
  lookups: ItemLookups
  label?: string
  /** Icon of a hero taken in a ban/pick turn. */
  heroIcon?: (hero: Selection) => string | null | undefined
  editing?: TimelineEditing
  /** Shown in place of the hint, such as the undo for a marker that was just moved; the line keeps its height. */
  notice?: ReactNode
  onSeek: (second: number) => void
  onSelect: (event: TimelineEvent) => void
  onOpen: (cluster: EventCluster) => void
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const here = chapterAt(chapters, current)
  const focused = chapters.find((chapter) => chapter.gameId === focusedGameId) ?? here
  const secondAt = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect()
    return Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration)
  }
  const [card, setCard] = useState<string | null>(null)
  const markers = useMarkerDrag({
    editing,
    chapters,
    events,
    duration,
    current,
    secondAt,
    onSeek,
    onMoveStart: () => setCard(null),
  })
  const view = useTimelineView({ viewport, track, duration, current, focused, press: markers.press })
  const [scrub, setScrub] = useState<number | null>(null)
  const pointer = useRef<{ x: number; drag: boolean } | null>(null)

  const mergeWindow = Math.max(3, (PILL_PX / view.width) * duration)
  const clusters = useMemo(() => clusterEvents(events, mergeWindow, rowOf), [events, mergeWindow])
  const ticks = timelineTicks(duration, view.width)
  const pct = (second: number) => `${Math.min(100, Math.max(0, (second / duration) * 100))}%`

  const rowAt = (clientY: number): TimelineRow => {
    const y = clientY - track.current!.getBoundingClientRect().top
    return y < (ROW_TOP.BLUE + ROW_TOP.MID) / 2 ? "BLUE" : y < (ROW_TOP.MID + ROW_TOP.RED) / 2 ? "MID" : "RED"
  }
  const interactive = (target: EventTarget) => !!(target as HTMLElement).closest("[data-marker], [data-chapter]")
  // Mouse seeks and drags immediately; touch seeks on tap so swiping still scrolls the zoomed track.
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactive(event.target)) return
    markers.pressTrack()
    const touch = (event as { pointerType?: string }).pointerType === "touch"
    pointer.current = { x: event.clientX, drag: !touch }
    if (touch) return
    onSeek(secondAt(event.clientX))
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic or already-released pointers cannot be captured; dragging still works inside the track.
    }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactive(event.target) || markers.press.current) return setScrub(null)
    const second = secondAt(event.clientX)
    setScrub(second)
    if (pointer.current?.drag) onSeek(second)
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointer.current
    pointer.current = null
    if (start && !start.drag && !view.pinching.current && Math.abs(event.clientX - start.x) < 8)
      onSeek(secondAt(event.clientX))
  }

  return (
    <div className="space-y-2">
      <TimelineToolbar
        current={current}
        here={here}
        focused={focused}
        duration={duration}
        spans={view.spans}
        shown={view.shown}
        following={view.following}
        onFit={view.fitChapter}
        onSpan={view.setSpan}
      />
      <TimelineHint editing={editing} focusedNumber={focused?.number} notice={notice} />

      <div className="esp-bt-frame">
        <span className="esp-bt-lane-title">Cả video</span>
        <TimelineOverview
          duration={duration}
          current={current}
          chapters={chapters}
          events={events}
          focusedGameId={focused?.gameId}
          zoom={view.zoom}
          scroll={view.scroll}
          pct={pct}
          onSeek={(second) => {
            onSeek(second)
            view.scrollTo(second, "smooth")
          }}
        />
        <TimelineLanes sides={focused ? views[focused.gameId]?.sides : undefined} editing={editing} />

        <div ref={viewport} className="overflow-x-auto pt-5 pb-1" data-timeline-viewport onScroll={view.onScroll}>
          <div
            ref={track}
            className="esp-bt-track"
            style={{ width: `calc(${view.zoom * 100}% - 28px)` }}
            role="slider"
            tabIndex={0}
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={Math.round(current)}
            aria-valuetext={formatClock(current)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (pointer.current = null)}
            onPointerLeave={() => setScrub(null)}
            onDoubleClick={(event) => {
              if (!editing?.canCreate || interactive(event.target)) return
              editing.onCreate(rowAt(event.clientY), secondAt(event.clientX))
            }}
            onKeyDown={(event) => {
              const delta = event.key === "ArrowRight" ? 5 : event.key === "ArrowLeft" ? -5 : 0
              if (!delta) return
              event.preventDefault()
              event.stopPropagation()
              onSeek(Math.min(duration, Math.max(0, current + delta * (event.shiftKey ? 0.2 : 1))))
            }}
          >
            <TrackBackground
              ticks={ticks}
              chapters={chapters}
              views={views}
              focusedGameId={focused?.gameId}
              chapterTitle={chapterTitle}
              pct={pct}
            />
            <DraftMarkers
              chapters={chapters}
              views={views}
              heroIcon={heroIcon}
              markers={markers}
              pct={pct}
              onSeek={onSeek}
            />
            <StartFlags flags={flags} markers={markers} pct={pct} onSeek={onSeek} />
            <LoadoutMarks chapters={chapters} views={views} markers={markers} pct={pct} onSeek={onSeek} />
            <EventPills
              clusters={clusters}
              chapters={chapters}
              views={views}
              lookups={lookups}
              duration={duration}
              current={current}
              activeId={activeId}
              isDimmed={isDimmed}
              editingGameId={editing?.gameId}
              markers={markers}
              card={card}
              onCard={setCard}
              onSelect={onSelect}
              onOpen={onOpen}
            />
            <TrackReadouts
              current={current}
              chapters={chapters}
              drag={markers.drag}
              scrub={scrub}
              ticks={ticks}
              pct={pct}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
