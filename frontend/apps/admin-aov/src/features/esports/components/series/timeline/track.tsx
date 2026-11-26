import {
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { formatClock } from "@/lib/clock"
import type { BroadcastChapter } from "../../../model/broadcast-timeline"
import type { GameView } from "../../../model/game-view"
import { atVideo } from "../../../model/game-times"
import { phaseWords, placeAt } from "../../../model/playback-place"
import type { Playhead } from "../../../model/playhead"
import { chapterClock, type GameChapter } from "../../../model/series-vod"
import type { TimelineEvent } from "../../../model/timeline"
import type { TimingIssue } from "../../../model/timing-issues"
import {
  rowAt,
  trackRows,
  trackShape,
  type MarkSize,
  type TimelineRow,
  type TrackShape,
} from "../../../model/track-layout"
import { usePlayhead, usePlayheadValue } from "../../game/use-playhead"
import type { TimelineEditing } from "./match-timeline"
import { LaneHeads, TrackGround } from "./track-ground"
import { drawnMarks, TrackMarks, TrackRings, type DrawnMark, type Mark, type Point, type Ring } from "./track-marks"
import { spineHandles, TrackSpine, visibleHandles, type Handle, type Pct } from "./track-spine"
import { usePlanePress } from "./use-plane-press"
import type { Drag, Retime } from "./use-retime"
import { createStore, useStore, type Store, type TimelineView } from "./use-timeline-view"

const RECORDING_HINT =
  "Bấm để tua, bấm đúp vào dải của một đội để ghi, kéo mốc để đổi giây, Ctrl và lăn chuột để phóng."
const VIEWING_HINT = "Bấm để tua, Ctrl và lăn chuột để phóng."

/** Presses on a mark, a handle or a flag are theirs; everything else on the track seeks. */
const interactive = (target: EventTarget) =>
  !!(target as HTMLElement).closest("[data-marker], [data-edge], [data-chapter]")

/** The one line of the band: what the pointer or the focus is on, or where a dragged mark came from and would land. */
function BandLine({ line, moving, view }: { line: Store<Point | null>; moving: Point | null; view: TimelineView }) {
  const pointed = useStore(line)
  const { from, to } = useStore(view.shownNow)
  // What was pointed at may have left the view: the video turned a page, or the track was zoomed from its buttons.
  const point = moving ?? (pointed && pointed.second >= from && pointed.second <= to ? pointed : null)
  if (!point) return null
  const part = Math.min(1, Math.max(0, (point.second - from) / Math.max(1, to - from)))
  return (
    <span
      className="esp-band-line"
      data-moving={moving ? true : undefined}
      role={moving ? "status" : undefined}
      style={part <= 0.5 ? { left: `${part * 100}%` } : { right: `${(1 - part) * 100}%` }}
    >
      {point.text}
    </span>
  )
}

function PlayheadLine({ playhead, pct }: { playhead: Playhead; pct: Pct }) {
  return <span className="esp-now" aria-hidden="true" style={{ left: pct(usePlayhead(playhead)) }} />
}

/** The position slider of the video. It draws again each second; what stands on it does not. */
function Slider({ playhead, duration, ...props }: { playhead: Playhead; duration: number } & ComponentProps<"div">) {
  const second = usePlayheadValue(playhead, Math.round)
  return (
    <div
      {...props}
      className="esp-plane"
      role="slider"
      tabIndex={0}
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={second}
      aria-valuetext={formatClock(second)}
    />
  )
}

/** The shape of the marks in view; scrolling draws them again only where it changes. */
function useTrackShape(marks: Mark[], view: TimelineView, lane: number): TrackShape {
  const lanes = useMemo(
    () => ({ BLUE: marks.filter((mark) => mark.row === "BLUE"), RED: marks.filter((mark) => mark.row === "RED") }),
    [marks],
  )
  const shape = useSyncExternalStore(view.shownNow.subscribe, () => {
    const { size, used } = trackShape(lanes, view.pxPerSecond, lane, view.shownNow.get())
    return `${size} ${used.BLUE} ${used.RED}`
  })
  return useMemo(() => {
    const [size, BLUE, RED] = shape.split(" ").map(Number)
    return { size: size as MarkSize, used: { BLUE: BLUE!, RED: RED! } }
  }, [shape])
}

/** Where Tab stops: once in each lane and once on the spine, at what is nearest to the playhead. */
function useStops(playhead: Playhead, drawn: DrawnMark[], rings: Ring[], handles: Handle[]) {
  const rows = useMemo(() => {
    const on = (row: TimelineRow): { key: string; second: number }[] =>
      drawn.flatMap(({ mark }) => (mark.row === row ? mark : []))
    const lane = (side: "BLUE" | "RED") => [...on(side), ...rings.filter((ring) => ring.side === side)]
    return [lane("BLUE"), [...on("SPINE"), ...handles], lane("RED")]
  }, [drawn, rings, handles])
  const keys = usePlayheadValue(playhead, (second) =>
    rows
      .map((row) => {
        const away = (entry: { second: number }) => Math.abs(entry.second - second)
        return row.length ? row.reduce((near, entry) => (away(entry) < away(near) ? entry : near)).key : ""
      })
      .join(" "),
  )
  return useMemo(() => new Set(keys.split(" ")), [keys])
}

/** The words of a drag: both times on the clock the thing is stored on. */
function dragPoint(drag: Drag, names: Map<string, string>, chapters: GameChapter[]): Point {
  const chapter = chapters.find((candidate) => candidate.gameId === drag.target.gameId)
  const onGameClock = drag.target.kind === "event" || drag.target.kind === "mark"
  const time = (second: number) =>
    onGameClock && chapter ? formatClock(chapterClock(chapter, second)) : atVideo(second)
  return { second: drag.second, text: `${names.get(drag.key) ?? ""}: ${time(drag.from)} → ${time(drag.second)}` }
}

function hoverWords(chapters: GameChapter[], second: number) {
  const place = placeAt(chapters, second)
  if (place.kind === "between") return atVideo(second)
  return `${atVideo(second)}, ván ${place.chapter.number} ${phaseWords(place)}`
}

/** Up and down walk the marks of a row, those of one second too; left and right stay the video's. */
function walk(slider: HTMLElement, from: HTMLElement, step: 1 | -1) {
  const row = [...slider.querySelectorAll<HTMLElement>(`[data-walk="${from.dataset.walk}"]`)]
  row.sort((a, b) => Number(a.dataset.at) - Number(b.dataset.at))
  row[row.indexOf(from) + step]?.focus()
}

export function Track({
  playhead,
  duration,
  chapters,
  flags,
  marks,
  rings,
  views,
  focused,
  activeId,
  issues,
  label,
  foldable,
  editing,
  view,
  retime,
  secondAt,
  onSeek,
  onSelect,
}: {
  playhead: Playhead
  duration: number
  chapters: GameChapter[]
  flags: BroadcastChapter[]
  marks: Mark[]
  rings: Ring[]
  views: Record<string, GameView>
  focused: GameChapter | null
  activeId: string | null
  issues: TimingIssue[]
  label: string
  foldable: boolean
  editing: TimelineEditing | undefined
  view: TimelineView
  retime: Retime
  secondAt: (clientX: number) => number
  onSeek: (second: number) => void
  onSelect: (event: TimelineEvent) => void
}) {
  const hint = useId()
  const [unfolded, setUnfolded] = useState(false)
  const [line] = useState(() => createStore<Point | null>(null))
  const press = usePlanePress({ view, secondAt, onSeek })
  const { lane, top } = useMemo(() => trackRows(view.height), [view.height])
  const pct: Pct = (second) => `${Math.min(100, Math.max(0, (second / duration) * 100))}%`

  const { pxPerSecond } = view
  const shape = useTrackShape(marks, view, lane)
  const drawn = useMemo(() => drawnMarks(marks, shape, pxPerSecond, lane, top), [marks, shape, pxPerSecond, lane, top])
  const edges = useMemo(() => spineHandles(chapters, flags), [chapters, flags])
  const handles = visibleHandles(edges, retime, pxPerSecond)
  const stops = useStops(playhead, drawn, rings, handles)
  const names = useMemo(
    () => new Map([...marks, ...rings, ...edges].map(({ key, name }) => [key, name])),
    [marks, rings, edges],
  )
  const rowOf = (event: { clientY: number; currentTarget: HTMLElement }) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return rowAt(event.clientY - rect.top, rect.height)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (retime.pressed()) return line.set(null)
    const second = secondAt(event.clientX)
    if (!press.move(event, second) && (event.pointerType === "touch" || interactive(event.target))) return
    const clash = issues.find((issue) => second >= issue.from && second <= issue.to)
    line.set({ second, text: clash && rowOf(event) === "SPINE" ? clash.text : hoverWords(chapters, second) })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const mark = (event.target as HTMLElement).closest<HTMLElement>("[data-walk]")
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0
    const seconds = event.key === "ArrowRight" ? 5 : event.key === "ArrowLeft" ? -5 : 0
    if (!seconds && !(step && mark)) return
    event.preventDefault()
    event.stopPropagation()
    if (seconds) onSeek(Math.min(duration, Math.max(0, playhead.get() + seconds * (event.shiftKey ? 0.2 : 1))))
    else if (step && mark) walk(event.currentTarget, mark, step)
  }

  const open = !foldable || unfolded
  const shared = { pct, retime, isStop: (key: string) => stops.has(key), onSeek, onPoint: line.set }
  return (
    <div className="esp-track" style={{ "--lane": `${lane}px` } as CSSProperties}>
      {foldable && (
        <button type="button" className="esp-track-fold" aria-expanded={open} onClick={() => setUnfolded(!unfolded)}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {focused ? `Dòng thời gian ván ${focused.number}` : label}
        </button>
      )}
      {open && (
        <div className="esp-track-box">
          <LaneHeads view={focused ? views[focused.gameId] : undefined} />
          <div className="esp-track-area">
            <div ref={view.viewport} className="esp-track-viewport" data-timeline-viewport>
              <Slider
                ref={view.plane}
                playhead={playhead}
                duration={duration}
                aria-label={label}
                aria-describedby={hint}
                style={{ width: `calc(${view.zoom * 100}% - 28px)` }}
                onPointerDown={(event) => {
                  if (!interactive(event.target)) press.down(event)
                }}
                onPointerMove={onPointerMove}
                onPointerUp={(event) => press.up(event, view.pinching.current)}
                onPointerCancel={press.cancel}
                onPointerLeave={() => line.set(null)}
                onWheel={() => line.set(null)}
                onDoubleClick={(event) => {
                  if (editing?.canCreate && !interactive(event.target))
                    editing.onCreate(rowOf(event), press.doubled(event))
                }}
                onKeyDown={onKeyDown}
              >
                <TrackGround
                  chapters={chapters}
                  views={views}
                  focused={focused}
                  duration={duration}
                  view={view}
                  pct={pct}
                  top={top}
                />
                <TrackSpine
                  {...shared}
                  top={top.SPINE}
                  chapters={chapters}
                  handles={handles}
                  issues={issues}
                  playhead={playhead}
                />
                <TrackRings {...shared} top={top} lane={lane} rings={rings} />
                <TrackMarks {...shared} drawn={drawn} playhead={playhead} activeId={activeId} onSelect={onSelect} />
                <PlayheadLine playhead={playhead} pct={pct} />
              </Slider>
            </div>
            <BandLine line={line} moving={retime.drag && dragPoint(retime.drag, names, chapters)} view={view} />
          </div>
        </div>
      )}
      <p id={hint} className="sr-only">
        {editing ? RECORDING_HINT : VIEWING_HINT}
      </p>
    </div>
  )
}
