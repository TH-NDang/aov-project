import assert from "node:assert/strict"
import { test } from "node:test"
import { barOf, readAt } from "../src/lib/watch-bar.ts"
import { countAt } from "../src/lib/watch-follow.ts"
import { placeAt } from "../src/lib/watch-place.ts"
import { rowsOf } from "../src/lib/watch-rows.ts"
import type { WatchView } from "../src/lib/watch-store.ts"
import type { MomentRow, WatchMatch } from "../src/lib/watch-types.ts"
import {
  countWords,
  failureWords,
  gameWords,
  lengthRows,
  lengthWords,
  placeWords,
  readWords,
  rowWords,
  scoreWords,
  shortName,
  statusWords,
  videoClock,
  type Say,
} from "../src/lib/watch-words.ts"
import { BRU_EA, en, HKA_LIT, SGP_BME, UNTIMED, UNTIMED_MIDDLE, vi, viewAt, watchMatch } from "./fixtures/watch.ts"

const sgp = watchMatch(SGP_BME, 7)
const bru = watchMatch(BRU_EA, 7)
const hka = watchMatch(HKA_LIT, 5)
const both = (words: (text: Say) => string | null) => [words(vi), words(en)]

test("a length is told in hours and minutes", () => {
  assert.deepEqual(
    [20, 951, 3600, 4890, 7407].map((seconds) => lengthWords(seconds, vi)),
    ["1 phút", "16 phút", "1 giờ", "1 giờ 22 phút", "2 giờ 3 phút"],
  )
  assert.deepEqual(
    [951, 7200, 7407].map((seconds) => lengthWords(seconds, en)),
    ["16 min", "2 h", "2 h 3 min"],
  )
})

test("a second of a video has its hours", () => {
  assert.deepEqual([-4, 9, 566, 6400, 13504.6].map(videoClock), ["0:00", "0:09", "9:26", "1:46:40", "3:45:04"])
})

test("a team without a short name has its name", () => {
  assert.equal(shortName(sgp, "B"), "BME")
  const teams = { ...sgp.teams, B: { ...sgp.teams.B, shortName: null } }
  assert.equal(shortName({ ...sgp, teams }, "B"), "BOOM Esports")
})

test("a game has its number", () => {
  assert.deepEqual(
    both((text) => gameWords(3, text)),
    ["Ván 3", "Game 3"],
  )
})

test("the place of the video is told in one line", () => {
  const place = (second: number, match: WatchMatch = sgp) => both((text) => placeWords(viewAt(match, second), text))
  assert.deepEqual(place(300), ["Trước trận", "Before the match"])
  assert.deepEqual(place(685), ["Ván 1, cấm chọn, lượt 2 trong 18", "Game 1, draft, turn 2 of 18"])
  assert.deepEqual(place(5600), ["Ván 3, cấm chọn, lượt 13 trong 18", "Game 3, draft, turn 13 of 18"])
  assert.deepEqual(place(1200), ["Ván 1, vào trận sau 5:46", "Game 1, starts in 5:46"])
  assert.deepEqual(place(6208), ["Ván 3, 5:33", "Game 3, 5:33"])
  assert.deepEqual(place(41850, bru), ["Ván 5, 12:01, tạm dừng", "Game 5, 12:01, paused"])
  assert.deepEqual(place(4900), ["Nghỉ sau ván 2", "Break after game 2"])
  assert.deepEqual(place(12300), ["Hết trận", "End of the match"])
  assert.deepEqual(place(42800, bru), ["Ván 6", "Game 6"])
  assert.deepEqual(place(6400, hka), ["Ván 2", "Game 2"])
})

test("the short line of a draft leaves its turn out", () => {
  assert.equal(placeWords(viewAt(sgp, 685), vi, false), "Ván 1, cấm chọn")
})

test("a draft whose turns nobody recorded is told without one", () => {
  const bare = watchMatch([{ ...SGP_BME[0]!, turns: "" }], 7)
  assert.equal(placeWords(viewAt(bare, 685), vi), "Ván 1, cấm chọn")
})

test("before a later game the line names it", () => {
  const second = watchMatch([{ ...SGP_BME[0]!, link: "" }, SGP_BME[1]!], 7)
  assert.deepEqual(
    both((text) => placeWords(viewAt(second, 300), text)),
    ["Trước ván 2", "Before game 2"],
  )
})

test("without a place the line names no game, whichever is chosen for its line-ups", () => {
  const plain = watchMatch(UNTIMED, 5)
  for (const chosen of [0, 4]) assert.equal(placeWords(viewAt(plain, 6402, { chosen }), vi), "")
})

const own = watchMatch(
  UNTIMED.slice(0, 2).map((game, index) => ({ ...game, link: `https://youtu.be/abcdefghij${index}` })),
  3,
)

test("a game whose video is its own is named without a place", () => {
  const view = viewAt(own, 60, { video: "abcdefghij1" })
  assert.deepEqual(
    both((text) => placeWords(view, text)),
    ["Ván 2", "Game 2"],
  )
})

const apart = watchMatch(
  UNTIMED_MIDDLE.map((game) => (game.zero == null ? { ...game, link: "https://youtu.be/abcdefghij1" } : game)),
  7,
)
const inVideo = (video: string) => viewAt(apart, 60, { video, place: placeAt(apart.story, video, 60) })

test("a game without a time is named in a video of its own, though the others are timed", () => {
  assert.equal(placeWords(inVideo("abcdefghij1"), vi), "Ván 2")
})

test("a video that shows none of the games names no game", () => {
  assert.equal(placeWords(inVideo("abcdefghij2"), vi), "")
})

test("a stream that is on names no game, as the one it is linked for may be over", () => {
  const view = viewAt({ ...own, live: true }, 60, { video: "abcdefghij1", place: null })
  assert.equal(placeWords(view, vi), "")
})

test("without a match there is no place to tell", () => {
  assert.equal(placeWords(viewAt(sgp, 0, { match: null, place: null }), vi), "")
})

test("the score is told between the short names", () => {
  assert.equal(scoreWords(sgp, viewAt(sgp, 6208).place), "SGP 1–1 BME")
  assert.equal(scoreWords(sgp, viewAt(sgp, 12300).place), "SGP 4–2 BME")
  assert.equal(scoreWords(sgp, null), "SGP 0–0 BME")
})

test("the score counts what was won before the first published game", () => {
  const late = watchMatch(SGP_BME.slice(1), 7, { before: { A: 1, B: 0 } })
  assert.equal(scoreWords(late, viewAt(late, 3200).place), "SGP 1–0 BME")
})

test("a count says what comes after it", () => {
  const count = (match: WatchMatch, second: number) => {
    const { place, video } = viewAt(match, second)
    const found = countAt(match.cuts.whole, "whole", video!, second, 1, null)!
    return both((text) => countWords(place!, found, text))
  }
  assert.deepEqual(count(sgp, 983), ["Vào trận sau 7 giây", "Game starts in 7 s"])
  assert.deepEqual(count(sgp, 4528), ["Tới ván 3 sau 7 giây", "Game 3 in 7 s"])
  assert.deepEqual(count(bru, 41783), ["Hết tạm dừng sau 3 giây", "Pause ends in 3 s"])
})

test("a row says what one team did", () => {
  const rows = (index: number, text: Say) => rowsOf(sgp.story.chapters[index]!).map((row) => rowWords(row, sgp, text))
  assert.deepEqual(rows(1, vi).slice(0, 5), [
    "SGP hạ Rồng",
    "BME phá trụ, hạ tà thần Caesar",
    "BME phá trụ",
    "BME hạ Rồng",
    "BME hạ tà thần Caesar",
  ])
  assert.deepEqual(rows(0, vi).slice(8, 10), ["SGP hạ 2 tà thần Caesar", "SGP hạ Rồng, phá 2 trụ"])
  assert.deepEqual(rows(0, en).slice(8, 10), [
    "SGP took 2 Dark Slayers",
    "SGP took the Abyssal Dragon, destroyed 2 towers",
  ])
})

test("every kind has its words, for one and for several", () => {
  const row = (kind: MomentRow["taken"][number]["kind"], count: number, known: Partial<MomentRow> = {}): MomentRow => ({
    from: 60,
    to: 60,
    team: "A",
    title: null,
    taken: [{ kind, count }],
    second: null,
    ...known,
  })
  const words = (kind: MomentRow["taken"][number]["kind"], count: number) =>
    both((text) => rowWords(row(kind, count), sgp, text))
  assert.deepEqual(words("KILL", 1), ["SGP hạ gục 1 tướng", "SGP killed a hero"])
  assert.deepEqual(words("KILL", 3), ["SGP hạ gục 3 tướng", "SGP killed 3 heroes"])
  assert.deepEqual(words("TURRET", 2), ["SGP phá 2 trụ", "SGP destroyed 2 towers"])
  assert.deepEqual(words("ABYSSAL_DRAGON", 2), ["SGP hạ 2 Rồng", "SGP took 2 Abyssal Dragons"])
  assert.deepEqual(words("BASE", 1), ["SGP phá nhà chính", "SGP destroyed the base"])
  assert.deepEqual(words("OTHER", 1), ["SGP chiếm mục tiêu", "SGP took an objective"])
  assert.deepEqual(words("OTHER", 2), ["SGP chiếm 2 mục tiêu", "SGP took 2 objectives"])
  assert.equal(rowWords(row("TURRET", 1, { team: null }), sgp, vi), "phá trụ")
  assert.equal(rowWords(row("NOTE", 1, { title: "Quét sạch" }), sgp, vi), "Quét sạch")
  assert.equal(rowWords(row("NOTE", 1), sgp, vi), "Diễn biến")
})

test("a point of the bar reads what was done, and only the kind of what is ahead", () => {
  const bar = barOf(sgp.story, 1300, 2)
  const hero = (_: unknown, turn: { order: number }) => `hero ${turn.order}`
  const read = (x: number, text: Say) => {
    const { game, time, what } = readWords(readAt(bar, x, 3259)!, sgp, text, hero)
    return [game, time, what].join(" | ")
  }
  assert.equal(read(372, vi), "Ván 2 | 9:42 | BME phá trụ")
  assert.equal(read(372, en), "Game 2 | 9:42 | BME destroyed a tower")
  assert.equal(read(455, vi), "Ván 3 | cấm chọn | SGP chọn hero 7")
  assert.equal(read(455, en), "Game 3 | draft | SGP picked hero 7")
  assert.equal(read(1218, vi), "Ván 6 | 2:10 | Rồng")
  assert.equal(read(1218, en), "Game 6 | 2:10 | Abyssal Dragon")
  assert.equal(read(600, vi), "Ván 3 | 8:12 | Tà thần Caesar")
  assert.equal(read(285, vi), "Ván 2 | 0:23 | ")
  assert.equal(read(1140, vi), "Ván 6 | cấm chọn | ")
})

test("a ban on the bar is told as one", () => {
  const bar = barOf(sgp.story, 1300, 2)
  const read = readAt(bar, 4, 3259)!
  assert.equal(readWords(read, sgp, vi, () => "Tamyn").what, "BME cấm Tamyn")
  assert.equal(readWords(read, sgp, en, () => "Tamyn").what, "BME banned Tamyn")
})

test("a game without a time reads that it has none", () => {
  const own = barOf(bru.story, 1300, 0)
  const blank = readAt(own, own.cells[5]!.left + 10, 0)!
  assert.deepEqual(
    readWords(blank, bru, vi, () => ""),
    { game: "Ván 6", time: "", what: "chưa có mốc" },
  )
})

test("a game that is folded to its number reads its name alone", () => {
  const chip = readAt(barOf(sgp.story, 340, 2, { gap: 8, cut: 3 }), 10, 0)!
  assert.deepEqual(
    readWords(chip, sgp, vi, () => ""),
    { game: "Ván 1", time: "", what: "" },
  )
})

test("a linked game reads the second of its video", () => {
  const linked = barOf(hka.story, 1300, 0)
  const { left, width } = linked.cells[1]!
  assert.deepEqual(
    readWords(readAt(linked, left + width / 2, 0)!, hka, vi, () => ""),
    { game: "Ván 2", time: "1:48:24", what: "" },
  )
})

test("a point past the end of a game reads its length", () => {
  const bare = watchMatch([{ ...SGP_BME[1]!, moments: "" }], 7)
  const read = readAt(barOf(bare.story, 1300, 0), 1299, 0)!
  assert.equal(readWords(read, bare, vi, () => "").time, "13:22")
})

const status = (before: WatchView, after: WatchView) => both((text) => statusWords(before, after, text))

test("the turns of the evening are said once", () => {
  const between = (a: number, b: number, match: WatchMatch = sgp) => status(viewAt(match, a), viewAt(match, b))
  assert.deepEqual(between(5000, 5358), ["Ván 3, cấm chọn", "Game 3, draft"])
  assert.deepEqual(between(5874, 5876), ["Ván 3", "Game 3"])
  assert.deepEqual(between(4522, 4523), ["BME thắng ván 2, tỷ số 1–1", "BME win game 2, 1–1"])
  assert.deepEqual(between(12236, 12238), ["SGP thắng trận 4–2", "SGP win the match 4–2"])
  assert.deepEqual(between(6208, 6209), [null, null])
  assert.deepEqual(between(5868, 5869, hka), ["Ván 2", "Game 2"])
})

test("opening a match says where it is", () => {
  const closed = viewAt(sgp, 0, { match: null, place: null })
  assert.deepEqual(status(closed, viewAt(sgp, 685)), ["Ván 1, cấm chọn", "Game 1, draft"])
})

test("a match that is read again does not say once more where it is", () => {
  const again = watchMatch(SGP_BME, 7)
  for (const second of [685, 6208, 4900, 12300])
    assert.deepEqual(status(viewAt(sgp, second), viewAt(again, second)), [null, null])
})

test("another match in the same game of its own is said", () => {
  const next = watchMatch(SGP_BME, 7, { seriesId: "next" })
  assert.deepEqual(status(viewAt(sgp, 685), viewAt(next, 685)), ["Ván 1, cấm chọn", "Game 1, draft"])
})

test("going on after a pause says nothing", () => {
  assert.deepEqual(status(viewAt(bru, 41957), viewAt(bru, 41959)), [null, null])
})

test("a game that is gone to from the pause of another one is said", () => {
  assert.deepEqual(status(viewAt(bru, 41957), viewAt(bru, 37000)), ["Ván 3", "Game 3"])
})

test("the end of a game nobody is known to have won says so", () => {
  const unknown = watchMatch([{ ...SGP_BME[0]!, winner: null }, SGP_BME[1]!], 7)
  assert.deepEqual(status(viewAt(unknown, 2431), viewAt(unknown, 2432)), ["Hết ván 1", "End of game 1"])
})

test("a match whose result is not final ends with its last game", () => {
  const open = { ...sgp, finished: false }
  assert.deepEqual(status(viewAt(open, 12236), viewAt(open, 12238)), [
    "SGP thắng ván 6, tỷ số 4–2",
    "SGP win game 6, 4–2",
  ])
})

test("a drawn match ends drawn", () => {
  const drawn = watchMatch(SGP_BME.slice(0, 2), 2)
  assert.deepEqual(status(viewAt(drawn, 4522), viewAt(drawn, 4523)), ["Hết trận, hòa 1–1", "The match ends 1–1"])
})

test("a match whose first game is not published ends with its whole score", () => {
  const late = watchMatch(SGP_BME.slice(1), 7, { before: { A: 1, B: 0 } })
  assert.deepEqual(status(viewAt(late, 12236), viewAt(late, 12238)), ["SGP thắng trận 4–2", "SGP win the match 4–2"])
})

const count = countAt(sgp.cuts.whole, "whole", sgp.story.videos[0]!, 4525, 1, null)

test("a count says that there is a button to stay", () => {
  assert.deepEqual(status(viewAt(sgp, 4524), viewAt(sgp, 4525, { count })), [
    "Tới ván 3 sau 10 giây. Có nút ở lại.",
    "Game 3 in 10 s. There is a button to stay.",
  ])
})

test("a count that runs on is not said again", () => {
  assert.deepEqual(status(viewAt(sgp, 4525, { count }), viewAt(sgp, 4526, { count })), [null, null])
})

const failed = (failure: WatchView["failure"] = "FAILED", second = 700, match: WatchMatch = sgp) =>
  viewAt(match, second, { failure, player: "CLOSED" })

test("a video that fails is said", () => {
  assert.deepEqual(status(viewAt(sgp, 700), failed()), ["Video chưa phát được.", "The video could not be played."])
})

test("a video that fails as it is opened is said", () => {
  const closed = viewAt(sgp, 0, { match: null, place: null })
  assert.deepEqual(status(closed, failed("GONE")), [
    "Video này không còn trên YouTube.",
    "This video is no longer on YouTube.",
  ])
})

test("a failure that takes the place of another one is said", () => {
  assert.equal(statusWords(failed("BLOCKED"), failed("FORBIDDEN"), vi), "Video này không phát được ngoài YouTube.")
})

test("while a video has failed nothing else is said, also when its match is updated", () => {
  const again = watchMatch(SGP_BME, 7)
  assert.deepEqual(status(failed(), failed("FAILED", 700, again)), [null, null])
})

test("another try takes back what was said of the failure, so that the same one is heard again", () => {
  assert.deepEqual(status(failed(), viewAt(sgp, 700, { player: "OPENING" })), ["", ""])
})

test("a game that is gone to after a failure is said", () => {
  assert.deepEqual(status(failed(), viewAt(sgp, 6208)), ["Ván 3", "Game 3"])
})

test("a failure says its title and what can be done", () => {
  const words = (failure: Parameters<typeof failureWords>[0]) => {
    const { title, retry, link } = failureWords(failure, vi)
    return [title, failureWords(failure, en).title, retry, link]
  }
  assert.deepEqual(words("FORBIDDEN"), [
    "Video này không phát được ngoài YouTube.",
    "This video cannot be played outside YouTube.",
    false,
    true,
  ])
  assert.deepEqual(words("GONE"), [
    "Video này không còn trên YouTube.",
    "This video is no longer on YouTube.",
    false,
    false,
  ])
  assert.deepEqual(words("BLOCKED"), [
    "Trình duyệt chưa tải được trình phát của YouTube.",
    "YouTube's player could not be loaded.",
    true,
    true,
  ])
  assert.deepEqual(words("FAILED"), ["Video chưa phát được.", "The video could not be played.", true, true])
})

test("the lengths of a match say what each leaves out", () => {
  const rows = (text: Say) => lengthRows(sgp, text).map(({ name, what, seconds }) => [name, what, seconds])
  assert.deepEqual(rows(vi), [
    ["Xem nhanh", "Chốt đội hình, các đợt phá trụ, đoạn kết", 951],
    ["Chỉ ván đấu", "Bỏ cấm chọn và giờ nghỉ", 4890],
    ["Cả trận", "Cấm chọn và các ván, bỏ giờ nghỉ", 7407],
    ["Nguyên video", "Cả giờ nghỉ, không bỏ đoạn nào", null],
  ])
  assert.deepEqual(rows(en), [
    ["Quick watch", "The locked line-ups, the pushes, the endings", 951],
    ["Games only", "Without drafts and breaks", 4890],
    ["The match", "Drafts and games, without breaks", 7407],
    ["The full video", "Breaks too, nothing is skipped", null],
  ])
})

test("the lengths of a match come from the shortest to the longest", () => {
  assert.deepEqual(
    lengthRows(sgp, vi).map(({ length }) => length),
    ["quick", "games", "whole", "all"],
  )
})

test("a match with an untimed game has two lengths, without a number", () => {
  assert.deepEqual(
    lengthRows(bru, vi).map(({ length, seconds }) => [length, seconds]),
    [
      ["whole", null],
      ["all", null],
    ],
  )
})

test("a match without a clock has no lengths", () => {
  assert.deepEqual(lengthRows(hka, vi), [])
})
