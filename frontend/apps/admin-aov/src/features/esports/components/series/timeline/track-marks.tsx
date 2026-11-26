import {
  useMemo,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react"
import type { DraftKind, Selection, Side } from "@aov/community-contracts"
import { Skull, Sparkles, Swords } from "lucide-react"
import { formatClock } from "@/lib/clock"
import type { RetimeTarget } from "../../../model/broadcast-timeline"
import { atVideo } from "../../../model/game-times"
import type { GameView } from "../../../model/game-view"
import type { ItemLookups } from "../../../model/item-lookups"
import { MARK_LABELS } from "../../../model/observation-marks"
import type { Playhead } from "../../../model/playhead"
import { momentName } from "../../../model/quick-moment"
import { chapterClock, chapterVideo, sourceOf, type GameChapter } from "../../../model/series-vod"
import { eventSide, type TimelineEvent, type TimelineKind } from "../../../model/timeline"
import { layoutLane, lineMiddle, SPINE_HEIGHT, type TimelineRow, type TrackShape } from "../../../model/track-layout"
import { describeEvent, seatLookup } from "../../game/event-text"
import { ObjectiveIcon } from "../../game/objective-icon"
import { usePlayheadValue } from "../../game/use-playhead"
import { HeroIcon, ItemSlot } from "../../primitives"
import type { Pct } from "./track-spine"
import { keyOf, type Retime } from "./use-retime"

/** Marks of one team taken at the same second sit this many pixels apart instead of on top of each other. */
const RING_STEP = 15
/** Middle of a ring inside the outer edge of its lane. */
const RING_INSET = 7
const LANES = ["BLUE", "RED"] as const

/** What the band says while something on the track is pointed at. */
export type Point = { second: number; text: string }

/** A moment or a turn as it stands on the track. */
export type Mark = {
  key: string
  row: TimelineRow
  second: number
  kind: TimelineKind | DraftKind
  side: Side | null
  target: RetimeTarget
  /** The moment; a turn has none. */
  event: TimelineEvent | null
  /** Name for screen readers. */
  label: string
  /** The same in the band, and the time that stands after it. */
  name: string
  time: string
  art: (size: number) => ReactNode
}

/** When a broadcast showed a part of a team's loadouts. */
export type Ring = Pick<Mark, "key" | "second" | "target" | "label" | "name" | "time"> & {
  side: Side
  part: string
  beside: number
  /** Who the ring stands for, without its second: moved with the keys it stays the same button and keeps the focus. */
  id: string
}

const sentence = (text: string) => text.charAt(0).toLocaleUpperCase("vi") + text.slice(1)

function eventArt(event: TimelineEvent, view: GameView, lookups: ItemLookups, size: number) {
  const seat = seatLookup(view)
  switch (event.kind) {
    case "OBJECTIVE":
      return <ObjectiveIcon objective={event.objective} size={size} />
    case "KILL": {
      const killer = seat(event.killer)
      const Badge = killer ? Swords : Skull
      return (
        <>
          <HeroIcon hero={(killer ?? seat(event.victim))?.hero} size={size} title="" className="rounded-full" />
          <span className="esp-mark-badge">
            <Badge size={9} strokeWidth={2.6} />
          </span>
        </>
      )
    }
    case "ITEM": {
      const icon = event.item ? lookups.itemIcon(event.item) : null
      return <ItemSlot item={event.item ?? null} iconUrl={icon} index={event.slot - 1} size={size} />
    }
    case "NOTE":
      return <Sparkles size={size * 0.55} />
  }
}

/** Every mark of the lanes and the spine in time order. */
export function trackMarks({
  chapters,
  events,
  views,
  lookups,
  heroIcon,
}: {
  chapters: GameChapter[]
  events: TimelineEvent[]
  views: Record<string, GameView>
  lookups: ItemLookups
  heroIcon?: (hero: Selection) => string | null | undefined
}): Mark[] {
  const moments = events.flatMap((event): Mark[] => {
    const { gameId, id } = sourceOf(event.id)
    const view = views[gameId]
    if (!view) return []
    const chapter = chapters.find((candidate) => candidate.gameId === gameId)
    const clock = formatClock(chapter ? chapterClock(chapter, event.at) : event.at)
    const text = describeEvent(event, view)
    const side = eventSide(event)
    const target: RetimeTarget = { kind: "event", gameId, id }
    return [
      {
        key: keyOf(target),
        row: side ?? "SPINE",
        second: event.at,
        kind: event.kind,
        side,
        target,
        event,
        label: `${clock}, ${text.title}: ${text.detail}`,
        name: sentence(momentName(event, view)),
        time: clock,
        art: (size) => eventArt(event, view, lookups, size),
      },
    ]
  })
  // Turns belong to teams, not players: teammates still swap heroes until the lock.
  const turns = chapters.flatMap((chapter) =>
    (chapter.draft?.turns ?? []).flatMap((turn): Mark[] => {
      const { hero, atSecond, side } = turn
      if (atSecond == null || !hero || (!hero.id && !hero.name)) return []
      const team = views[chapter.gameId]?.sides[side].team.shortName
      const name = `lượt ${turn.order}, ${team ? `${team} ` : ""}${turn.kind === "BAN" ? "cấm" : "chọn"} ${hero.name ?? ""}`
      const target: RetimeTarget = { kind: "turn", gameId: chapter.gameId, order: turn.order }
      const icon = { id: hero.id, name: hero.name ?? "", iconUrl: heroIcon?.(hero) }
      return [
        {
          key: keyOf(target),
          row: side,
          second: atSecond,
          kind: turn.kind,
          side,
          target,
          event: null,
          label: `Ván ${chapter.number}, ${name}, ${atVideo(atSecond)}`,
          name: sentence(name),
          time: atVideo(atSecond),
          art: (size) => <HeroIcon hero={icon} size={size} title="" className="rounded-md" />,
        },
      ]
    }),
  )
  return [...moments, ...turns].sort((a, b) => a.second - b.second)
}

/** Every moment a broadcast showed loadouts, of the games whose 0:00 is known. */
export function trackRings(chapters: GameChapter[], views: Record<string, GameView>): Ring[] {
  return chapters.flatMap((chapter) => {
    const view = views[chapter.gameId]
    const marks = chapter.marks ?? []
    if (!chapter.live || !view) return []
    return marks.map((mark, index): Ring => {
      const { side, part, at } = mark
      const { team, seats } = view.sides[side]
      const players = mark.lanes.flatMap((lane) => seats.find((seat) => seat.lane === lane)?.playerName ?? [])
      const who = mark.lanes.length >= seats.length ? "cả đội" : players.join(", ")
      const name = `video hiện ${MARK_LABELS[part]} của ${team.shortName}, ${who}`
      const target: RetimeTarget = { kind: "mark", gameId: chapter.gameId, side, part, at }
      const lanes = mark.lanes.join(",")
      // A player's equipment is shown at several seconds; the earlier ones of the same players tell them apart.
      const earlier = marks
        .slice(0, index)
        .filter((other) => other.side === side && other.part === part && other.lanes.join(",") === lanes).length
      return {
        key: keyOf(target),
        id: `${chapter.gameId}|${side}|${part}|${lanes}|${earlier}`,
        side,
        part,
        second: chapterVideo(chapter, at),
        beside: marks.slice(0, index).filter((other) => other.side === side && other.at === at).length,
        target,
        label: `Ván ${chapter.number}, ${name}, ${formatClock(at)}`,
        name: sentence(name),
        time: formatClock(at),
      }
    })
  })
}

/** A mark in its place: `push` is how far right of its second it is drawn, `merged` what it stands for as well. */
export type DrawnMark = { mark: Mark; push: number; merged: Mark[]; size: number; y: number }

/** The marks of both lanes, on as many lines as a lane holds, and on the spine those that belong to no team. */
export function drawnMarks(
  marks: Mark[],
  shape: TrackShape,
  pxPerSecond: number,
  lane: number,
  top: Record<TimelineRow, number>,
): DrawnMark[] {
  const byKey = new Map(marks.map((mark) => [mark.key, mark]))
  const { size, used } = shape
  const onLanes = LANES.flatMap((row) => {
    const own = marks.filter((mark) => mark.row === row)
    return layoutLane(own, pxPerSecond, lane, [size]).marks.map(({ key, push, line, merged }): DrawnMark => {
      const y = top[row] + lineMiddle(line, used[row], size, lane)
      return { mark: byKey.get(key)!, push, merged: merged.map((held) => byKey.get(held)!), size, y }
    })
  })
  const onSpine = marks.filter((mark) => mark.row === "SPINE")
  const y = top.SPINE + SPINE_HEIGHT / 2
  return [...onLanes, ...onSpine.map((mark) => ({ mark, push: 0, merged: [], size: SPINE_HEIGHT, y }))]
}

type Shared = {
  pct: Pct
  retime: Retime
  /** Whether a mark is the one of its row that Tab stops at. */
  isStop: (key: string) => boolean
  onSeek: (second: number) => void
  onPoint: (point: Point | null) => void
}

/** What every mark of the track does: dragged and nudged where it may move, named in the band while pointed at. */
function markProps(
  mark: Pick<Mark, "key" | "second" | "target" | "label" | "name" | "time">,
  row: TimelineRow,
  others: number,
  press: () => void,
  { retime, isStop, onPoint }: Shared,
) {
  const more = others > 0 ? `, và ${others} mốc nữa` : ""
  // Several marks drawn as one have no single second to move; a shorter stretch of video separates them.
  const movable = !others && !!retime.movable(mark.target)
  const point = () =>
    onPoint({ second: retime.shownAt(mark.key, mark.second), text: `${mark.name} ${mark.time}${more}` })
  return {
    type: "button" as const,
    "data-marker": true,
    "data-walk": row,
    "data-at": mark.second,
    "data-movable": movable || undefined,
    "data-dragging": retime.drag?.key === mark.key || undefined,
    tabIndex: isStop(mark.key) ? 0 : -1,
    "aria-label": mark.label + more,
    "aria-keyshortcuts": movable ? "Alt+ArrowLeft Alt+ArrowRight" : undefined,
    onPointerEnter: point,
    onPointerLeave: () => onPoint(null),
    onFocus: point,
    onBlur: () => onPoint(null),
    // A picture would otherwise start the browser's own image drag and cancel the pointer.
    onDragStart: (event: DragEvent) => event.preventDefault(),
    onPointerDown: (event: PointerEvent<HTMLElement>) =>
      retime.startPress(event, movable ? mark.target : null, mark.second),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => movable && retime.nudge(event, mark.target, mark.second),
    onClick: retime.clicked(press),
  }
}

export function TrackMarks({
  drawn,
  playhead,
  activeId,
  onSelect,
  ...shared
}: Shared & {
  drawn: DrawnMark[]
  playhead: Playhead
  activeId: string | null
  onSelect: (event: TimelineEvent) => void
}) {
  const { pct, retime } = shared
  const seconds = useMemo(() => drawn.map(({ mark }) => mark.second).sort((a, b) => a - b), [drawn])
  // The last second passed stands for all before it, so the marks are drawn again only when one more is passed.
  const passed = usePlayheadValue(playhead, (second) => seconds.filter((at) => at <= second).at(-1) ?? -1)
  return drawn.map(({ mark, push, merged, size, y }) => {
    const { key, event } = mark
    const at = retime.shownAt(key, mark.second)
    const x = push && !retime.isMoved(key) ? `calc(${pct(at)} + ${push.toFixed(1)}px)` : pct(at)
    const active = activeId !== null && [mark, ...merged].some((held) => held.event?.id === activeId)
    const press = () => (event ? onSelect(event) : shared.onSeek(mark.second))
    return (
      <button
        key={key}
        {...markProps(mark, mark.row, merged.length, press, shared)}
        className="esp-mark"
        data-side={mark.side ?? undefined}
        data-kind={mark.kind}
        data-active={active || undefined}
        data-past={mark.second <= passed}
        style={{ "--s": `${size}px`, left: x, top: y } as CSSProperties}
      >
        {mark.art(size)}
        {merged.length > 0 && <span className="esp-mark-count">{merged.length + 1}</span>}
      </button>
    )
  })
}

export function TrackRings({
  rings,
  top,
  lane,
  ...shared
}: Shared & { rings: Ring[]; top: Record<TimelineRow, number>; lane: number }) {
  const { pct, retime } = shared
  return rings.map((ring) => (
    <button
      key={ring.id}
      {...markProps(ring, ring.side, 0, () => shared.onSeek(ring.second), shared)}
      className="esp-ring"
      data-mark={ring.part}
      data-side={ring.side}
      style={{
        left: pct(retime.shownAt(ring.key, ring.second)),
        top: ring.side === "BLUE" ? top.BLUE + RING_INSET : top.RED + lane - RING_INSET,
        marginLeft: ring.beside * RING_STEP,
      }}
    />
  ))
}
