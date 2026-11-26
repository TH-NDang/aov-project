import assert from "node:assert/strict"
import { test } from "node:test"
import type { WatchStop } from "../src/lib/watch-memory.ts"
import { readWatch, targetOf } from "../src/lib/watch-routes.ts"
import { openingOf, startActions, startWords } from "../src/lib/watch-start.ts"
import { CLOSED } from "../src/lib/watch-store.ts"
import { storyOf } from "../src/lib/watch-story.ts"
import type { WatchMatch } from "../src/lib/watch-types.ts"
import { BRU_EA, en, FPL_1S, HKA_LIT, matchOf, SGP_BME, UNTIMED, vi, viewAt, watchMatch } from "./fixtures/watch.ts"

const sgp = watchMatch(SGP_BME, 7)
const bru = watchMatch(BRU_EA, 7)
const fpl = watchMatch(FPL_1S, 5)
const hka = watchMatch(HKA_LIT, 5)
const plain = watchMatch(UNTIMED, 5)

type Now = Parameters<typeof startActions>[1]
const FIRST: Now = { stop: null, open: false, shrunk: false, address: null, length: "whole" }
const stopAt = (second: number, known: Partial<WatchStop> = {}, match: WatchMatch = sgp): WatchStop => ({
  video: match.story.videos[0]!,
  second,
  length: "whole",
  reached: 3000,
  done: false,
  ...known,
})
const actions = (match: WatchMatch, now: Partial<Now> = {}) => startActions(match, { ...FIRST, ...now })
/** The two lines of every action, with " + " between two of them. */
const offer = (match: WatchMatch, now: Partial<Now> = {}, text = vi, compact = false) =>
  actions(match, now)
    .map((action) => {
      const { title, line } = startWords(action, match, text, compact, viewAt(match, 6208))
      return [title, line].filter(Boolean).join(": ")
    })
    .join(" + ")
const seconds = (match: WatchMatch, now: Partial<Now> = {}) =>
  actions(match, now).map((action) =>
    "target" in action ? `${action.kind} ${action.length} ${action.target.second}` : action.kind,
  )
const shared = (search: string, match: WatchMatch = sgp) => ({ address: targetOf(match, readWatch(search), "whole") })

test("a first visit offers the match with its real length, and the short cut", () => {
  assert.equal(offer(sgp), "Xem cả trận: 2 giờ 3 phút, bỏ giờ nghỉ + Xem nhanh: 16 phút phá trụ và đoạn kết")
  assert.equal(
    offer(sgp, {}, en),
    "Watch the match: 2 h 3 min without breaks + Quick watch: 16 min of pushes and endings",
  )
  assert.deepEqual(seconds(sgp), ["WATCH whole 662", "QUICK quick 967"])
})

test("on a narrow head the lines are the lengths alone", () => {
  assert.equal(offer(sgp, {}, vi, true), "Xem cả trận: 2 giờ 3 phút + Xem nhanh: 16 phút")
  assert.equal(offer(hka, {}, vi, true), "Xem cả trận: 5 ván")
  assert.equal(offer(sgp, { stop: stopAt(6208) }, vi, true), "Xem tiếp ván 3: lúc 5:33 + Từ đầu")
  assert.equal(offer(sgp, { stop: stopAt(6208) }, en, true), "Resume game 3: at 5:33 + From start")
  assert.equal(offer(sgp, { length: "all" }, vi, true), "Xem cả trận: nguyên video + Xem nhanh: 16 phút")
})

test("the length chosen last is offered where the match has it", () => {
  assert.match(offer(sgp, { length: "games" }), /^Xem cả trận: 1 giờ 22 phút, chỉ ván đấu \+/)
  assert.match(offer(sgp, { length: "games" }, en), /^Watch the match: 1 h 22 min, games only \+/)
  assert.match(offer(sgp, { length: "all" }), /^Xem cả trận: nguyên video, cả giờ nghỉ \+/)
  assert.match(offer(sgp, { length: "all" }, en), /^Watch the match: the full video with its breaks \+/)
  assert.deepEqual(seconds(sgp, { length: "games" })[0], "WATCH games 1541")
  assert.deepEqual(seconds(bru, { length: "games" }), ["WATCH whole 31139"])
})

test("who stopped part way is offered to go on, and to begin again", () => {
  assert.equal(
    offer(sgp, { stop: stopAt(6208) }),
    "Xem tiếp ván 3: lúc 5:33, còn 1 giờ 9 phút + Xem từ đầu: 2 giờ 3 phút, bỏ giờ nghỉ",
  )
  assert.equal(
    offer(sgp, { stop: stopAt(6208) }, en),
    "Resume game 3: at 5:33, 1 h 9 min left + From the start: 2 h 3 min without breaks",
  )
  assert.deepEqual(seconds(sgp, { stop: stopAt(6208) }), ["RESUME whole 6208", "RESTART whole 662"])
})

test("going on says where in a game it is", () => {
  assert.match(offer(sgp, { stop: stopAt(5600) }), /^Xem tiếp ván 3: lúc cấm chọn, còn 1 giờ 19 phút/)
  assert.match(offer(sgp, { stop: stopAt(5600) }, en), /^Resume game 3: at the draft, 1 h 19 min left/)
  assert.match(offer(sgp, { stop: stopAt(1200) }), /^Xem tiếp ván 1: lúc vào trận, còn/)
  assert.match(offer(sgp, { stop: stopAt(1200) }, en), /^Resume game 1: as the game starts,/)
})

test("who stopped in a break goes on with the next game, as the length begins it", () => {
  assert.match(offer(sgp, { stop: stopAt(4900) }), /^Xem tiếp ván 3: lúc cấm chọn, còn 1 giờ 23 phút/)
  const games = { length: "games", stop: stopAt(4900, { length: "games" }) } as const
  assert.match(
    offer(sgp, games),
    /^Xem tiếp ván 3: lúc vào trận, còn 53 phút \+ Xem từ đầu: 1 giờ 22 phút, chỉ ván đấu$/,
  )
  assert.deepEqual(seconds(sgp, games), ["RESUME games 5870", "RESTART games 1541"])
})

test("who watched the short cut part way goes on with it", () => {
  const quick = { stop: stopAt(6240, { length: "quick" }) }
  assert.deepEqual(seconds(sgp, quick), ["RESUME quick 6240", "RESTART whole 662"])
  assert.match(offer(sgp, quick), /^Xem tiếp ván 3: lúc 6:05, còn 10 phút/)
})

test("who saw the end is offered the match again", () => {
  assert.equal(
    offer(sgp, { stop: stopAt(12300, { done: true }) }),
    "Xem lại: 2 giờ 3 phút, bỏ giờ nghỉ + Xem nhanh: 16 phút phá trụ và đoạn kết",
  )
  assert.match(offer(sgp, { stop: stopAt(12300, { done: true }) }, en), /^Watch again: 2 h 3 min without breaks/)
})

test("who left in the first seconds is offered a first visit", () => {
  assert.equal(offer(sgp, { stop: stopAt(680, { reached: 23 }) }), offer(sgp))
})

test("an address that names a place is offered first", () => {
  assert.equal(offer(sgp, shared("?game=3&at=333")), "Xem từ ván 3: lúc 5:33 + Xem từ đầu: 2 giờ 3 phút, bỏ giờ nghỉ")
  assert.match(offer(sgp, shared("?game=3&at=333"), en), /^Watch from game 3: at 5:33 \+ From the start:/)
  assert.match(offer(sgp, shared("?game=3")), /^Xem từ ván 3: lúc cấm chọn \+/)
  assert.match(offer(sgp, shared("?game=3&at=-120")), /^Xem từ ván 3: lúc cấm chọn \+/)
  assert.deepEqual(seconds(sgp, { ...shared("?game=3&at=333"), stop: stopAt(9930) }), [
    "SHARED whole 6208",
    "RESTART whole 662",
  ])
})

test("an address before the first game names that game", () => {
  assert.match(offer(sgp, shared("?second=300")), /^Xem từ ván 1: lúc cấm chọn \+/)
})

test("an address that names a game and a second of another one names that of the second", () => {
  assert.match(offer(fpl, shared("?game=3&second=1200", fpl)), /^Xem từ ván 1: từ 20:00 của video/)
})

test("an address between two games names no game", () => {
  assert.match(offer(sgp, shared("?second=4900")), /^Xem từ đây: từ 1:21:40 của video \+/)
  assert.match(offer(sgp, shared("?second=4900"), en), /^Watch from here: from 1:21:40 of the video \+/)
})

test("an address of an untimed game names that game", () => {
  assert.match(offer(bru, shared("?game=6", bru)), /^Xem từ ván 6: từ 11:52:23 của video/)
})

test("an address of the second of two untimed games in one stretch names that one", () => {
  const two = watchMatch([...BRU_EA, { ...BRU_EA[5]!, number: 7 }], 7)
  assert.match(offer(two, shared("?game=7", two)), /^Xem từ ván 7:/)
})

test("the match in the small player leads back to its room", () => {
  assert.equal(offer(sgp, { open: true, shrunk: true }), "Về phòng xem: ván 3, 5:33")
  assert.equal(offer(sgp, { open: true, shrunk: true }, en), "Back to the room: game 3, 5:33")
})

test("the way back to the room says a break as it is", () => {
  const [back] = actions(sgp, { open: true, shrunk: true })
  assert.equal(startWords(back!, sgp, vi, false, viewAt(sgp, 4900)).line, "nghỉ sau ván 2")
})

test("the way back to a video without times names no game", () => {
  const [back] = actions(plain, { open: true, shrunk: true })
  assert.deepEqual(startWords(back!, plain, vi, false, viewAt(plain, 6402, { chosen: 4 })), {
    title: "Về phòng xem",
    line: "",
  })
})

test("in the room nothing is offered", () => {
  assert.deepEqual(actions(sgp, { open: true }), [])
})

test("nothing is offered without a video", () => {
  assert.deepEqual(startActions(null, FIRST), [])
  assert.deepEqual(actions(matchOf(storyOf([], "https://liquipedia.net/x"))), [])
})

test("a match with an untimed game says its games and how long they lasted", () => {
  assert.equal(offer(fpl), "Xem cả trận: 3 ván, 40 phút thi đấu")
  assert.equal(offer(fpl, {}, en), "Watch the match: 3 games, 40 min of play")
  assert.equal(offer(bru), "Xem cả trận: 6 ván, 1 giờ 58 phút thi đấu")
  assert.deepEqual(seconds(fpl), ["WATCH whole 0"])
})

test("what is left of a match with an untimed game is not told", () => {
  assert.equal(offer(bru, { stop: stopAt(36950, {}, bru) }).split(" + ")[0], "Xem tiếp ván 3: lúc 0:31")
})

test("what is left of a length the match is not offered in is not told", () => {
  const draftless = watchMatch(
    SGP_BME.map((game) => ({ ...game, draft: null })),
    7,
  )
  assert.equal(
    offer(draftless, { stop: stopAt(6208, { length: "games" }) }).split(" + ")[0],
    "Xem tiếp ván 3: lúc 5:33",
  )
})

test("a linked match says its games", () => {
  assert.equal(offer(hka), "Xem cả trận: 5 ván, 1 giờ 22 phút thi đấu")
})

test("a linked match is gone on with by the second of its video", () => {
  const resumed = { stop: stopAt(6400, { reached: 1800 }, hka) }
  assert.equal(offer(hka, resumed), "Xem tiếp ván 2: từ 1:46:40 của video + Xem từ đầu: 5 ván, 1 giờ 22 phút thi đấu")
  assert.match(offer(hka, resumed, en), /^Resume game 2: from 1:46:40 of the video \+/)
})

test("a video without times is offered as a video", () => {
  assert.equal(offer(plain), "Xem video: 5 ván, 1 giờ 22 phút thi đấu")
  assert.equal(offer(plain, {}, en), "Watch the video: 5 games, 1 h 22 min of play")
  const resumed = { stop: stopAt(6400, { length: "all", reached: 6400 }, plain) }
  assert.match(offer(plain, resumed), /^Xem tiếp: từ 1:46:40 của video \+ Xem từ đầu: 5 ván/)
  assert.match(offer(plain, shared("?game=3", plain)), /^Xem từ đây: từ 0:00 của video/)
})

test("a game with a video of its own is named by it", () => {
  const apart = watchMatch(
    UNTIMED.slice(0, 2).map((game, index) => ({ ...game, link: `https://youtu.be/abcdefghij${index}` })),
    3,
  )
  assert.match(offer(apart, shared("?game=2", apart)), /^Xem từ ván 2: từ 0:00 của video/)
})

test("a match without games is offered as a video without a line", () => {
  const link = matchOf(storyOf([], "https://youtu.be/j8AvYygkzm4"))
  assert.equal(offer(link), "Xem video")
  assert.equal(offer(link, {}, en), "Watch the video")
})

test("a match that is on is offered live, at its live edge", () => {
  const live = matchOf(storyOf([], "https://youtu.be/j8AvYygkzm4"), { live: true, finished: false })
  assert.equal(offer(live), "Xem trực tiếp: Đang diễn ra")
  assert.equal(offer(live, {}, en), "Watch live: On now")
  assert.deepEqual(seconds(live), ["LIVE all 0"])
  assert.deepEqual(seconds({ ...hka, live: true }), ["LIVE all 0"])
})

test("a match that is on in its second video is joined in that one", () => {
  const games = UNTIMED.slice(0, 2).map((game, index) => ({ ...game, link: `https://youtu.be/abcdefghij${index}` }))
  const [live] = actions(watchMatch(games, 3, { live: true, finished: false }))
  assert.deepEqual(live, { kind: "LIVE", target: { video: "abcdefghij1", second: 0 }, length: "all" })
})

test("a match that is on with a timed game is offered as a match", () => {
  assert.deepEqual(seconds({ ...sgp, live: true }), ["WATCH whole 662", "QUICK quick 967"])
})

test("how long the games lasted is left out where one is not known", () => {
  const unknown = watchMatch([{ ...HKA_LIT[0]!, seconds: null }, HKA_LIT[1]!], 3)
  assert.equal(offer(unknown), "Xem cả trận: 2 ván")
  assert.equal(offer(watchMatch(HKA_LIT.slice(0, 1), 1), {}, en), "Watch the match: 1 game, 22 min of play")
})

// ---------- what plays on a page that was opened to be watched

type Opening = Parameters<typeof openingOf>[1]
const opening = (match: WatchMatch, now: Partial<Opening> = {}) => {
  const found = openingOf(match, { view: CLOSED, stop: null, address: null, asked: undefined, kept: "whole", ...now })
  return found && [found.target.second, found.length]
}

test("a page that was opened to be watched plays the first thing its head offers", () => {
  assert.deepEqual(opening(sgp), [662, "whole"])
  assert.deepEqual(opening(sgp, { kept: "games" }), [1541, "games"])
  assert.deepEqual(opening(sgp, { stop: stopAt(6208) }), [6208, "whole"])
})

test("a match that is asked for in a length begins in it", () => {
  assert.deepEqual(opening(sgp, { asked: "quick" }), [967, "quick"])
  assert.deepEqual(opening(sgp, { asked: "all", stop: stopAt(6208) }), [662, "all"])
})

test("a length the match is not offered in is not played", () => {
  assert.deepEqual(opening(bru, { asked: "quick" }), [31139, "whole"])
})

test("an address wins over the length that is asked for", () => {
  assert.deepEqual(opening(sgp, { asked: "quick", ...shared("?game=3&at=333") }), [6208, "whole"])
})

test("the match that is open goes on where it is, in its own length", () => {
  const view = { ...viewAt(sgp, 9930), length: "games" as const }
  assert.deepEqual(opening(sgp, { view, asked: "quick" }), [9930, "games"])
})

test("an address wins over the place of the match that is open", () => {
  assert.deepEqual(opening(sgp, { view: viewAt(sgp, 9930), ...shared("?game=3&at=333") }), [6208, "whole"])
})

test("a match whose video has failed is begun as any other", () => {
  assert.deepEqual(opening(sgp, { view: viewAt(sgp, 9930, { player: "CLOSED", failure: "FAILED" }) }), [662, "whole"])
})

test("the place of another match that is open does not count", () => {
  assert.deepEqual(opening({ ...hka, seriesId: "hka" }, { view: viewAt(sgp, 9930) }), [2776, "whole"])
})

test("a match that is on is joined, in whatever length the one before it was watched", () => {
  const live = { ...hka, live: true }
  for (const asked of ["all", "whole", "quick"] as const) assert.deepEqual(opening(live, { asked }), [0, "all"])
})

test("a page without a video plays nothing", () => {
  assert.equal(opening(matchOf(storyOf([]))), null)
})
