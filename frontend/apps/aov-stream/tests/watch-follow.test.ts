import assert from "node:assert/strict"
import { test } from "node:test"
import { cutsOf } from "../src/lib/watch-cuts.ts"
import { countAt, firstOf, played, startOf, stepOf, stopFrom, stopsOf } from "../src/lib/watch-follow.ts"
import { storyOf } from "../src/lib/watch-story.ts"
import type { Cut, Piece, WatchLength } from "../src/lib/watch-types.ts"
import {
  BRU_EA,
  FPL_1S,
  HKA_LIT,
  SGP_BME,
  UNTIMED,
  UNTIMED_MIDDLE,
  watchGames,
  type TestGame,
} from "./fixtures/watch.ts"

const of = (games: TestGame[], bestOf = 7) => storyOf(watchGames(games, bestOf))
const video = "j8AvYygkzm4"
const sgp = of(SGP_BME)
const cuts = cutsOf(sgp)
const bru = of(BRU_EA)
const bruCuts = cutsOf(bru)
const fpl = of(FPL_1S, 5)
const hka = of(HKA_LIT, 5)
const plain = of(UNTIMED, 5)
const cutOf = (length: WatchLength) => (length === "all" ? null : cuts[length])
const step = (length: WatchLength, before: number, after: number, stay: number | null = null) =>
  stepOf(cutOf(length), length, video, before, after, 1, stay)
const go = (second: number) => ({ kind: "GO", video, second })
/** A cut of pieces that are made by hand. */
const cutOfPieces = (...pieces: [from: number, to: number][]): Cut => ({
  pieces: pieces.map(([from, to]): Piece => ({ chapter: 0, video, from, to, lead: 0, hold: false })),
  seconds: 0,
  offered: true,
})

test("the video came there by playing when it moved on a little", () => {
  assert.equal(played(10, 10.25, 1), true)
  assert.equal(played(10, 12.5, 1), true)
  assert.equal(played(10, 12.6, 1), false)
})

test("a faster video moves on further by playing, and a slower one as far as any", () => {
  assert.equal(played(10, 14, 2), true)
  assert.equal(played(10, 12, 0.5), true)
})

test("a video that stands still or goes back has not played", () => {
  assert.equal(played(10, 10, 1), false)
  assert.equal(played(10, 9, 1), false)
})

test("at the end of a piece the video goes on to the next one", () => {
  assert.deepEqual(step("whole", 989.8, 990.05), go(1541))
  assert.deepEqual(step("whole", 2443.8, 2444.05), go(3149))
  assert.deepEqual(step("games", 2443.8, 2444.05), go(3713))
  assert.deepEqual(step("quick", 978.9, 979.1), go(1795))
})

test("a seek past the end of a piece moves nothing", () => {
  assert.equal(step("whole", 2400, 2500), null)
})

test("a piece that begins within a second of the one before it is played on into", () => {
  const step = (cut: Cut) => stepOf(cut, "whole", video, 99.9, 100.1, 1, null)
  assert.equal(step(cutOfPieces([0, 100], [101, 200])), null)
  assert.deepEqual(step(cutOfPieces([0, 100], [102, 200])), go(102))
})

test("a piece the video has not been in is not left", () => {
  const step = (before: number) => stepOf(cutOfPieces([100, 101], [200, 210]), "whole", video, before, 101, 1, null)
  assert.equal(step(98.6), null)
  assert.deepEqual(step(99.2), go(200))
})

test("who stayed is left alone at the end of that piece only", () => {
  assert.equal(step("whole", 2443.8, 2444.05, 2444), null)
  assert.deepEqual(step("whole", 4534.8, 4535.05, 2444), go(5358))
})

test("a draft that the game follows at once is not left", () => {
  assert.equal(step("whole", 5874.9, 5875.1), null)
})

test("after its last piece the short cut pauses", () => {
  assert.deepEqual(step("quick", 12239.9, 12240.1), { kind: "PAUSE" })
})

test("after the last piece of the match, or of its games, the video plays on", () => {
  assert.equal(step("whole", 12248.9, 12249.1), null)
  assert.equal(step("games", 12248.9, 12249.1), null)
})

test("the whole video moves nothing", () => {
  assert.equal(stepOf(null, "all", video, 989.8, 990.05, 1, null), null)
  assert.equal(stepOf(cuts.whole, "all", video, 989.8, 990.05, 1, null), null)
})

test("a pause is left for the end of it", () => {
  const [own] = bru.videos
  assert.deepEqual(stepOf(bruCuts.whole, "whole", own!, 41785.8, 41786.05, 1, null), {
    kind: "GO",
    video: own,
    second: 41955,
  })
})

test("a stretch with an untimed game at the end of a match is watched", () => {
  assert.equal(stepOf(bruCuts.whole, "whole", bru.videos[0]!, 42742.9, 42743.1, 1, null), null)
  assert.equal(countAt(bruCuts.whole, "whole", bru.videos[0]!, 42740, 1, null), null)
})

test("a stretch with an untimed game between two others is watched", () => {
  const { whole } = cutsOf(of(UNTIMED_MIDDLE))
  assert.equal(stepOf(whole, "whole", video, 2443.9, 2444.1, 1, null), null)
})

test("nothing is counted before a stretch with an untimed game between two others", () => {
  const { whole } = cutsOf(of(UNTIMED_MIDDLE))
  assert.equal(countAt(whole, "whole", video, 2440, 1, null), null)
})

test("a piece of another video is gone on to", () => {
  const story = of([SGP_BME[0]!, { ...SGP_BME[1]!, link: "https://youtu.be/IHQBJayxnLM" }])
  assert.deepEqual(stepOf(cutsOf(story).whole, "whole", video, 2443.8, 2444.05, 1, null), {
    kind: "GO",
    video: "IHQBJayxnLM",
    second: 3149,
  })
})

test("a break and a wait are counted from 10 and a pause from 5", () => {
  const count = (second: number) => {
    const found = countAt(cuts.whole, "whole", video, second, 1, null)
    return found && [found.seconds, found.of, found.until, found.next.from]
  }
  assert.equal(count(979.9), null)
  assert.deepEqual(count(980), [10, 10, 990, 1541])
  assert.deepEqual(count(989.5), [1, 10, 990, 1541])
  assert.deepEqual(count(4525), [10, 10, 4535, 5358])
  assert.equal(count(4535), null)
  const paused = countAt(bruCuts.whole, "whole", bru.videos[0]!, 41782, 1, null)!
  assert.deepEqual([paused.seconds, paused.of, paused.until, paused.next.from], [4, 5, 41786, 41955])
})

test("a speed of two counts in half the time", () => {
  assert.equal(countAt(cuts.whole, "whole", video, 4525, 2, null)!.seconds, 5)
})

test("nothing is counted before a game that follows at once", () => {
  assert.equal(countAt(cuts.whole, "whole", video, 5870, 1, null), null)
})

test("nothing is counted after a stay", () => {
  assert.equal(countAt(cuts.whole, "whole", video, 4530, 1, 4535), null)
})

test("nothing is counted at the end of the last piece", () => {
  assert.equal(countAt(cuts.whole, "whole", video, 12245, 1, null), null)
})

test("nothing is counted in the short cut, nor in the whole video", () => {
  assert.equal(countAt(cuts.quick, "quick", video, 975, 1, null), null)
  assert.equal(countAt(null, "all", video, 4530, 1, null), null)
})

test("the steps go through the turns and the rows of a match", () => {
  const stops = (length: WatchLength) => stopsOf(sgp, cuts, length)
  assert.equal(stops("whole").length, 163)
  assert.equal(stops("all").length, 163)
  assert.equal(stops("games").length, 69)
  assert.equal(stops("quick").length, 22)
  for (const length of ["whole", "games", "quick"] as const)
    stops(length).forEach((stop, index, all) => assert.ok(!index || stop.second > all[index - 1]!.second))
})

test("a step leads to the stop before or after a place", () => {
  const from = (length: WatchLength, way: 1 | -1, second = 4228) =>
    stopFrom(stopsOf(sgp, cuts, length), sgp, video, second, way)?.second
  assert.equal(from("whole", -1), 4211)
  assert.equal(from("whole", 1), 4275)
  assert.equal(from("games", -1), 4211)
  assert.equal(from("games", 1), 4275)
  assert.equal(from("quick", -1), 4217)
  assert.equal(from("quick", 1), 4474)
})

test("a step back passes the stop that began just now", () => {
  const stops = stopsOf(sgp, cuts, "whole")
  const back = (second: number) => stopFrom(stops, sgp, video, second, -1)!.second
  assert.equal(back(4215), 4127)
  assert.equal(back(4216), 4211)
})

test("a step on passes the stop that is about to come", () => {
  const stops = stopsOf(sgp, cuts, "whole")
  const on = (second: number) => stopFrom(stops, sgp, video, second, 1)!.second
  assert.equal(on(4272), 4275)
  assert.equal(on(4273), 4363)
})

test("there is no step before the first stop or after the last", () => {
  const stops = stopsOf(sgp, cuts, "whole")
  assert.equal(stopFrom(stops, sgp, video, 663, -1), null)
  assert.equal(stopFrom(stops, sgp, video, 13000, 1), null)
})

test("the steps go on into another video", () => {
  const other = "IHQBJayxnLM"
  const story = of([SGP_BME[0]!, { ...SGP_BME[1]!, link: `https://youtu.be/${other}` }])
  const stops = stopsOf(story, cutsOf(story), "games")
  assert.deepEqual(stopFrom(stops, story, video, 2440, 1), { video: other, second: 3713, chapter: 1 })
  assert.equal(stopFrom(stops, story, other, 3714, -1)!.video, video)
})

test("a linked match steps from game to game", () => {
  assert.deepEqual(
    stopsOf(hka, cutsOf(hka), "whole").map(({ second }) => second),
    [2776, 5869, 8548, 10563, 12503],
  )
})

test("a match without times has no steps", () => {
  assert.equal(stopsOf(plain, cutsOf(plain), "whole").length, 0)
})

test("a game begins at its draft, at 0:00 or at its first piece, as the length asks", () => {
  const starts = (length: WatchLength) => sgp.chapters.map((chapter) => startOf(chapter, cuts, length)).join(" ")
  assert.equal(starts("whole"), "662 3149 5358 7035 8777 11234")
  assert.equal(starts("all"), "662 3149 5358 7035 8777 11234")
  assert.equal(starts("games"), "1541 3713 5870 7485 9270 11612")
  assert.equal(starts("quick"), "967 3482 5803 7392 9199 11538")
})

test("a game without a time begins where the stretch does that holds it", () => {
  assert.equal(startOf(bru.chapters[5]!, bruCuts, "whole"), 42743)
  assert.equal(startOf(fpl.chapters[0]!, cutsOf(fpl), "whole"), 0)
  assert.equal(startOf(hka.chapters[2]!, cutsOf(hka), "whole"), 8548)
  assert.equal(startOf(plain.chapters[0]!, cutsOf(plain), "whole"), null)
})

test("a match begins at the first second of its length", () => {
  const first = (length: WatchLength) => firstOf(sgp, cuts, length)?.second
  assert.deepEqual([first("whole"), first("all"), first("games"), first("quick")], [662, 662, 1541, 967])
  assert.deepEqual(firstOf(bru, bruCuts, "whole"), { video: bru.videos[0], second: 31139 })
})

test("a linked match begins with its first game, in every length", () => {
  for (const length of ["whole", "games"] as const)
    assert.deepEqual(firstOf(hka, cutsOf(hka), length), { video: hka.videos[0], second: 2776 })
})

test("a match whose first game has no time begins with it", () => {
  assert.equal(firstOf(fpl, cutsOf(fpl), "whole")!.second, 0)
})

test("a match whose first game has no time begins at most an hour before the next", () => {
  const late = of([{ ...FPL_1S[0]! }, { ...FPL_1S[1]!, zero: 9000, draft: [8400, 8900] }])
  assert.equal(firstOf(late, cutsOf(late), "whole")!.second, 4795)
})

test("only the games of a match begin with the first that is timed", () => {
  assert.equal(firstOf(fpl, cutsOf(fpl), "games")!.second, 2987)
})

test("a match without times begins where its video does", () => {
  assert.deepEqual(firstOf(plain, cutsOf(plain), "whole"), { video: "WgQTfXMV13A", second: 0 })
})

test("a match without games begins where the video of its link does", () => {
  const link = storyOf([], "https://youtu.be/j8AvYygkzm4")
  assert.deepEqual(firstOf(link, cutsOf(link), "whole"), { video, second: 0 })
})

test("a match without a video begins nowhere", () => {
  const none = storyOf([])
  assert.equal(firstOf(none, cutsOf(none), "whole"), null)
})

test("a match of which only the second of a link is known begins there", () => {
  const story = of([{ ...UNTIMED[0]!, seconds: null, zero: 500, link: "https://youtu.be/j8AvYygkzm4?t=480" }])
  assert.equal(story.level, "PLAIN")
  assert.deepEqual(firstOf(story, cutsOf(story), "whole"), { video, second: 480 })
})

test("a match whose first game has no video begins with the first that has one", () => {
  const second = { ...UNTIMED[1]!, seconds: null, zero: 500, link: "https://youtu.be/j8AvYygkzm4?t=480" }
  const story = of([{ ...UNTIMED[0]!, link: "" }, second])
  assert.deepEqual(firstOf(story, cutsOf(story), "whole"), { video, second: 480 })
})
