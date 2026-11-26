import assert from "node:assert/strict"
import { test } from "node:test"
import { readWatch, shareOf, targetOf, watchHref } from "../src/lib/watch-routes.ts"
import { storyOf } from "../src/lib/watch-story.ts"
import type { WatchLength, WatchMatch } from "../src/lib/watch-types.ts"
import { BRU_EA, HKA_LIT, matchOf, SGP_BME, UNTIMED, viewAt, watchMatch } from "./fixtures/watch.ts"

const sgp = watchMatch(SGP_BME, 7)
const hka = watchMatch(HKA_LIT, 5)
const plain = watchMatch(UNTIMED, 5)
const video = "j8AvYygkzm4"
const target = (search: string, match: WatchMatch = sgp, length: WatchLength = "whole") =>
  targetOf(match, readWatch(search), length)
const copied = (second: number, match: WatchMatch = sgp) => watchHref("s", shareOf(viewAt(match, second)))

test("an address names a game, a second of it, or a second of the video", () => {
  assert.equal(watchHref("s"), "/matches/s")
  assert.equal(watchHref("s", { game: 3 }), "/matches/s?game=3")
  assert.equal(watchHref("s", { game: 3, at: 333.4 }), "/matches/s?game=3&at=333")
  assert.equal(watchHref("s", { game: 3, at: -120 }), "/matches/s?game=3&at=-120")
  assert.equal(watchHref("s", { second: 4000.9 }), "/matches/s?second=4000")
  assert.equal(watchHref("s", { game: null, second: 12 }), "/matches/s?second=12")
})

test("the second of a game takes the place of that of its video", () => {
  assert.equal(watchHref("s", { game: 3, at: 333, second: 6208 }), "/matches/s?game=3&at=333")
})

test("the name of a match is written so that it can stand in an address", () => {
  assert.equal(watchHref("a/b c"), "/matches/a%2Fb%20c")
})

test("a second of a game that no game is named for gives way to that of the video", () => {
  assert.deepEqual(readWatch("?at=5&second=40"), { game: null, at: null, second: 40 })
})

test("an address is read as it was written", () => {
  assert.deepEqual(readWatch("?game=3&at=333"), { game: 3, at: 333, second: null })
  assert.deepEqual(readWatch("?game=3&at=-120"), { game: 3, at: -120, second: null })
  assert.deepEqual(readWatch("?game=3"), { game: 3, at: null, second: null })
  assert.deepEqual(readWatch("?second=4000"), { game: null, at: null, second: 4000 })
  assert.deepEqual(readWatch("?game=2&second=4000"), { game: 2, at: null, second: 4000 })
  assert.deepEqual(readWatch("?game=2&at=5&second=4000"), { game: 2, at: 5, second: null })
})

test("an address that names nothing is ignored", () => {
  for (const search of [
    "",
    "?game=x",
    "?at=5",
    "?game=0",
    "?game=-1",
    "?game=1e3",
    "?second=-4",
    "?second=1.5",
    "?tab=games",
  ])
    assert.equal(readWatch(search), null)
  assert.equal(target("?game=9"), null)
  assert.equal(targetOf(sgp, null, "whole"), null)
})

test("a second of a game is found in its video", () => {
  assert.deepEqual(target("?game=3&at=333"), { video, second: 6208, game: 3 })
  assert.deepEqual(target("?game=3&at=-120"), { video, second: 5755, game: 3 })
})

test("a second of a game stays within what is told of it", () => {
  assert.equal(target("?game=3&at=99999")!.second, 6471)
  assert.equal(target("?game=3&at=-99999")!.second, 5358)
})

test("a second of a game stands behind the pauses before it", () => {
  const bru = watchMatch(BRU_EA, 7)
  assert.equal(target("?game=5&at=721", bru)!.second, 41778)
  assert.equal(target("?game=5&at=722", bru)!.second, 41959)
})

test("a game alone begins where the length begins it", () => {
  assert.equal(target("?game=3")!.second, 5358)
  assert.equal(target("?game=3", sgp, "games")!.second, 5870)
  assert.equal(target("?game=3", sgp, "quick")!.second, 5803)
  assert.deepEqual(target("?game=3", hka), { video: "WgQTfXMV13A", second: 8548, game: 3 })
  assert.equal(target("?game=6", watchMatch(BRU_EA, 7))!.second, 42743)
})

test("a second of the video is taken as it is", () => {
  assert.deepEqual(target("?second=4000"), { video, second: 4000 })
  assert.deepEqual(target("?game=1&second=100"), { video, second: 100, game: 1 })
  assert.deepEqual(target("?second=900", plain), { video: "WgQTfXMV13A", second: 900 })
})

test("without a clock a game names its video, from its beginning", () => {
  assert.deepEqual(target("?game=3", plain), { video: "WgQTfXMV13A", second: 0, game: 3 })
  assert.deepEqual(target("?game=3&at=333", hka), { video: "WgQTfXMV13A", second: 8548, game: 3 })
})

test("without a clock a game whose link names a second begins there", () => {
  const link = "https://youtu.be/IHQBJayxnLM?t=480"
  const linked = watchMatch([UNTIMED[0]!, { ...UNTIMED[1]!, seconds: null, zero: 500, link }], 3)
  assert.deepEqual(target("?game=2", linked), { video: "IHQBJayxnLM", second: 480, game: 2 })
})

test("a game without a video is no place", () => {
  const silent = watchMatch([SGP_BME[0]!, { ...SGP_BME[1]!, link: "" }], 7)
  assert.equal(target("?game=2", silent), null)
})

test("a match without a video has no places", () => {
  assert.equal(target("?second=5", matchOf(storyOf([]))), null)
})

test("a copied link says the second of the game", () => {
  assert.equal(copied(6208), "/matches/s?game=3&at=333")
  assert.equal(copied(685), "/matches/s?game=1&at=-861")
  assert.equal(copied(1200), "/matches/s?game=1&at=-346")
  assert.equal(copied(41850, watchMatch(BRU_EA, 7)), "/matches/s?game=5&at=721")
})

test("a link copied between two games leads to the next one", () => {
  assert.equal(copied(300), "/matches/s?game=1")
  assert.equal(copied(4900), "/matches/s?game=3")
})

test("a link copied after the match leads to all of it", () => {
  assert.equal(copied(12300), "/matches/s")
})

test("a link copied where no clock is known says the second of the video", () => {
  assert.equal(copied(6400, hka), "/matches/s?game=2&second=6400")
  assert.equal(copied(42800, watchMatch(BRU_EA, 7)), "/matches/s?game=6&second=42800")
  assert.equal(watchHref("s", shareOf(viewAt(plain, 900, { chosen: 2 }))), "/matches/s?game=3&second=900")
  assert.equal(copied(900, matchOf(storyOf([], "https://youtu.be/j8AvYygkzm4"))), "/matches/s?second=900")
})

test("a link copied from a video names a game of that video", () => {
  const apart = watchMatch(
    UNTIMED.slice(0, 2).map((game, index) => ({ ...game, link: index ? "" : game.link })),
    3,
  )
  assert.equal(watchHref("s", shareOf(viewAt(apart, 900, { chosen: 1 }))), "/matches/s?game=1&second=900")
})

test("what is copied leads back to the place it was copied at", () => {
  for (const second of [700, 1300, 3400, 4228, 5900, 9930, 12000]) {
    const search = copied(second).split("?")[1]
    assert.equal(target(`?${search}`)!.second, second)
  }
})
