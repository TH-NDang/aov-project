import { formatClock } from "@/lib/clock"
import { chapterVideo, type GameChapter } from "./series-vod"

/**
 * Where things stand on the track: its rows, the marks of a lane on as many lines as the lane has room for, and its
 * ticks. From the top: a band with the names of the phases, the blue lane, the spine, the red lane, the ticks.
 */
export type TimelineRow = "BLUE" | "SPINE" | "RED"

const BAND = 20
export const SPINE_HEIGHT = 16
const TICKS = 18
const LANE_MAX = 96

export function trackRows(height: number): { lane: number; top: Record<TimelineRow, number> } {
  const lane = Math.min(LANE_MAX, Math.max(0, (height - BAND - SPINE_HEIGHT - TICKS) / 2))
  return { lane, top: { BLUE: BAND, SPINE: BAND + lane, RED: BAND + lane + SPINE_HEIGHT } }
}

export function rowAt(y: number, height: number): TimelineRow {
  const { top } = trackRows(height)
  return y < top.SPINE ? "BLUE" : y < top.RED ? "SPINE" : "RED"
}

export type LaneMark = { key: string; second: number }
export type MarkSize = 26 | 22 | 20
/** `x` is the mark's true place, `push` how far right of it it is drawn, `merged` the marks it stands for as well. */
export type PlacedMark = { key: string; x: number; push: number; line: number; merged: string[] }
export type Lane = { size: MarkSize; used: number; marks: PlacedMark[] }

const SIZES: readonly MarkSize[] = [26, 22, 20]
const GAP = 2
/** A push up to here is not noticed; a smaller size is tried before a larger one. */
const QUIET_PUSH = 8

const linesOf = (size: number, laneHeight: number) => Math.max(1, Math.floor((laneHeight + GAP) / (size + GAP)))

function place(marks: LaneMark[], pxPerSecond: number, laneHeight: number, size: MarkSize) {
  const ends: number[] = Array(linesOf(size, laneHeight)).fill(Number.NEGATIVE_INFINITY)
  const last: (PlacedMark | undefined)[] = []
  const placed: PlacedMark[] = []
  let merged = 0
  let push = 0
  for (const mark of [...marks].sort((a, b) => a.second - b.second)) {
    const x = mark.second * pxPerSecond
    const left = x - size / 2
    const free = ends.findIndex((end) => end <= left)
    const line = free >= 0 ? free : ends.indexOf(Math.min(...ends))
    const shift = free >= 0 ? 0 : ends[line]! - left
    const before = last[line]
    if (shift > size / 2 && before) {
      before.merged.push(mark.key)
      merged++
      continue
    }
    const entry: PlacedMark = { key: mark.key, x, push: shift, line, merged: [] }
    ends[line] = left + shift + size + GAP
    last[line] = entry
    push = Math.max(push, shift)
    placed.push(entry)
  }
  const used = placed.reduce((most, mark) => Math.max(most, mark.line + 1), 0)
  return { lane: { size, used, marks: placed }, merged, push }
}

/**
 * The marks of one lane. The largest size that merges nothing and pushes nothing noticeably is taken, otherwise the one
 * that merges fewest. A mark takes the first line that is free at its left edge, else the line that frees first, pushed
 * right by at most half a mark; what does not fit even there is merged into the mark before it on that line.
 */
export function layoutLane(
  marks: LaneMark[],
  pxPerSecond: number,
  laneHeight: number,
  sizes: readonly MarkSize[] = SIZES,
): Lane {
  let best: ReturnType<typeof place> | null = null
  for (const size of sizes) {
    const tried = place(marks, pxPerSecond, laneHeight, size)
    if (tried.merged === 0 && tried.push <= QUIET_PUSH) return tried.lane
    const fewer = !best || tried.merged < best.merged
    const closer = !!best && tried.merged === best.merged && best.push > QUIET_PUSH && tried.push < best.push
    if (fewer || closer) best = tried
  }
  return best!.lane
}

/** The size both lanes share, and how many lines of each are in use, for the marks between two seconds. */
export type TrackShape = { size: MarkSize; used: Record<"BLUE" | "RED", number> }

/**
 * The shape of the track for the marks in view: the smaller of the sizes that suit the two lanes. The whole broadcast
 * would force the smallest size and every line everywhere.
 */
export function trackShape(
  lanes: Record<"BLUE" | "RED", LaneMark[]>,
  pxPerSecond: number,
  laneHeight: number,
  shown: { from: number; to: number },
): TrackShape {
  const inView = (mark: LaneMark) => mark.second >= shown.from && mark.second <= shown.to
  const sizeOf = (marks: LaneMark[]) => layoutLane(marks.filter(inView), pxPerSecond, laneHeight).size
  const size = Math.min(sizeOf(lanes.BLUE), sizeOf(lanes.RED)) as MarkSize
  const usedBy = (marks: LaneMark[]) => {
    const seen = new Set(marks.filter(inView).map((mark) => mark.key))
    return layoutLane(marks, pxPerSecond, laneHeight, [size]).marks.reduce(
      (most, mark) => (seen.has(mark.key) ? Math.max(most, mark.line + 1) : most),
      1,
    )
  }
  return { size, used: { BLUE: usedBy(lanes.BLUE), RED: usedBy(lanes.RED) } }
}

/** Middle of a mark's line under the top of its lane; the lines in use stand in the middle of the lane. */
export function lineMiddle(line: number, used: number, size: number, laneHeight: number) {
  const height = used * (size + GAP) - GAP
  return (laneHeight - height) / 2 + line * (size + GAP) + size / 2
}

/** A tick names the game clock inside a game being played and the video time elsewhere, so the two are never mixed. */
export type Tick = { second: number; text: string; clock: "game" | "video" }

const TICK_STEPS = [30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400]
const TICK_PX = 80
/** The last tick ends where the video does, so it needs its whole width before it. */
const LAST_TICK_PX = 90

/** Ticks between two seconds of the video; the last one is the length of the video. */
export function trackTicks(
  chapters: GameChapter[],
  duration: number,
  pxPerSecond: number,
  from: number,
  to: number,
): Tick[] {
  const step = TICK_STEPS.find((candidate) => candidate * pxPerSecond >= TICK_PX) ?? 28800
  const placed = chapters.filter((chapter) => chapter.synced).sort((a, b) => a.from - b.from)
  const games = placed.flatMap((chapter, index) => {
    if (!chapter.live) return []
    // A game without its end lasts to the next one.
    const next = placed[index + 1]?.from ?? duration
    const end = chapter.ended ? chapter.end : Math.max(chapter.end, next)
    // Where a game is shorter than a step its clock would name nothing but 0:00.
    return end - chapter.start >= step ? [{ chapter, start: chapter.start, end }] : []
  })
  const ticks: Tick[] = []
  for (const { chapter, start, end } of games) {
    if (end < from || start > to) continue
    for (let clock = 0; ; clock += step) {
      const second = chapterVideo(chapter, clock)
      if (second > Math.min(end, to) || (chapter.ended && clock > chapter.duration)) break
      if (second >= from) ticks.push({ second, text: formatClock(clock), clock: "game" })
    }
  }
  const edges = games.flatMap(({ start, end }) => [start, end])
  const clear = (second: number) =>
    !games.some(({ start, end }) => second >= start && second <= end) &&
    edges.every((edge) => Math.abs(edge - second) >= step / 2)
  for (let second = Math.max(0, Math.ceil(from / step) * step); second <= Math.min(to, duration); second += step)
    if (clear(second) && (duration - second) * pxPerSecond >= LAST_TICK_PX)
      ticks.push({ second, text: formatClock(second), clock: "video" })
  if (duration <= to && clear(duration)) ticks.push({ second: duration, text: formatClock(duration), clock: "video" })
  return ticks.sort((a, b) => a.second - b.second)
}
