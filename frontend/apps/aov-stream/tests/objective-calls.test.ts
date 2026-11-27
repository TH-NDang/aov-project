import assert from "node:assert/strict"
import { test } from "node:test"
import { callAt, readingOf, type ClockReading } from "../src/lib/objective-calls.ts"
import type { Place } from "../src/lib/watch-types.ts"

const calls = [
  { seconds: 120, labels: ["Caesar xuất hiện", "Rồng tiến hóa"], glyph: "CAESAR" as const },
  { seconds: 480, labels: ["Caesar tiến hóa"], glyph: "CAESAR" as const },
]
const at = (clock: number, chapter = 0): ClockReading => ({ chapter, clock })

test("a call comes when the clock plays past its time, once", () => {
  assert.equal(callAt(calls, at(119.5), at(120.25))?.seconds, 120)
  assert.equal(callAt(calls, at(120.25), at(121)), null)
  assert.equal(callAt(calls, at(479), at(481))?.labels[0], "Caesar tiến hóa")
})

test("a jump, another game, a pause or a step back calls nothing", () => {
  assert.equal(callAt(calls, at(60), at(130)), null)
  assert.equal(callAt(calls, at(119, 0), at(121, 1)), null)
  assert.equal(callAt(calls, null, at(121)), null)
  assert.equal(callAt(calls, at(121), at(119)), null)
})

test("only a game being played has a reading", () => {
  const chapter = { index: 2 } as Extract<Place, { state: "PLAY" }>["chapter"]
  const play = { state: "PLAY", chapter, next: null, clock: 75, left: null, over: false } as Place
  const pause = { state: "PAUSE", chapter, next: null, clock: 75, left: 30, over: false } as Place
  assert.deepEqual(readingOf(play), { chapter: 2, clock: 75 })
  assert.equal(readingOf(pause), null)
  assert.equal(readingOf(null), null)
})
