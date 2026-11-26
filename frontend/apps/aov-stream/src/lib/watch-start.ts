import { clock } from "./tournament-model.ts"
import { leftOf } from "./watch-cuts.ts"
import { firstOf } from "./watch-follow.ts"
import { resumeOf, type WatchStop } from "./watch-memory.ts"
import { placeAt } from "./watch-place.ts"
import type { WatchView } from "./watch-store.ts"
import { gameAlone } from "./watch-story.ts"
import type { KeptLength, Place, WatchLength, WatchMatch, WatchTarget } from "./watch-types.ts"
import { lengthWords, placeWords, videoClock, type Say } from "./watch-words.ts"

/** `seconds`: the real length it takes, where every game is timed. `playing`: how long the games lasted together. */
type FromStart = {
  kind: "WATCH" | "AGAIN" | "RESTART" | "VIDEO"
  target: WatchTarget
  length: KeptLength
  seconds: number | null
  games: number
  playing: number | null
}
export type StartAction =
  | FromStart
  | { kind: "QUICK"; target: WatchTarget; length: "quick"; seconds: number }
  | { kind: "RESUME"; target: WatchTarget; length: WatchLength; place: Place; left: number | null }
  | { kind: "SHARED"; target: WatchTarget; length: KeptLength; place: Place }
  | { kind: "LIVE"; target: WatchTarget; length: "all" }
  | { kind: "BACK" }

/** What the head of a match offers: the one thing to do, and beside it at most one other. */
export function startActions(
  match: WatchMatch | null,
  now: {
    stop: WatchStop | null
    open: boolean
    shrunk: boolean
    address: WatchTarget | null
    length: KeptLength
  },
): StartAction[] {
  if (!match || match.story.level === "NONE") return []
  if (now.open) return now.shrunk ? [{ kind: "BACK" }] : []
  const { story, cuts } = match
  const length: KeptLength = now.length === "all" || cuts[now.length].offered ? now.length : "whole"
  const first = firstOf(story, cuts, length)
  // Without a second a live stream plays its live edge.
  if (match.live && story.level !== "TIMED")
    return [{ kind: "LIVE", target: { video: story.videos.at(-1)!, second: 0 }, length: "all" }]
  if (!first) return []

  const known = story.level === "TIMED" && !cuts.missing.length
  const fromStart = (kind: FromStart["kind"]): FromStart => ({
    kind,
    target: first,
    length,
    seconds: known && length !== "all" ? cuts[length].seconds : null,
    games: story.chapters.length,
    playing: story.chapters.reduce<number | null>(
      (sum, chapter) => (sum != null && chapter.length ? sum + chapter.length : null),
      0,
    ),
  })
  if (now.address) {
    const place = placeAt(story, now.address.video, now.address.second)
    return [{ kind: "SHARED", target: now.address, length, place }, fromStart("RESTART")]
  }
  const resume = resumeOf(match, now.stop)
  if (resume) {
    const { video, second } = resume
    const cut = resume.length === "all" ? null : cuts[resume.length]
    const left = known && cut?.offered ? leftOf(cut, story, video, second) : null
    const place = placeAt(story, video, second)
    return [{ kind: "RESUME", target: { video, second }, length: resume.length, place, left }, fromStart("RESTART")]
  }
  const main = fromStart(now.stop?.done ? "AGAIN" : story.level === "PLAIN" ? "VIDEO" : "WATCH")
  const quick = cuts.quick.offered ? firstOf(story, cuts, "quick") : null
  return quick ? [main, { kind: "QUICK", target: quick, length: "quick", seconds: cuts.quick.seconds }] : [main]
}

/**
 * What plays on a page that was opened to be watched: the match that is open goes on, one that is asked for in a length
 * begins in it, and otherwise it is the first thing its head offers. Null where there is nothing to play.
 */
export function openingOf(
  match: WatchMatch,
  now: {
    view: Pick<WatchView, "match" | "player" | "video" | "second" | "length">
    stop: WatchStop | null
    address: WatchTarget | null
    /** The length that was asked for, and the one chosen last. */
    asked: WatchLength | undefined
    kept: KeptLength
  },
): { target: WatchTarget; length: WatchLength } | null {
  const { view, stop, address, asked, kept } = now
  const { player, video, second } = view
  if (!address && video && view.match?.seriesId === match.seriesId && player !== "CLOSED")
    return { target: { video, second }, length: view.length }
  const [first] = startActions(match, { stop, open: false, shrunk: false, address, length: kept })
  if (!first || first.kind === "BACK") return null
  // What is on now is joined, in whatever length the match before it was watched.
  if (asked && !address && first.kind !== "LIVE" && (asked === "all" || match.cuts[asked].offered)) {
    const target = firstOf(match.story, match.cuts, asked)
    if (target) return { target, length: asked }
  }
  return { target: first.target, length: first.length }
}

/** How many games there are, and how long they lasted together where that is known. */
function gamesWords({ games, playing }: FromStart, text: Say, compact: boolean): string {
  if (!games) return ""
  const count = text(`${games} ván`, `${games} ${games === 1 ? "game" : "games"}`)
  if (compact || !playing) return count
  const length = lengthWords(playing, text)
  return text(`${count}, ${length} thi đấu`, `${count}, ${length} of play`)
}

function fromStartWords(action: FromStart, match: WatchMatch, text: Say, compact: boolean): string {
  if (match.story.level !== "TIMED" || action.kind === "VIDEO") return gamesWords(action, text, compact)
  if (action.length === "all")
    return compact
      ? text("nguyên video", "the full video")
      : text("nguyên video, cả giờ nghỉ", "the full video with its breaks")
  if (action.seconds == null) return gamesWords(action, text, compact)
  const words = lengthWords(action.seconds, text)
  if (compact) return words
  return action.length === "games"
    ? text(`${words}, chỉ ván đấu`, `${words}, games only`)
    : text(`${words}, bỏ giờ nghỉ`, `${words} without breaks`)
}

/** Where in a game the video goes on. */
function atWords(place: Place, second: number, text: Say): string {
  switch (place.state) {
    case "PLAY":
    case "PAUSE":
      return text(`lúc ${clock(place.clock)}`, `at ${clock(place.clock)}`)
    case "WAIT":
      return text("lúc vào trận", "as the game starts")
    case "DRAFT":
    case "BEFORE":
      return text("lúc cấm chọn", "at the draft")
    default:
      return text(`từ ${videoClock(second)} của video`, `from ${videoClock(second)} of the video`)
  }
}

/** The game a target leads into: that of its place, or the only one its video shows; none between two games. */
function gameAt(place: Place, target: WatchTarget, { story: { chapters } }: WatchMatch): number | null {
  if (place.state === "BREAK" || place.state === "AFTER") return null
  if (place.state === "SPAN") {
    const named = chapters.find(({ number }) => number === target.game)
    return (named?.span?.from === place.chapter.span?.from ? named : place.chapter)?.number ?? null
  }
  return (place.chapter ?? place.next ?? gameAlone(chapters, target.video))?.number ?? null
}

/** The two lines of an action. */
export function startWords(
  action: StartAction,
  match: WatchMatch,
  text: Say,
  compact: boolean,
  view: WatchView,
): { title: string; line: string } {
  switch (action.kind) {
    case "WATCH":
      return { title: text("Xem cả trận", "Watch the match"), line: fromStartWords(action, match, text, compact) }
    case "VIDEO":
      return { title: text("Xem video", "Watch the video"), line: fromStartWords(action, match, text, compact) }
    case "AGAIN":
      return { title: text("Xem lại", "Watch again"), line: fromStartWords(action, match, text, compact) }
    case "RESTART":
      return compact
        ? { title: text("Từ đầu", "From start"), line: "" }
        : { title: text("Xem từ đầu", "From the start"), line: fromStartWords(action, match, text, false) }
    case "QUICK": {
      const words = lengthWords(action.seconds, text)
      const line = compact ? words : text(`${words} phá trụ và đoạn kết`, `${words} of pushes and endings`)
      return { title: text("Xem nhanh", "Quick watch"), line }
    }
    case "LIVE":
      return { title: text("Xem trực tiếp", "Watch live"), line: text("Đang diễn ra", "On now") }
    case "BACK": {
      const words = placeWords(view, text, false)
      const line = words.charAt(0).toLocaleLowerCase("vi-VN") + words.slice(1)
      return { title: text("Về phòng xem", "Back to the room"), line }
    }
    case "SHARED": {
      const number = gameAt(action.place, action.target, match)
      const title = number
        ? text(`Xem từ ván ${number}`, `Watch from game ${number}`)
        : text("Xem từ đây", "Watch from here")
      return { title, line: atWords(action.place, action.target.second, text) }
    }
    case "RESUME": {
      const number = gameAt(action.place, action.target, match)
      const title = number ? text(`Xem tiếp ván ${number}`, `Resume game ${number}`) : text("Xem tiếp", "Resume")
      const at = atWords(action.place, action.target.second, text)
      if (action.left == null || compact) return { title, line: at }
      const left = lengthWords(action.left, text)
      return { title, line: text(`${at}, còn ${left}`, `${at}, ${left} left`) }
    }
  }
}
