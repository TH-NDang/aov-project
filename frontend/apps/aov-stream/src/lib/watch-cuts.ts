import type { Side } from "@aov/community-contracts"
import { gameToVideo } from "@aov/ui/lib/game-video"
import { toStory } from "./watch-place.ts"
import { leadIn, WATCH } from "./watch-story.ts"
import {
  timed,
  type Cut,
  type Cuts,
  type MomentKind,
  type Piece,
  type Story,
  type TimedChapter,
  type WatchMoment,
} from "./watch-types.ts"

/** Seconds of the short cut, chosen against 13,018 kills read from the videos of 849 games. */
export const QUICK = {
  /** The locked line-ups. */
  board: { before: 8, after: 4 },
  /** Towers of one side at most `gap` apart are a push. */
  push: { gap: 30, before: 30, after: 3, most: 60 },
  /** So many kills at most `gap` apart are a fight. */
  fight: { kills: 3, gap: 12, before: 8, after: 5 },
  note: { before: 10, after: 12 },
  /** Dragons, Slayers and the base from this second of the game on. */
  late: { from: 840, around: 15 },
  /** Until a game has so many pieces before its end, single towers before `single` fill it. */
  few: 2,
  single: 540,
  /** The end of a game; more of it where nothing else of the game is shown. */
  end: { before: 46, bare: 75, after: 6 },
  /** Pieces this close are joined; one piece lasts from `least` to `most`. */
  join: 10,
  least: 12,
  most: 90,
} as const

/** Seconds of a piece that stay at each edge of a pause cut out of it; what is left is dropped when it is shorter. */
const EDGE = 3
const REST = 4

const BIG = new Set<MomentKind>(["ABYSSAL_DRAGON", "DARK_SLAYER", "BASE"])

type Stretch = [from: number, to: number]
type Push = { side: Side; from: number; to: number; count: number }

/** Towers of one side, each soon after the one before, in seconds of the game. */
export function pushesOf(moments: WatchMoment[]): Push[] {
  const pushes: Push[] = []
  for (const side of ["BLUE", "RED"] as const) {
    let push: Push | null = null
    for (const { at, count, kind, side: own } of moments) {
      if (kind !== "TURRET" || own !== side) continue
      if (push && at - push.to <= QUICK.push.gap) {
        push.to = at
        push.count += count
      } else pushes.push((push = { side, from: at, to: at, count }))
    }
  }
  return pushes.sort((a, b) => a.from - b.from)
}

/** Kills soon after one another, enough of them to be a fight, in seconds of the game. */
function fightsOf(moments: WatchMoment[]): Stretch[] {
  const kills = moments.filter(({ kind }) => kind === "KILL").map(({ at }) => at)
  const fights: Stretch[] = []
  for (let first = 0, last = 0; first < kills.length; first = last = last + 1) {
    while (last + 1 < kills.length && kills[last + 1] - kills[last] <= QUICK.fight.gap) last++
    if (last - first + 1 >= QUICK.fight.kills) fights.push([kills[first], kills[last]])
  }
  return fights
}

function joined(pieces: Stretch[]): Stretch[] {
  const out: Stretch[] = []
  for (const [from, to] of [...pieces].sort((a, b) => a[0] - b[0])) {
    const last = out.at(-1)
    if (last && from - last[1] <= QUICK.join) last[1] = Math.max(last[1], to)
    else out.push([from, to])
  }
  return out
}

function withoutPauses(piece: Stretch, chapter: TimedChapter): Stretch[] {
  let parts = [piece]
  for (const pause of chapter.pauses) {
    if (pause.durationSeconds < WATCH.pause) continue
    const from = gameToVideo(chapter.zero, chapter.pauses, pause.atSeconds)
    const to = from + pause.durationSeconds
    parts = parts.flatMap(([a, b]): Stretch[] => {
      if (to <= a || from >= b) return [[a, b]]
      const left: Stretch[] = [
        [a, from + EDGE],
        [to - EDGE, b],
      ]
      return left.filter(([x, y]) => y - x > REST)
    })
  }
  return parts
}

/**
 * The short cut of one game in seconds of its video: the locked line-ups, the fights that were recorded or else the
 * pushes, what is taken late, and the end.
 */
export function quickOf(chapter: TimedChapter): Stretch[] {
  const { zero, pauses, moments, end, lock } = chapter
  const second = (at: number) => gameToVideo(zero, pauses, at)
  const within = (from: number, to: number): Stretch => [Math.max(zero, from), Math.min(end + QUICK.end.after, to)]
  const pushed = (push: Push) => {
    const from = second(push.from) - QUICK.push.before
    return within(from, Math.min(second(push.to) + QUICK.push.after, from + QUICK.push.most))
  }
  const fights = fightsOf(moments)
  const pushes = pushesOf(moments)
  const middle = fights.length
    ? fights.map(([from, to]) => within(second(from) - QUICK.fight.before, second(to) + QUICK.fight.after))
    : pushes.filter(({ count }) => count > 1).map(pushed)
  for (const { at, kind } of moments) {
    if (BIG.has(kind) && at >= QUICK.late.from)
      middle.push(within(second(at) - QUICK.late.around, second(at) + QUICK.late.around))
    if (kind === "NOTE") middle.push(within(second(at) - QUICK.note.before, second(at) + QUICK.note.after))
  }
  const beforeEnd = () => joined(middle.filter(([from]) => from < end - QUICK.end.before)).length
  for (const push of pushes.filter(({ count, from }) => count === 1 && from < QUICK.single).reverse()) {
    if (beforeEnd() >= QUICK.few) break
    middle.push(pushed(push))
  }
  const pieces = [...middle]
  if (lock != null) pieces.push([lock - QUICK.board.before, Math.min(zero, lock + QUICK.board.after)])
  pieces.push([Math.max(zero, end - (beforeEnd() ? QUICK.end.before : QUICK.end.bare)), end + QUICK.end.after])
  let before = chapter.from
  return joined(pieces.flatMap((piece) => withoutPauses(piece, chapter))).flatMap(([from, until]): Stretch[] => {
    const to = Math.min(chapter.to, until)
    const seconds = Math.min(QUICK.most, Math.max(QUICK.least, to - from))
    const begins = Math.max(before, to - seconds)
    before = to
    return to > begins ? [[begins, to]] : []
  })
}

const cut = (pieces: Piece[], offered: boolean): Cut => ({
  pieces,
  seconds: pieces.reduce((sum, { from, to }) => sum + to - from, 0),
  offered: pieces.length > 0 && offered,
})
const countOf = (after: "WAIT" | "PAUSE" | "BREAK" | null) => (after === "PAUSE" ? WATCH.countPause : WATCH.count)

/** The drafts and games of one chapter; what follows on without a gap is one piece. */
function wholeOf(chapter: TimedChapter, held: boolean): Piece[] {
  const { index, video } = chapter
  const pieces: Piece[] = []
  for (const { from, to, after } of chapter.parts) {
    const rest = { to, lead: countOf(after), hold: after === "BREAK" && held }
    const last = pieces.at(-1)
    if (last && from - last.to <= 1) Object.assign(last, rest)
    else pieces.push({ chapter: index, video, from, ...rest })
  }
  return pieces
}

function gamesOf({ index, video, zero, parts }: TimedChapter): Piece[] {
  return parts
    .filter(({ kind }) => kind === "PLAY")
    .map(({ from, to, after }, part) => ({
      chapter: index,
      video,
      from: part ? from : leadIn(zero),
      to,
      lead: countOf(after),
      hold: false,
    }))
}

/** The lengths a match can be watched in: its short cut, its games, and its drafts and games. */
export function cutsOf(story: Story): Cuts {
  const chapters = story.chapters.filter(timed)
  const missing = story.chapters.filter((chapter) => !timed(chapter)).map(({ number }) => number)
  const held = ({ video, to }: TimedChapter) =>
    story.chapters.some((other) => other.span && other.video === video && other.span.from === to)
  const quick = chapters.map((chapter) => ({ chapter, pieces: quickOf(chapter) }))
  const rich = quick.filter(({ chapter, pieces }) => pieces.length > (chapter.lock == null ? 1 : 2)).length
  const known = !missing.length
  return {
    whole: cut(
      chapters.flatMap((chapter) => wholeOf(chapter, held(chapter))),
      true,
    ),
    games: cut(chapters.flatMap(gamesOf), known && chapters.some(({ draftStart }) => draftStart != null)),
    quick: cut(
      quick.flatMap(({ chapter: { index, video }, pieces }) =>
        pieces.map(([from, to]) => ({ chapter: index, video, from, to, lead: 0, hold: false })),
      ),
      known && rich > 0 && rich * 2 >= chapters.length,
    ),
    missing,
  }
}

const chapterAt = (story: Story, video: string, second: number) => toStory(story, video, second).chapter?.index ?? -1

/** The seconds of a cut still to come from a place of the video. */
export function leftOf(cut: Cut, story: Story, video: string, second: number): number {
  const now = chapterAt(story, video, second)
  return cut.pieces.reduce((sum, piece) => {
    if (piece.video === video) return sum + Math.max(0, piece.to - Math.max(piece.from, second))
    return sum + (piece.chapter > now ? piece.to - piece.from : 0)
  }, 0)
}

/** The first piece after a place; a piece of another video comes by the order of the games. */
export function nextPiece(cut: Cut, story: Story, video: string, second: number): Piece | null {
  const now = chapterAt(story, video, second)
  return cut.pieces.find((piece) => (piece.video === video ? piece.from > second : piece.chapter > now)) ?? null
}
