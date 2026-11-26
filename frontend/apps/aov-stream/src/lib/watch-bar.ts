import { placeAt, toStory } from "./watch-place.ts"
import { LEADS, leadOf } from "./watch-rows.ts"
import type {
  Bar,
  BarCell,
  BarMark,
  BarRead,
  Chapter,
  MomentKind,
  Story,
  WatchTarget,
  WatchTeam,
} from "./watch-types.ts"

type BarOptions = { gap?: number; cut?: number; least?: number; chip?: number; blank?: number }

/** From this width of the track on a mark is wider. */
const WIDE = 1600
const markWidth = (track: number) => (track >= WIDE ? 3 : 2)

const isBlank = (chapter: Chapter) => !chapter.parts.length
const cutsIn = (chapter: Chapter, cut: number) => Math.max(0, chapter.parts.length - 1) * cut

/** The parts of a chapter side by side over `width` pixels, `cut` apart. */
function spread(chapter: Chapter, width: number, cut: number): BarCell["parts"] {
  const scale = Math.max(0, width - cutsIn(chapter, cut)) / (chapter.seconds || 1)
  let left = 0
  return chapter.parts.map((part) => {
    const at = { part, left, width: part.seconds * scale }
    left += at.width + cut
    return at
  })
}

/**
 * The chapters and their parts along a bar of `width` pixels. Where one of them would be too narrow, all but the
 * `current` one are folded to chips.
 */
export function barOf(
  story: Story,
  width: number,
  current: number,
  { gap = 14, cut = 4, least = 72, chip = 40, blank = 96 }: BarOptions = {},
): Bar {
  const { chapters } = story
  const told = chapters.filter((chapter) => !isBlank(chapter))
  const gaps = gap * Math.max(0, chapters.length - 1)
  const cuts = told.reduce((sum, chapter) => sum + cutsIn(chapter, cut), 0)
  const room = width - gaps - cuts - (chapters.length - told.length) * blank
  const unit = story.seconds ? room / story.seconds : 0
  const folded = told.some(({ seconds }) => seconds * unit < least)
  const narrow = (chapter: Chapter) => (isBlank(chapter) ? blank : chip)
  const others = chapters.filter(({ index }) => index !== current).reduce((sum, other) => sum + narrow(other), 0)
  const widthOf = (chapter: Chapter) => {
    if (folded) return chapter.index === current ? Math.max(0, width - gaps - others) : narrow(chapter)
    return isBlank(chapter) ? blank : chapter.seconds * unit + cutsIn(chapter, cut)
  }
  let left = 0
  const cells = chapters.map((chapter): BarCell => {
    const own = widthOf(chapter)
    const chipped = folded && chapter.index !== current && !isBlank(chapter)
    const cell = {
      chapter,
      left,
      width: own,
      mark: markWidth(width),
      parts: chipped ? [] : spread(chapter, own, cut),
      chip: chipped,
      blank: isBlank(chapter),
    }
    left += own + gap
    return cell
  })
  return { cells, width, unit, folded }
}

/** The staff of one game alone, across the whole width of a phone. */
export function staffOf(chapter: Chapter, width: number, cut = 3): BarCell {
  const parts = spread(chapter, width, cut)
  return { chapter, left: 0, width, mark: markWidth(width), parts, chip: false, blank: isBlank(chapter) }
}

/** Where a place of the video stands along the bar; `gap` where it is in a stretch that has no room on it. */
export function xOf(story: Story, bar: Bar, video: string, second: number): { x: number; gap: boolean } {
  const place = placeAt(story, video, second)
  const span = place.state === "SPAN" ? place.chapter.span : null
  const open = bar.cells.filter(({ chapter }) => span && chapter.video === video && chapter.span?.from === span.from)
  const [first, last] = [open[0], open.at(-1)]
  if (span && first && last) {
    const share = span.to == null ? 0.5 : (second - span.from) / (span.to - span.from)
    const left = first.left + 8
    return { x: left + share * (last.left + last.width - 8 - left), gap: true }
  }
  const { chapter, part, at, inside } = toStory(story, video, second)
  const index = bar.cells.findIndex((item) => item.chapter === chapter)
  const cell = bar.cells[index]
  if (!cell || !chapter || !part) return { x: -8, gap: true }
  if (cell.chip) return { x: cell.left + cell.width / 2, gap: !inside }
  const own = cell.parts.find((item) => item.part === part) ?? { left: 0, width: cell.width }
  const begins = cell.left + own.left
  if (inside) return { x: begins + ((at - part.at) / part.seconds) * own.width, gap: false }
  if (part !== chapter.parts.at(-1)) return { x: begins + own.width + 2, gap: true }
  const after = bar.cells[index + 1]
  const end = cell.left + cell.width
  return { x: after ? (end + after.left) / 2 : end + 8, gap: true }
}

const MARK_HEIGHTS: Record<BarMark["kind"], number> = {
  BAN: 5,
  PICK: 11,
  TURRET: 6,
  KILL: 4,
  NOTE: 6,
  OTHER: 6,
  ABYSSAL_DRAGON: 11,
  DARK_SLAYER: 16,
  BASE: 16,
}

/** Pixels between two marks of a lane where their part has room for them. */
const FREE = 1

/** Moves the marks of a lane apart, in their order and inside their part; each is `long` pixels wide. */
function spaced(marks: BarMark[], { left, width }: BarCell["parts"][number], long: number) {
  const room = Math.max(0, width - long)
  const apart = Math.min(long + FREE, room / Math.max(1, marks.length - 1))
  marks.forEach((mark, index) => {
    mark.x = Math.max(mark.x, index ? marks[index - 1].x + apart : left)
  })
  marks.forEach((mark, index) => {
    mark.x = Math.min(mark.x, left + room - (marks.length - 1 - index) * apart)
  })
}

/**
 * The marks of a cell: where each stands, how high it is, and whose. What the viewer has yet to come to tells that
 * something happens, not who did it.
 */
export function marksOf(cell: BarCell, reached: number): BarMark[] {
  const { chapter } = cell
  return cell.parts.flatMap((box) => {
    const { part, left, width } = box
    const marks: BarMark[] = []
    const add = (second: number | null, mark: Pick<BarMark, "team" | "kind" | "turn" | "moment">) => {
      if (second == null || second < part.from || second > part.to) return
      const at = part.at + second - part.from
      const x = left + ((second - part.from) / part.seconds) * width
      const ahead = at > reached
      marks.push({ ...mark, team: ahead ? null : mark.team, x, height: MARK_HEIGHTS[mark.kind], at, second, ahead })
    }
    if (part.kind === "DRAFT")
      for (const turn of chapter.turns) add(turn.second, { team: turn.team, kind: turn.kind, turn })
    if (part.kind === "PLAY")
      for (const moment of chapter.moments)
        for (let one = 0; one < moment.count; one++)
          add(moment.second, { team: moment.team, kind: moment.kind, moment })
    const lane = (team: WatchTeam | null) => marks.filter((mark) => !mark.ahead && mark.team === team)
    for (const own of [marks.filter(({ ahead }) => ahead), lane("A"), lane("B"), lane(null)])
      spaced(own, box, cell.mark)
    return marks
  })
}

/** How near a point of the bar a mark has to be to be meant by it. */
const NEAR = 6

/** What stands under a point of the bar: a cell, its part, the second there, and the mark near it. */
export function readAt(bar: Bar, x: number, reached: number): BarRead | null {
  const cell = bar.cells.find(({ left, width }) => x >= left && x <= left + width)
  if (!cell) return null
  if (cell.chip) return { cell, part: null, second: null, mark: null, x: cell.left + cell.width / 2 }
  const inner = x - cell.left
  const at = cell.parts.find(({ left, width }) => inner >= left && inner <= left + width)
  if (!at) return { cell, part: null, second: null, mark: null, x }
  const { part, left, width } = at
  let mark: BarMark | null = null
  for (const other of marksOf(cell, reached)) {
    const away = Math.abs(other.x - inner)
    if (away <= NEAR && (!mark || away < Math.abs(mark.x - inner))) mark = other
  }
  const second = part.from + (width ? (inner - left) / width : 0) * part.seconds
  return { cell, part, second, mark, x: mark ? cell.left + mark.x : x }
}

const isMoment = (kind: BarMark["kind"]): kind is MomentKind => kind !== "BAN" && kind !== "PICK"

/** Where a press on the bar plays from: a mark from a little before it, else exactly there. */
export function pressAt(read: BarRead | null): WatchTarget | null {
  const video = read?.cell.chapter.video
  if (!read || !video || read.second == null) return null
  const { mark, part, second } = read
  if (!mark) return { video, second }
  const lead = isMoment(mark.kind) ? leadOf(mark.kind) : LEADS.TURN
  return { video, second: Math.max(part?.from ?? 0, mark.second - lead) }
}
