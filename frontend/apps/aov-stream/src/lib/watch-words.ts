import { videoToGame } from "@aov/ui/lib/game-video"
import { clock } from "./tournament-model.ts"
import { draftAt, scoreAt } from "./watch-place.ts"
import type { WatchFailure, WatchView } from "./watch-store.ts"
import { gameAlone } from "./watch-story.ts"
import {
  timed,
  type BarRead,
  type Chapter,
  type MomentKind,
  type MomentRow,
  type Place,
  type WatchCount,
  type WatchLength,
  type WatchMatch,
  type WatchTeam,
  type WatchTurn,
} from "./watch-types.ts"

export type Say = (vi: string, en: string) => string

/** A length in whole minutes, at least one. */
export function lengthWords(seconds: number, text: Say): string {
  const all = Math.max(1, Math.round(seconds / 60))
  const [hours, minutes] = [Math.floor(all / 60), all % 60]
  if (!hours) return text(`${minutes} phút`, `${minutes} min`)
  return minutes
    ? text(`${hours} giờ ${minutes} phút`, `${hours} h ${minutes} min`)
    : text(`${hours} giờ`, `${hours} h`)
}

/** A second of a video, with its hours; the clock of a game has none. */
export function videoClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(whole / 3600)
  if (!hours) return clock(whole)
  const [minutes, rest] = [Math.floor((whole % 3600) / 60), whole % 60].map((part) => String(part).padStart(2, "0"))
  return `${hours}:${minutes}:${rest}`
}

export function shortName(match: WatchMatch, team: WatchTeam): string {
  return match.teams[team].shortName || match.teams[team].name
}

export function gameWords(number: number, text: Say): string {
  return text(`Ván ${number}`, `Game ${number}`)
}

/** The name of a kind, for a count and for a mark still ahead. */
export const KIND_NAMES: Record<MomentKind, readonly [string, string]> = {
  KILL: ["Hạ gục", "Kills"],
  TURRET: ["Trụ", "Tower"],
  ABYSSAL_DRAGON: ["Rồng", "Abyssal Dragon"],
  DARK_SLAYER: ["Tà thần Caesar", "Dark Slayer"],
  BASE: ["Nhà chính", "Base"],
  OTHER: ["Mục tiêu", "Objective"],
  NOTE: ["Diễn biến", "Moment"],
}

/** What a team did, once or several times. */
function takenWords({ kind, count }: MomentRow["taken"][number], text: Say): string {
  const several = count > 1
  switch (kind) {
    case "KILL":
      return several ? text(`hạ gục ${count} tướng`, `killed ${count} heroes`) : text("hạ gục 1 tướng", "killed a hero")
    case "TURRET":
      return several ? text(`phá ${count} trụ`, `destroyed ${count} towers`) : text("phá trụ", "destroyed a tower")
    case "ABYSSAL_DRAGON":
      return several
        ? text(`hạ ${count} Rồng`, `took ${count} Abyssal Dragons`)
        : text("hạ Rồng", "took the Abyssal Dragon")
    case "DARK_SLAYER":
      return several
        ? text(`hạ ${count} tà thần Caesar`, `took ${count} Dark Slayers`)
        : text("hạ tà thần Caesar", "took the Dark Slayer")
    case "BASE":
      return text("phá nhà chính", "destroyed the base")
    case "OTHER":
      return several
        ? text(`chiếm ${count} mục tiêu`, `took ${count} objectives`)
        : text("chiếm mục tiêu", "took an objective")
    case "NOTE":
      return ""
  }
}

/** What happened, with the team it belongs to; a note says its own words. */
function doneWords(
  team: WatchTeam | null,
  title: string | null,
  taken: MomentRow["taken"],
  match: WatchMatch,
  text: Say,
) {
  if (title) return title
  const what = taken
    .map((item) => takenWords(item, text))
    .filter(Boolean)
    .join(", ")
  if (!what) return text(...KIND_NAMES[taken[0].kind])
  return team ? `${shortName(match, team)} ${what}` : what
}

export function rowWords(row: MomentRow, match: WatchMatch, text: Say): string {
  return doneWords(row.team, row.title, row.taken, match, text)
}

/**
 * The place of the video in one line, for the range and the small player; `full` adds the turn of a draft. Empty where
 * nobody knows which of its games a video is in: the one that is chosen only says whose line-ups are shown.
 */
export function placeWords({ place, match, video, second }: WatchView, text: Say, full = true): string {
  if (!place || place.state === "UNKNOWN") {
    const alone = match && !match.live && gameAlone(match.story.chapters, video)
    return alone ? gameWords(alone.number, text) : ""
  }
  if (place.state === "BEFORE") {
    const number = place.next?.number ?? 1
    return number > 1 ? text(`Trước ván ${number}`, `Before game ${number}`) : text("Trước trận", "Before the match")
  }
  const game = gameWords(place.chapter.number, text)
  switch (place.state) {
    case "DRAFT": {
      const draft = text(`${game}, cấm chọn`, `${game}, draft`)
      const turns = draftAt(place.chapter, second)
      const turn = turns.filter(({ made }) => made).length + 1
      if (!full || turn > turns.length) return draft
      return text(`${draft}, lượt ${turn} trong ${turns.length}`, `${draft}, turn ${turn} of ${turns.length}`)
    }
    case "WAIT": {
      const left = videoClock(place.left)
      return text(`${game}, vào trận sau ${left}`, `${game}, starts in ${left}`)
    }
    case "PLAY":
      return `${game}, ${clock(place.clock)}`
    case "PAUSE":
      return text(`${game}, ${clock(place.clock)}, tạm dừng`, `${game}, ${clock(place.clock)}, paused`)
    case "BREAK":
      return text(`Nghỉ sau ván ${place.chapter.number}`, `Break after game ${place.chapter.number}`)
    case "AFTER":
      return text("Hết trận", "End of the match")
    default:
      return game
  }
}

/** How the match stands at a place, "SGP 1–1 BME". */
export function scoreWords(match: WatchMatch, place: Place | null): string {
  const { A, B } = scoreAt(match, place)
  return `${shortName(match, "A")} ${A}–${B} ${shortName(match, "B")}`
}

/** What a count says, for the small player and for a screen reader. */
export function countWords(place: Place, count: WatchCount, text: Say): string {
  const at = text(`sau ${count.seconds} giây`, `in ${count.seconds} s`)
  if (place.state === "PAUSE") return text(`Hết tạm dừng ${at}`, `Pause ends ${at}`)
  if (place.state === "WAIT") return text(`Vào trận ${at}`, `Game starts ${at}`)
  const number = place.next?.number
  return number ? text(`Tới ván ${number} ${at}`, `Game ${number} ${at}`) : text(`Bỏ qua ${at}`, `Skipping ${at}`)
}

/** What a point of the bar reads: the game, the time or the phase there, and what happened. */
export function readWords(
  read: BarRead,
  match: WatchMatch,
  text: Say,
  heroName: (chapter: Chapter, turn: WatchTurn) => string,
): { game: string; time: string; what: string } {
  const { chapter } = read.cell
  const { mark, part, second } = read
  const game = gameWords(chapter.number, text)
  if (!chapter.parts.length) return { game, time: "", what: text("chưa có mốc", "not timed yet") }
  if (!part || second == null) return { game, time: "", what: "" }
  if (part.kind === "GAME" || !timed(chapter)) return { game, time: videoClock(second), what: "" }

  if (part.kind === "DRAFT") {
    const time = text("cấm chọn", "draft")
    if (!mark?.turn || mark.ahead) return { game, time, what: "" }
    const [team, hero] = [shortName(match, mark.turn.team), heroName(chapter, mark.turn)]
    const what =
      mark.turn.kind === "BAN"
        ? text(`${team} cấm ${hero}`, `${team} banned ${hero}`)
        : text(`${team} chọn ${hero}`, `${team} picked ${hero}`)
    return { game, time, what }
  }

  const { moment } = mark ?? {}
  const at = moment?.at ?? videoToGame(chapter.zero, chapter.pauses, second)
  const time = clock(Math.min(chapter.length, at))
  if (!mark || !moment) return { game, time, what: "" }
  const what = mark.ahead
    ? text(...KIND_NAMES[moment.kind])
    : doneWords(moment.team, moment.title, [{ kind: moment.kind, count: moment.count }], match, text)
  return { game, time, what }
}

/** The end of a game or of the match, with the score it leaves. */
function endWords(place: Place & { chapter: Chapter }, match: WatchMatch, text: Say): string {
  const { A, B } = scoreAt(match, place)
  if (place.state === "AFTER" && match.finished) {
    if (A === B) return text(`Hết trận, hòa ${A}–${B}`, `The match ends ${A}–${B}`)
    const winner = shortName(match, A > B ? "A" : "B")
    const score = `${Math.max(A, B)}–${Math.min(A, B)}`
    return text(`${winner} thắng trận ${score}`, `${winner} win the match ${score}`)
  }
  const { number, winner } = place.chapter
  if (!winner) return text(`Hết ván ${number}`, `End of game ${number}`)
  const team = shortName(match, winner)
  return text(`${team} thắng ván ${number}, tỷ số ${A}–${B}`, `${team} win game ${number}, ${A}–${B}`)
}

/**
 * A turn of the evening, said once to a screen reader; null for everything else. What was said of a failure is taken
 * back with it, so that the same one is heard again after another try.
 */
export function statusWords(before: WatchView, after: WatchView, text: Say): string | null {
  if (after.failure) return after.failure === before.failure ? null : failureWords(after.failure, text).title
  const turn = turnWords(before, after, text)
  return before.failure ? (turn ?? "") : turn
}

/** What the video has come to, where it is another thing than before. */
function turnWords(before: WatchView, after: WatchView, text: Say): string | null {
  const [was, is] = [before.place, after.place]
  if (!is || !after.match) return null
  if (after.count && !before.count) {
    const stay = text("Có nút ở lại.", "There is a button to stay.")
    return `${countWords(is, after.count, text)}. ${stay}`
  }
  // The games of a match that is on are read again as they are recorded, and are the same by their number.
  const same = before.match?.seriesId === after.match.seriesId && was?.chapter?.number === is.chapter?.number
  if (same && was?.state === is.state) return null
  switch (is.state) {
    case "DRAFT":
      return text(`Ván ${is.chapter.number}, cấm chọn`, `Game ${is.chapter.number}, draft`)
    case "PLAY":
      return same && was?.state === "PAUSE" ? null : gameWords(is.chapter.number, text)
    case "GAME":
      return gameWords(is.chapter.number, text)
    case "BREAK":
    case "AFTER":
      return endWords(is, after.match, text)
    default:
      return null
  }
}

export function failureWords(failure: WatchFailure, text: Say): { title: string; retry: boolean; link: boolean } {
  switch (failure) {
    case "FORBIDDEN":
      return {
        title: text("Video này không phát được ngoài YouTube.", "This video cannot be played outside YouTube."),
        retry: false,
        link: true,
      }
    case "GONE":
      return {
        title: text("Video này không còn trên YouTube.", "This video is no longer on YouTube."),
        retry: false,
        link: false,
      }
    case "BLOCKED":
      return {
        title: text("Trình duyệt chưa tải được trình phát của YouTube.", "YouTube's player could not be loaded."),
        retry: true,
        link: true,
      }
    case "FAILED":
      return { title: text("Video chưa phát được.", "The video could not be played."), retry: true, link: true }
  }
}

/** The lengths a match is offered in, with what each leaves out. */
export function lengthRows(
  match: WatchMatch,
  text: Say,
): { length: WatchLength; name: string; what: string; seconds: number | null }[] {
  const { quick, games, whole, missing } = match.cuts
  const rows: ReturnType<typeof lengthRows> = []
  if (quick.offered)
    rows.push({
      length: "quick",
      name: text("Xem nhanh", "Quick watch"),
      what: text("Chốt đội hình, các đợt phá trụ, đoạn kết", "The locked line-ups, the pushes, the endings"),
      seconds: quick.seconds,
    })
  if (games.offered)
    rows.push({
      length: "games",
      name: text("Chỉ ván đấu", "Games only"),
      what: text("Bỏ cấm chọn và giờ nghỉ", "Without drafts and breaks"),
      seconds: games.seconds,
    })
  if (whole.offered)
    rows.push(
      {
        length: "whole",
        name: text("Cả trận", "The match"),
        what: text("Cấm chọn và các ván, bỏ giờ nghỉ", "Drafts and games, without breaks"),
        seconds: missing.length ? null : whole.seconds,
      },
      {
        length: "all",
        name: text("Nguyên video", "The full video"),
        what: text("Cả giờ nghỉ, không bỏ đoạn nào", "Breaks too, nothing is skipped"),
        seconds: null,
      },
    )
  return rows
}
