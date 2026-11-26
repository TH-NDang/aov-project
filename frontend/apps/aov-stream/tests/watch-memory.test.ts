import assert from "node:assert/strict"
import { test } from "node:test"
import {
  BEGUN,
  readMemory,
  remember,
  resumeOf,
  stopIn,
  type WatchMemory,
  type WatchStop,
} from "../src/lib/watch-memory.ts"
import { told } from "../src/lib/watch-place.ts"
import type { WatchMatch } from "../src/lib/watch-types.ts"
import { BRU_EA, FPL_1S, HKA_LIT, SGP_BME, UNTIMED, watchMatch } from "./fixtures/watch.ts"

const FRESH: WatchMemory = { length: "whole", keys: true, matches: [] }
const sgp = watchMatch(SGP_BME, 7)
const fpl = watchMatch(FPL_1S, 5)
const bru = watchMatch(BRU_EA, 7)
const plain = watchMatch(UNTIMED, 5)
const stopAt = (second: number, known: Partial<WatchStop> = {}, match: WatchMatch = sgp): WatchStop => ({
  video: match.story.videos[0]!,
  second,
  length: "whole",
  reached: 3000,
  done: false,
  ...known,
})
const resume = (second: number, known: Partial<WatchStop> = {}, match: WatchMatch = sgp) =>
  resumeOf(match, stopAt(second, known, match))?.second ?? null

test("what is remembered is read again", () => {
  const memory: WatchMemory = { length: "games", keys: false, matches: [["s1", stopAt(6208)]] }
  assert.deepEqual(readMemory(JSON.stringify(memory)), memory)
  assert.deepEqual(stopIn(memory, "s1"), stopAt(6208))
  assert.equal(stopIn(memory, "s2"), null)
})

test("broken memory starts afresh", () => {
  for (const text of [null, "", "{broken", "null", "5", "[]", '"text"', '{"length":"quick","matches":{}}'])
    assert.deepEqual(readMemory(text), FRESH)
})

test("a stop that cannot be read is left out, and the others are kept", () => {
  const { matches } = readMemory(
    JSON.stringify({
      matches: [
        ["s1", { video: 5, second: 1, reached: 1 }],
        ["s2", { video: "v", second: "1", reached: 1 }],
        ["s3", null],
        "s4",
        [7, stopAt(1)],
        ["s5", { video: "v", second: 12.7, reached: 40, length: "fast", done: 1 }],
      ],
    }),
  )
  assert.deepEqual(matches, [["s5", { video: "v", second: 12, length: "whole", reached: 40, done: false }]])
})

test("a second before the video is read as its first", () => {
  const { matches } = readMemory(JSON.stringify({ matches: [["s1", stopAt(-5)]] }))
  assert.equal(matches[0]![1].second, 0)
})

test("a second there is not is none", () => {
  const { matches } = readMemory('{"matches":[["s1",{"video":"v","second":1e999,"reached":1}]]}')
  assert.deepEqual(matches, [])
})

test("of more than sixty matches that were kept the newest are read", () => {
  const all = Array.from({ length: 70 }, (_, index) => [`s${index}`, stopAt(index)])
  const { matches } = readMemory(JSON.stringify({ matches: all }))
  assert.deepEqual([matches.length, matches[0]![0]], [60, "s10"])
})

test("sixty matches are kept, the newest last", () => {
  let memory = FRESH
  for (let index = 0; index < 70; index++) memory = remember(memory, `s${index}`, stopAt(index))
  assert.equal(memory.matches.length, 60)
  assert.equal(memory.matches[0]![0], "s10")
  assert.equal(memory.matches.at(-1)![0], "s69")
})

test("a match watched again becomes the newest", () => {
  const memory = remember(remember(remember(FRESH, "s1", stopAt(1)), "s2", stopAt(2)), "s1", stopAt(3))
  assert.deepEqual(
    memory.matches.map(([id, stop]) => `${id} ${stop.second}`),
    ["s2 2", "s1 3"],
  )
})

test("a match is gone on with where it was left", () => {
  assert.deepEqual(resumeOf(sgp, stopAt(6208, { length: "games" })), {
    video: "j8AvYygkzm4",
    second: 6208,
    length: "games",
  })
})

test("from a break a match is gone on with at the next game", () => {
  assert.equal(resume(4900), 5358)
  assert.equal(resume(4900, { length: "games" }), 5870)
  assert.equal(resume(4900, { length: "quick" }), 5803)
})

test("a break that nothing timed follows is gone on with", () => {
  assert.equal(resume(42735, {}, bru), 42735)
})

test("a match starts afresh after its end", () => {
  assert.equal(resume(12300), null)
  assert.equal(resume(6208, { done: true }), null)
})

test("a match starts afresh from its first half minute", () => {
  assert.equal(resume(680, { reached: 18 }), null)
  assert.equal(resume(691), null)
  assert.equal(resume(692), 692)
})

test("a place nobody has played to is not gone on with", () => {
  assert.equal(resume(6208, { reached: 0 }), null)
})

test("the first half minute of a match that begins with an untimed game is counted in its video", () => {
  assert.equal(resume(20, { reached: 0 }, fpl), null)
  assert.equal(resume(1200, { reached: 0 }, fpl), 1200)
})

test("the first half minute of an untimed game is counted from where its stretch is entered", () => {
  const late = watchMatch([FPL_1S[0]!, { ...FPL_1S[1]!, zero: 9000, draft: [8400, 8900] }], 5)
  assert.equal(resume(4800, { reached: 0 }, late), null)
  assert.equal(resume(4825, { reached: 0 }, late), 4825)
})

test("a video without times is gone on with as it is", () => {
  assert.deepEqual(resumeOf(plain, stopAt(6400, { reached: BEGUN }, plain)), {
    video: "WgQTfXMV13A",
    second: 6400,
    length: "all",
  })
})

test("a video without times that has hardly begun starts afresh", () => {
  assert.equal(resume(20, { reached: 20 }, plain), null)
})

test("a match whose games were timed after it was watched is gone on with, and tells none of them", () => {
  const stop = stopAt(4030, { length: "all", reached: BEGUN })
  assert.equal(resumeOf(sgp, stop)!.second, 4030)
  for (const chapter of sgp.story.chapters) assert.equal(told(sgp.story, chapter, stop.reached, stop.done), false)
})

test("a linked match is gone on with by the second of its video", () => {
  const hka = watchMatch(HKA_LIT, 5)
  assert.equal(resume(6400, { reached: 1800 }, hka), 6400)
})

test("a game whose video the story does not know is gone on with by its second", () => {
  const unknown = watchMatch([SGP_BME[0]!, { ...SGP_BME[1]!, zero: null, link: "https://youtu.be/IHQBJayxnLM" }], 3)
  assert.equal(resume(900, { video: "IHQBJayxnLM", reached: 0 }, unknown), 900)
  assert.equal(resume(12, { video: "IHQBJayxnLM", reached: 0 }, unknown), null)
})

test("a match whose video has changed starts afresh", () => {
  assert.equal(resume(6208, { video: "xxxxxxxxxxx" }), null)
  assert.equal(resumeOf(sgp, null), null)
})
