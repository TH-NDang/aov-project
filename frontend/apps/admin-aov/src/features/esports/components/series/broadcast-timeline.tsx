import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import type { Selection } from "@aov/community-contracts"
import {
  Ban,
  Crosshair,
  Flag,
  Gem,
  Lock,
  Maximize2,
  Minimize2,
  MousePointerClick,
  Play,
  Plus,
  Shield,
  ShieldBan,
  Swords,
  Target,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@aov/ui/components/hover-card"
import {
  defaultSpan,
  retimeRange,
  spanLabel,
  timelineSpans,
  type BroadcastChapter,
  type RetimeTarget,
} from "../../model/broadcast-timeline"
import type { GameView } from "../../model/game-view"
import { MARK_LABELS, type MarkPart } from "../../model/observation-marks"
import { chapterAt, chapterClock, chapterVideo, sourceOf, type GameChapter } from "../../model/series-vod"
import { clusterEvents, eventSide, leadEvent, type EventCluster, type TimelineEvent } from "../../model/timeline"
import { formatClock } from "../../model/vod"
import { ClusterCard, clusterTitle, type ItemLookups } from "../game/cluster-card"
import { describeEvent } from "../game/event-text"
import { MarkerPill } from "../game/marker-pill"
import { HeroIcon, TeamLogo, TimeTag, VIDEO_MARK } from "../primitives"

/** Pill width in pixels; markers closer than this on screen merge into one cluster per row. */
const PILL_PX = 76
/** Row centres inside the detail track (px): blue kills/items, objectives and notes, red kills/items. */
const ROW_TOP = { BLUE: 48, MID: 84, RED: 120 } as const
/** A press that travels less than this is a click, so a marker is never moved by an unsteady hand. */
const DRAG_PX = 5
/** While a marker is dragged the video is asked to seek no more often than this, in milliseconds. */
const FOLLOW_MS = 140
/** Marks of one team taken at the same second sit this many pixels apart instead of on top of each other. */
const MARK_STEP_PX = 15
const MARK_ICONS: Record<MarkPart, typeof Zap> = { spell: Zap, enchantments: Shield, arcana: Gem, equipment: Swords }

/** The three rows of the detail track; a moment recorded from a row starts as what that row holds. */
export type TimelineRow = keyof typeof ROW_TOP

/** What the track may change, present only while an editor with write access is recording. */
export type TimelineEditing = {
  /** Game whose markers may be moved: the page saves through this game only. */
  gameId: string
  /** False until the game has gone live; moments cannot be recorded before that. */
  canCreate: boolean
  /** Records a moment in a row: at a video second when one was pointed at, otherwise at the playhead. */
  onCreate: (row: TimelineRow, second?: number) => void
  /** Moves one marker to another video second, already inside the range it is allowed in. */
  onRetime: (target: RetimeTarget, second: number) => void
}

type Range = { min: number; max: number }
type Press = {
  x: number
  moved: boolean
  key: string
  target: RetimeTarget
  from: number
  range: Range
  /** Where the video was when the press began, to return to if the drag is cancelled. */
  back: number
}

function tickStep(duration: number, width: number) {
  const target = duration / Math.max(2, Math.floor(width / 85))
  return [30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400].find((step) => step >= target) ?? 28800
}

const rowOf = (event: TimelineEvent) =>
  event.kind === "OBJECTIVE" || event.kind === "NOTE" ? "MID" : (eventSide(event) ?? "MID")

const keyOf = (target: RetimeTarget) =>
  target.kind === "event"
    ? `event:${target.gameId}|${target.id}`
    : target.kind === "turn"
      ? `turn:${target.gameId}|${target.order}`
      : target.kind === "mark"
        ? `mark:${target.gameId}|${target.side}|${target.part}|${target.at}`
        : `${target.kind}:${target.gameId}`

const within = (second: number, range: Range) => Math.min(range.max, Math.max(range.min, Math.round(second)))

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
  // How much video the track shows at once. Null until the editor picks a span: the track then follows the focused
  // game, so a twelve-hour broadcast opens on the game being recorded instead of needing several zoom steps.
  const [span, setSpan] = useState<number | null>(null)
  const here = chapterAt(chapters, current)
  const focused = chapters.find((chapter) => chapter.gameId === focusedGameId) ?? here
  const spans = timelineSpans(duration)
  const shown = span ?? defaultSpan(duration, focused)
  const zoom = duration / shown
  const [width, setWidth] = useState(800)
  const [scroll, setScroll] = useState({ left: 0, visible: 1 })
  const [scrub, setScrub] = useState<number | null>(null)
  const pointer = useRef<{ x: number; drag: boolean } | null>(null)
  const [drag, setDrag] = useState<{ key: string; from: number; second: number } | null>(null)
  // Where a dropped marker waits until the saved game comes back, so it does not jump to its old place meanwhile.
  const [settled, setSettled] = useState<{ key: string; second: number } | null>(null)
  const press = useRef<Press | null>(null)
  const skipClick = useRef(false)
  const [card, setCard] = useState<string | null>(null)
  const seekVideo = useRef(onSeek)
  seekVideo.current = onSeek
  const follow = useRef<{ last: number; timer: number | null; second: number }>({ last: 0, timer: null, second: 0 })
  useEffect(() => {
    const state = follow.current
    return () => {
      if (state.timer != null) window.clearTimeout(state.timer)
    }
  }, [])
  /** Seeks the video to a dragged position: at once when `now`, otherwise a few times a second at most. */
  const followVideo = (second: number, now = false) => {
    const state = follow.current
    state.second = second
    if (state.timer != null) {
      if (!now) return
      window.clearTimeout(state.timer)
      state.timer = null
    }
    const run = () => {
      state.timer = null
      state.last = Date.now()
      seekVideo.current(state.second)
    }
    const wait = now ? 0 : FOLLOW_MS - (Date.now() - state.last)
    if (wait <= 0) run()
    else state.timer = window.setTimeout(run, wait)
  }

  useEffect(() => {
    const element = track.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width || 800))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const scrollTo = (second: number, behavior: ScrollBehavior = "auto") => {
    const element = viewport.current
    if (!element) return
    const position = (second / duration) * (track.current?.clientWidth ?? 0)
    element.scrollTo?.({ left: position - element.clientWidth / 2, behavior })
  }
  // Keep the playhead in view after jumps and when the scale changes.
  const previous = useRef(current)
  useEffect(() => {
    const jumped = Math.abs(current - previous.current) > 2
    previous.current = current
    const element = viewport.current
    // The video follows a drag; scrolling the track under the pointer would pull the marker away from it.
    if (!jumped || !element || press.current?.moved) return
    const position = (current / duration) * (track.current?.clientWidth ?? 0)
    if (position < element.scrollLeft || position > element.scrollLeft + element.clientWidth) scrollTo(current)
  }, [current, duration])
  // Keyed on the span, not the scale: the player corrects the video length by a second once it starts, which must
  // not move the track.
  useEffect(() => scrollTo(current), [shown])
  // While the span follows the focused game, a change of game brings that whole game into view.
  const following = span === null
  const focusedId = focused?.gameId
  const focusedMiddle = focused ? (focused.from + focused.end) / 2 : null
  useEffect(() => {
    if (following && focusedMiddle !== null) scrollTo(focusedMiddle)
    // The middle is read when the game or the mode changes, not each time the game's length is corrected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [following, focusedId])

  // The saved game has arrived (or the save failed): the marker shows what is stored again.
  useEffect(() => setSettled(null), [events, chapters])
  useEffect(() => {
    if (!settled) return
    const timer = window.setTimeout(() => setSettled(null), 4000)
    return () => window.clearTimeout(timer)
  }, [settled])

  const mergeWindow = Math.max(3, (PILL_PX / width) * duration)
  const clusters = useMemo(() => clusterEvents(events, mergeWindow, rowOf), [events, mergeWindow])
  const step = tickStep(duration, width)
  const ticks = Array.from({ length: Math.floor(duration / step) + 1 }, (_, index) => index * step)
  if (ticks.at(-1) !== duration) {
    if (ticks.length > 1 && duration - ticks[ticks.length - 1] < step * 0.5) ticks.pop()
    ticks.push(duration)
  }
  const pct = (second: number) => `${Math.min(100, Math.max(0, (second / duration) * 100))}%`
  const sides = focused ? views[focused.gameId]?.sides : undefined

  /** Back to the span chosen for the focused game, with that game in the middle. */
  const fitChapter = (chapter: GameChapter) => {
    setSpan(null)
    window.requestAnimationFrame?.(() => scrollTo((chapter.from + chapter.end) / 2))
  }

  const secondAt = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect()
    return Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration)
  }
  const rowAt = (clientY: number): TimelineRow => {
    const y = clientY - track.current!.getBoundingClientRect().top
    return y < (ROW_TOP.BLUE + ROW_TOP.MID) / 2 ? "BLUE" : y < (ROW_TOP.MID + ROW_TOP.RED) / 2 ? "MID" : "RED"
  }
  const interactive = (target: EventTarget) => !!(target as HTMLElement).closest("[data-marker], [data-chapter]")
  // Mouse seeks and drags immediately; touch seeks on tap so swiping still scrolls the zoomed track.
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactive(event.target)) return
    skipClick.current = false
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
    if (interactive(event.target) || press.current) return setScrub(null)
    const second = secondAt(event.clientX)
    setScrub(second)
    if (pointer.current?.drag) onSeek(second)
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointer.current
    pointer.current = null
    if (start && !start.drag && Math.abs(event.clientX - start.x) < 8) onSeek(secondAt(event.clientX))
  }

  /** Range a marker may be dragged in, or null when it stays where it is (read-only, or another game's marker). */
  const movable = (target: RetimeTarget) => {
    if (!editing || target.gameId !== editing.gameId) return null
    const index = chapters.findIndex((candidate) => candidate.gameId === target.gameId)
    const chapter = chapters[index]
    if (!chapter) return null
    // Games without a position in this video are only placed for reading order and bound nothing.
    return retimeRange(chapter, target, duration, {
      previousEnd:
        chapters
          .slice(0, index)
          .reverse()
          .find((candidate) => candidate.synced)?.end ?? null,
      nextFrom: chapters.slice(index + 1).find((candidate) => candidate.synced)?.from ?? null,
    })
  }
  const shownAt = (key: string, at: number) =>
    drag?.key === key ? drag.second : settled?.key === key ? settled.second : at
  const retime = (key: string, target: RetimeTarget, from: number, second: number) => {
    if (second === Math.round(from)) return
    setSettled({ key, second })
    editing?.onRetime(target, second)
  }
  // The drag is followed on the window, so it survives leaving the marker and the track.
  const startPress = (event: ReactPointerEvent<HTMLElement>, target: RetimeTarget, from: number) => {
    skipClick.current = false
    const range = movable(target)
    if (!range || (event.button ?? 0) !== 0) return
    press.current = { x: event.clientX, moved: false, key: keyOf(target), target, from, range, back: current }
    const move = (moved: PointerEvent) => {
      const state = press.current
      if (!state || (!state.moved && Math.abs(moved.clientX - state.x) < DRAG_PX)) return
      state.moved = true
      setCard(null)
      const second = within(secondAt(moved.clientX), state.range)
      setDrag({ key: state.key, from: state.from, second })
      followVideo(second)
    }
    const release = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", drop)
      window.removeEventListener("pointercancel", cancel)
      press.current = null
      setDrag(null)
    }
    const cancel = () => {
      const state = press.current
      release()
      if (state?.moved) followVideo(state.back, true)
    }
    const drop = (dropped: PointerEvent) => {
      const state = press.current
      release()
      if (!state?.moved) return
      // The click that ends a drag must not select the marker or seek to its old second; the next press clears it.
      skipClick.current = true
      const second = within(secondAt(dropped.clientX), state.range)
      followVideo(second, true)
      retime(state.key, state.target, state.from, second)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", drop)
    window.addEventListener("pointercancel", cancel)
  }
  /** Alt + arrows move a focused marker by one second (Shift: five), for editors who do not drag. */
  const nudge = (event: ReactKeyboardEvent<HTMLElement>, target: RetimeTarget, from: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    const range = event.altKey && delta ? movable(target) : null
    if (!range) return
    event.preventDefault()
    event.stopPropagation()
    const second = within(from + delta * (event.shiftKey ? 5 : 1), range)
    followVideo(second, true)
    retime(keyOf(target), target, from, second)
  }
  const clicked = (run: () => void) => () => {
    if (skipClick.current) {
      skipClick.current = false
      return
    }
    run()
  }

  const dragged = drag ? (chapterAt(chapters, drag.second) ?? null) : null
  const hint = !editing
    ? "Bấm vào thanh để tua · bấm một mốc để xem chi tiết"
    : editing.canCreate
      ? `Bấm để tua · bấm đúp vào một dải hoặc nút + để ghi tại đó · kéo mốc hoặc mép vùng cấm chọn của ván ${focused?.number ?? ""} để đổi giây, video tua theo`
      : "Bấm để tua · kéo lượt hoặc mép vùng cấm chọn để đổi giây, video tua theo · vào trận rồi mới ghi được sự kiện"
  const lanes: { row: TimelineRow; name: string; add: string }[] = [
    {
      row: "BLUE",
      name: sides?.BLUE.team.shortName ?? "Đội xanh",
      add: `Ghi hạ gục của ${sides?.BLUE.team.name ?? "đội xanh"} tại vị trí video hiện tại`,
    },
    { row: "MID", name: "Mục tiêu", add: "Ghi mục tiêu hoặc khoảnh khắc tại vị trí video hiện tại" },
    {
      row: "RED",
      name: sides?.RED.team.shortName ?? "Đội đỏ",
      add: `Ghi hạ gục của ${sides?.RED.team.name ?? "đội đỏ"} tại vị trí video hiện tại`,
    },
  ]

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="mr-auto flex items-center gap-2 text-muted-foreground">
          <TimeTag kind="video" seconds={current} className="font-semibold text-foreground" />
          {here ? (
            <span>
              Ván {here.number} <TimeTag kind="game" seconds={chapterClock(here, current)} />
            </span>
          ) : (
            <span>Ngoài ván đấu</span>
          )}
        </span>
        {focused && (
          <button type="button" className="esp-bt-button" onClick={() => fitChapter(focused)}>
            <Crosshair size={13} /> Vừa ván {focused.number}
          </button>
        )}
        <button type="button" className="esp-bt-button" onClick={() => setSpan(duration)}>
          <Minimize2 size={13} /> Toàn video
        </button>
        <span className="flex items-center rounded-md border">
          <button
            type="button"
            className="p-1.5 hover:bg-muted disabled:opacity-40"
            aria-label="Thu nhỏ timeline"
            title="Xem khoảng dài hơn"
            disabled={shown >= duration}
            onClick={() => setSpan(spans.find((value) => value > shown) ?? duration)}
          >
            <ZoomOut size={14} />
          </button>
          <span
            className="esp-num min-w-16 px-1 text-center"
            aria-label="Phạm vi đang xem"
            title={
              following
                ? "Khoảng video thanh đang hiện, tự chọn vừa với ván đang xem"
                : "Khoảng video thanh đang hiện. “Vừa ván” đưa về khoảng tự chọn"
            }
          >
            {spanLabel(shown, duration)}
          </span>
          <button
            type="button"
            className="p-1.5 hover:bg-muted disabled:opacity-40"
            aria-label="Phóng to timeline"
            title="Xem khoảng ngắn hơn"
            disabled={shown <= spans[0]!}
            onClick={() => setSpan([...spans].reverse().find((value) => value < shown) ?? spans[0]!)}
          >
            <ZoomIn size={14} />
          </button>
        </span>
      </div>

      <div
        className="flex min-h-7 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
        data-timeline-hint
      >
        {notice ?? (
          <span className="flex items-center gap-1.5">
            <MousePointerClick size={13} aria-hidden="true" className="shrink-0" /> {hint}
          </span>
        )}
        <span className="ml-auto hidden items-center gap-3 @2xl:flex" aria-hidden="true">
          <span className="flex items-center gap-1">
            <span className="esp-bt-key" data-key="turn" /> lượt cấm, chọn
          </span>
          <span className="flex items-center gap-1">
            <span className="esp-bt-key" data-key="lock">
              <Lock size={8} strokeWidth={2.6} />
            </span>
            chốt đội hình
          </span>
          <span className="flex items-center gap-1">
            <span className="esp-bt-key" data-key="flag">
              <Flag size={8} strokeWidth={2.6} />
            </span>
            vào trận
          </span>
          <span className="flex items-center gap-1">
            <span className="esp-bt-key" data-key="mark">
              <Shield size={8} strokeWidth={2.6} />
            </span>
            video hiện phù hiệu, ngọc, trang bị
          </span>
          <span className="flex items-center gap-1">
            <span className="esp-bt-key" data-key="pill" /> sự kiện
          </span>
        </span>
      </div>

      <div className="esp-bt-frame">
        <span className="esp-bt-lane-title">Cả video</span>
        {/* Overview: the whole video, games as chapters, the zoomed window and the playhead. */}
        <div
          className="esp-bt-overview"
          aria-hidden="true"
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const second = Math.round(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * duration)
            onSeek(second)
            scrollTo(second, "smooth")
          }}
        >
          {chapters.map((chapter) =>
            chapter.draft ? (
              <span
                key={`draft-${chapter.gameId}`}
                className="esp-bt-overview-draft"
                style={{ left: pct(chapter.draft.start), width: pct(chapter.start - chapter.draft.start) }}
              />
            ) : null,
          )}
          {chapters.map((chapter) => (
            <span
              key={chapter.gameId}
              className="esp-bt-overview-chapter"
              data-focused={chapter.gameId === focused?.gameId || undefined}
              data-synced={chapter.synced || undefined}
              style={{ left: pct(chapter.start), width: `calc(${pct(chapter.end - chapter.start)} + 1px)` }}
            >
              V{chapter.number}
            </span>
          ))}
          {events.map((event) =>
            event.kind === "KILL" || event.kind === "OBJECTIVE" ? (
              <span
                key={event.id}
                className="esp-bt-overview-tick"
                data-side={eventSide(event) ?? undefined}
                data-kind={event.kind}
                style={{ left: pct(event.at) }}
              />
            ) : null,
          )}
          {zoom > 1 && (
            <span
              className="esp-bt-overview-window"
              style={{ left: `${scroll.left * 100}%`, width: `${scroll.visible * 100}%` }}
            />
          )}
          <span className="esp-bt-overview-playhead" style={{ left: pct(current) }} />
        </div>

        {/* What each row holds; while recording, the plus records a moment of that row at the playhead. */}
        <div className="esp-bt-lanes" data-timeline-lanes>
          {lanes.map((lane) => (
            <div
              key={lane.row}
              className="esp-bt-lane"
              data-side={lane.row === "MID" ? undefined : lane.row}
              data-row={lane.row}
              title={lane.row === "MID" ? "Mục tiêu lớn và khoảnh khắc" : `Hạ gục và trang bị · ${lane.name}`}
            >
              {lane.row === "MID" ? (
                <Target size={15} className="shrink-0 text-[var(--esp-gold-text)]" aria-hidden="true" />
              ) : (
                sides && <TeamLogo team={sides[lane.row].team} size={18} />
              )}
              <span className="hidden min-w-0 flex-1 truncate @2xl:block">{lane.name}</span>
              {editing && (
                <button
                  type="button"
                  className="esp-bt-add"
                  data-add={lane.row}
                  disabled={!editing.canCreate}
                  aria-label={lane.add}
                  title={editing.canCreate ? lane.add : "Vào trận rồi mới ghi được sự kiện"}
                  onClick={() => editing.onCreate(lane.row)}
                >
                  <Plus size={13} strokeWidth={2.6} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div
          ref={viewport}
          className="overflow-x-auto pt-5 pb-1"
          data-timeline-viewport
          onScroll={(event) => {
            const element = event.currentTarget
            setScroll({
              left: element.scrollLeft / Math.max(1, element.scrollWidth),
              visible: element.clientWidth / Math.max(1, element.scrollWidth),
            })
          }}
        >
          <div
            ref={track}
            className="esp-bt-track"
            style={{ width: `calc(${zoom * 100}% - 28px)` }}
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
            <div className="esp-bt-row" data-side="BLUE" aria-hidden="true" />
            <div className="esp-bt-row" data-row="MID" aria-hidden="true" />
            <div className="esp-bt-row" data-side="RED" aria-hidden="true" />
            {ticks.map((tick) => (
              <span key={`grid-${tick}`} className="esp-bt-grid" style={{ left: pct(tick) }} aria-hidden="true" />
            ))}

            {chapters.map((chapter) => {
              const view = views[chapter.gameId]
              return (
                <div
                  key={chapter.gameId}
                  className="esp-bt-band"
                  data-focused={chapter.gameId === focused?.gameId || undefined}
                  data-synced={chapter.synced || undefined}
                  style={{ left: pct(chapter.start), width: pct(chapter.end - chapter.start) }}
                >
                  <span
                    className="esp-bt-band-label"
                    title={chapter.synced ? undefined : "Chưa căn vị trí trong video"}
                  >
                    <strong>Ván {chapter.number}</strong>
                    <span className="esp-num opacity-70" title="Thời lượng ván">
                      ⏱ {formatClock(chapter.duration)}
                    </span>
                    <span className="truncate opacity-80">{chapterTitle(chapter)}</span>
                  </span>
                  {view &&
                    (["BLUE", "RED"] as const).map((side) => (
                      <span
                        key={side}
                        className="esp-bt-band-team"
                        data-side={side}
                        style={{ top: ROW_TOP[side] }}
                        title={view.sides[side].team.name}
                      >
                        <TeamLogo team={view.sides[side].team} size={16} />
                      </span>
                    ))}
                </div>
              )
            })}

            {chapters.map((chapter) => {
              const draft = chapter.draft
              const view = views[chapter.gameId]
              if (!draft) return null
              const startTarget: RetimeTarget = { kind: "draftStart", gameId: chapter.gameId }
              const lockTarget: RetimeTarget = { kind: "draftLock", gameId: chapter.gameId }
              const startKey = keyOf(startTarget)
              const lockKey = keyOf(lockTarget)
              const zoneStart = shownAt(startKey, draft.start)
              const zoneEnd = shownAt(keyOf({ kind: "gameStart", gameId: chapter.gameId }), chapter.start)
              const canMoveStart = !!movable(startTarget)
              const canMoveLock = !!movable(lockTarget)
              // Turns belong to teams, not players: teammates still swap heroes until the lock.
              return (
                <div key={`draft-${chapter.gameId}`} className="contents">
                  <div
                    className="esp-bt-draft"
                    data-live={chapter.live || undefined}
                    style={{ left: pct(zoneStart), width: pct(Math.max(0, zoneEnd - zoneStart)) }}
                    aria-hidden="true"
                  >
                    <span className="esp-bt-draft-label">Cấm chọn · V{chapter.number}</span>
                  </div>
                  <button
                    type="button"
                    data-marker
                    data-edge="draftStart"
                    data-movable={canMoveStart || undefined}
                    data-dragging={drag?.key === startKey || undefined}
                    className="esp-bt-edge"
                    style={{ left: pct(zoneStart) }}
                    aria-label={`Bắt đầu cấm chọn ván ${chapter.number} · ${formatClock(draft.start)}`}
                    aria-keyshortcuts={canMoveStart ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}
                    title={`Bắt đầu cấm chọn ván ${chapter.number} · ${VIDEO_MARK} ${formatClock(draft.start)}${canMoveStart ? " · kéo để đổi giây" : ""}`}
                    onPointerDown={(event) => startPress(event, startTarget, draft.start)}
                    onKeyDown={(event) => nudge(event, startTarget, draft.start)}
                    onClick={clicked(() => onSeek(draft.start))}
                  >
                    <ShieldBan size={11} strokeWidth={2.4} />
                  </button>
                  {draft.turns.map((turn) => {
                    if (turn.atSecond == null || !turn.hero) return null
                    const target: RetimeTarget = { kind: "turn", gameId: chapter.gameId, order: turn.order }
                    const key = keyOf(target)
                    const canMove = !!movable(target)
                    const team = view?.sides[turn.side].team
                    const what = `Lượt ${turn.order} · ${turn.kind === "BAN" ? "Cấm" : "Chọn"} · ${team?.shortName ?? ""} · ${turn.hero.name ?? ""}`
                    return (
                      <button
                        key={turn.order}
                        type="button"
                        data-marker
                        data-side={turn.side}
                        data-kind={turn.kind}
                        data-movable={canMove || undefined}
                        data-dragging={drag?.key === key || undefined}
                        className="esp-bt-turn"
                        style={{ left: pct(shownAt(key, turn.atSecond)), top: ROW_TOP[turn.side] }}
                        aria-label={`Ván ${chapter.number} · lượt ${turn.order} · ${turn.kind === "BAN" ? "cấm" : "chọn"} · ${team?.name ?? ""} · ${turn.hero.name ?? ""} · ${formatClock(turn.atSecond)}`}
                        aria-keyshortcuts={canMove ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}
                        title={canMove ? `${what} · kéo để đổi giây` : what}
                        // The hero picture would otherwise start the browser's own image drag and cancel the pointer.
                        onDragStart={(event) => event.preventDefault()}
                        onPointerDown={(event) => startPress(event, target, turn.atSecond!)}
                        onKeyDown={(event) => nudge(event, target, turn.atSecond!)}
                        onClick={clicked(() => onSeek(turn.atSecond!))}
                      >
                        <HeroIcon
                          hero={{ id: turn.hero.id, name: turn.hero.name ?? "", iconUrl: heroIcon?.(turn.hero) }}
                          size={22}
                          title=""
                          className="rounded-md"
                        />
                        {turn.kind === "BAN" && (
                          <span className="esp-bt-turn-ban">
                            <Ban size={8} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                  {draft.locked != null && (
                    <button
                      type="button"
                      data-marker
                      data-edge="draftLock"
                      data-chapter={`lock-${chapter.gameId}`}
                      data-movable={canMoveLock || undefined}
                      data-dragging={drag?.key === lockKey || undefined}
                      className="esp-bt-lock"
                      style={{ left: pct(shownAt(lockKey, draft.locked)) }}
                      aria-label={`Chốt đội hình ván ${chapter.number} · ${formatClock(draft.locked)}`}
                      aria-keyshortcuts={canMoveLock ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}
                      title={`Chốt đội hình ván ${chapter.number} · ${VIDEO_MARK} ${formatClock(draft.locked)}${canMoveLock ? " · kéo để đổi giây" : ""}`}
                      onPointerDown={(event) => startPress(event, lockTarget, draft.locked!)}
                      onKeyDown={(event) => nudge(event, lockTarget, draft.locked!)}
                      onClick={clicked(() => onSeek(draft.locked!))}
                    >
                      <Lock size={10} strokeWidth={2.6} />
                    </button>
                  )}
                </div>
              )
            })}

            {flags.map((flag) => {
              const target: RetimeTarget = { kind: "gameStart", gameId: flag.id }
              const key = keyOf(target)
              const canMove = !!movable(target)
              return (
                <button
                  key={flag.id}
                  type="button"
                  data-marker
                  data-edge="gameStart"
                  data-chapter={flag.id}
                  data-movable={canMove || undefined}
                  data-dragging={drag?.key === key || undefined}
                  className="esp-bt-flag"
                  style={{ left: pct(shownAt(key, flag.at)) }}
                  title={`${flag.label} · ${formatClock(flag.at)}${canMove ? " · kéo để đổi giây, sự kiện của ván dời theo" : ""}`}
                  aria-label={`${flag.label} · ${formatClock(flag.at)}`}
                  aria-keyshortcuts={canMove ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}
                  onPointerDown={(event) => startPress(event, target, flag.at)}
                  onKeyDown={(event) => nudge(event, target, flag.at)}
                  onClick={clicked(() => onSeek(flag.at))}
                >
                  <Flag size={10} strokeWidth={2.6} />
                </button>
              )
            })}

            {chapters.map((chapter) => {
              const view = views[chapter.gameId]
              if (!chapter.live || !view) return null
              const marks = chapter.marks ?? []
              return marks.map((mark, index) => {
                const target: RetimeTarget = {
                  kind: "mark",
                  gameId: chapter.gameId,
                  side: mark.side,
                  part: mark.part,
                  at: mark.at,
                }
                const key = keyOf(target)
                const canMove = !!movable(target)
                const at = chapterVideo(chapter, mark.at)
                const team = view.sides[mark.side]
                const players = mark.lanes.flatMap(
                  (lane) => team.seats.find((seat) => seat.lane === lane)?.playerName ?? [],
                )
                const who = mark.lanes.length >= team.seats.length ? "cả đội" : players.join(", ")
                const what = `Video hiện ${MARK_LABELS[mark.part]} · ${team.team.shortName} · ${who}`
                const beside = marks
                  .slice(0, index)
                  .filter((other) => other.side === mark.side && other.at === mark.at).length
                const Icon = MARK_ICONS[mark.part]
                return (
                  <button
                    key={key}
                    type="button"
                    data-marker
                    data-mark={mark.part}
                    data-side={mark.side}
                    data-movable={canMove || undefined}
                    data-dragging={drag?.key === key || undefined}
                    className="esp-bt-mark"
                    style={{ left: pct(shownAt(key, at)), marginLeft: beside * MARK_STEP_PX }}
                    aria-label={`Ván ${chapter.number} · ${what} · ${formatClock(mark.at)}`}
                    aria-keyshortcuts={canMove ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}
                    title={`${what} · ⏱ ${formatClock(mark.at)}${canMove ? " · kéo để đổi giây" : ""}`}
                    onPointerDown={(event) => startPress(event, target, at)}
                    onKeyDown={(event) => nudge(event, target, at)}
                    onClick={clicked(() => onSeek(at))}
                  >
                    <Icon size={9} strokeWidth={2.6} />
                  </button>
                )
              })
            })}

            {clusters.map((cluster) => {
              const lead = leadEvent(cluster)
              const source = sourceOf(cluster.id)
              const view = views[source.gameId]
              if (!view) return null
              const title = clusterTitle(cluster)
              const text = describeEvent(lead, view)
              // Several moments drawn as one pill have no single second to move; zooming in separates them.
              const only = cluster.events.length === 1 ? sourceOf(cluster.events[0].id) : null
              const target: RetimeTarget | null = only ? { kind: "event", gameId: only.gameId, id: only.id } : null
              const key = target ? keyOf(target) : cluster.id
              const canMove = !!target && !!movable(target)
              const left = (shownAt(key, cluster.start) / duration) * 100
              return (
                <HoverCard
                  key={cluster.id}
                  openDelay={80}
                  closeDelay={120}
                  open={card === cluster.id && !drag}
                  onOpenChange={(open) => setCard((shown) => (open ? cluster.id : shown === cluster.id ? null : shown))}
                >
                  <HoverCardTrigger asChild>
                    <button
                      type="button"
                      data-marker
                      className="esp-pill"
                      data-at={cluster.start}
                      data-side={cluster.side ?? undefined}
                      data-kind={lead.kind}
                      data-active={cluster.events.some((event) => event.id === activeId)}
                      data-dim={cluster.events.every(isDimmed)}
                      data-past={cluster.start <= current}
                      data-movable={canMove || undefined}
                      data-dragging={drag?.key === key || undefined}
                      style={{
                        left: `clamp(${PILL_PX / 2}px, ${left}%, calc(100% - ${PILL_PX / 2}px))`,
                        top: ROW_TOP[cluster.lane as keyof typeof ROW_TOP] ?? ROW_TOP.MID,
                      }}
                      aria-label={`${formatClock(cluster.start)} · ${title ?? `${text.title}: ${text.detail}`}`}
                      aria-keyshortcuts={canMove ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}
                      onDragStart={(event) => event.preventDefault()}
                      onPointerDown={(event) => target && startPress(event, target, cluster.start)}
                      onKeyDown={(event) => target && nudge(event, target, cluster.start)}
                      onClick={clicked(() => onSelect(cluster.events[0]))}
                    >
                      <MarkerPill cluster={cluster} game={view} lookups={lookups} />
                      {cluster.events.length > 1 && <span className="esp-marker-count">{cluster.events.length}</span>}
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent
                    side={cluster.lane === "RED" ? "bottom" : "top"}
                    className="w-[400px] max-w-[calc(100vw-2rem)] p-3"
                  >
                    <ClusterCard
                      cluster={cluster}
                      game={view}
                      lookups={lookups}
                      activeId={activeId}
                      onSelect={onSelect}
                      videoTime={(event) => event.at}
                      clock={(event) => {
                        const chapter = chapterAt(chapters, event.at)
                        return chapter ? chapterClock(chapter, event.at) : event.at
                      }}
                      size={28}
                      footer={
                        <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                          <button
                            type="button"
                            className="inline-flex h-7 items-center gap-1 rounded-md bg-foreground px-2.5 text-xs font-medium text-background"
                            onClick={() => onSelect(cluster.events[0])}
                          >
                            <Play size={12} /> Tới mốc này
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
                            onClick={() => onOpen(cluster)}
                          >
                            <Maximize2 size={12} /> Xem chi tiết
                          </button>
                          {editing && source.gameId === editing.gameId && (
                            <span className="text-xs text-muted-foreground">
                              {canMove ? "Kéo mốc để đổi giây" : "Phóng to để kéo từng mốc"}
                            </span>
                          )}
                        </div>
                      }
                    />
                  </HoverCardContent>
                </HoverCard>
              )
            })}

            <div className="esp-bt-playhead" style={{ left: pct(current) }}>
              <span className="esp-num">
                {here
                  ? `V${here.number} ⏱ ${formatClock(chapterClock(here, current))}`
                  : `${VIDEO_MARK} ${formatClock(current)}`}
              </span>
            </div>
            {drag ? (
              <span className="esp-bt-scrub esp-num" data-moving style={{ left: pct(drag.second) }} role="status">
                {VIDEO_MARK} {formatClock(drag.from)} → {formatClock(drag.second)}
                {dragged?.live &&
                  drag.second >= dragged.start &&
                  ` · V${dragged.number} ⏱ ${formatClock(chapterClock(dragged, drag.second))}`}
              </span>
            ) : (
              scrub !== null && (
                <span className="esp-bt-scrub esp-num" style={{ left: pct(scrub) }}>
                  {VIDEO_MARK} {formatClock(scrub)}
                  {chapterAt(chapters, scrub) &&
                    ` · V${chapterAt(chapters, scrub)!.number} ⏱ ${formatClock(chapterClock(chapterAt(chapters, scrub)!, scrub))}`}
                </span>
              )
            )}
            <div className="esp-track-ticks esp-num" aria-hidden="true">
              {ticks.map((tick) => (
                <span key={tick} style={{ left: pct(tick) }}>
                  {formatClock(tick)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
