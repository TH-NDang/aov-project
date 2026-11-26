import assert from "node:assert/strict"
import { test } from "node:test"
import { scoreAt } from "../src/lib/watch-place.ts"
import { SGP_BME, watchMatch } from "./fixtures/watch.ts"
import {
  apart,
  first,
  heldVideos,
  middle,
  other,
  plain,
  sgp,
  stand,
  twoVideos,
  unknown,
  video,
} from "./fixtures/watch-stand.ts"

// ---------- counts, and what comes after them

test("a wait after the lock is counted from 10 and skipped to 5 s before 0:00", () => {
  const s = stand()
  s.open(sgp, 975)
  s.pass(5.25)
  assert.equal(s.view().count!.seconds, 10)
  s.pass(6)
  assert.equal(s.view().count!.seconds, 4)
  s.pass(4)
  assert.equal(s.last(), "seek 1541")
  assert.equal(s.view().second, 1541)
})

test("the score of a game is told 3 s after its end", () => {
  const s = stand()
  s.open(sgp, 4515)
  s.pass(7)
  assert.equal(s.view().place!.state, "PLAY")
  s.pass(1.5)
  assert.equal(s.view().place!.state, "BREAK")
  assert.deepEqual(scoreAt(sgp, s.view().place), { A: 1, B: 1 })
})

test("the break after a game is counted from 10 and skipped", () => {
  const s = stand()
  s.open(sgp, 4520)
  s.pass(5.25)
  assert.equal(s.view().count!.seconds, 10)
  s.pass(10)
  assert.equal(s.last(), "seek 5358")
  assert.equal(s.view().place!.chapter!.number, 3)
})

test("the whole video skips nothing", () => {
  const s = stand()
  s.open(sgp, 985, "all")
  s.pass(30)
  assert.equal(s.log.length, 1)
  assert.equal(s.view().count, null)
})

test("a game without a time that stands between two others is watched, and not skipped", () => {
  const s = stand()
  s.open(middle, 2430)
  s.pass(60)
  assert.deepEqual(s.seeks(), [])
  assert.equal(s.view().place!.state, "SPAN")
})

test("nothing is counted before a game without a time", () => {
  const s = stand()
  s.open(middle, 2432)
  s.pass(6)
  assert.equal(s.view().count, null)
})

test("a speed of two counts in half the time", () => {
  const s = stand()
  s.open(sgp, 4520)
  s.player.speed = 2
  s.pass(3)
  assert.equal(s.view().count!.seconds, 5)
})

test("pausing holds a count", () => {
  const s = stand()
  s.open(sgp, 4526)
  s.pass(2)
  s.watch.toggle()
  assert.equal(s.view().count!.seconds, 7)
  s.pass(30)
  assert.equal(s.view().count!.seconds, 7)
  assert.deepEqual(s.seeks(), [])
})

test("a seek by hand into a break does not throw the viewer out of it", () => {
  const s = stand()
  s.open(sgp, 4400)
  s.pass(2)
  s.player.second = 4900
  s.pass(20)
  assert.deepEqual(s.seeks(), [])
  assert.equal(s.view().place!.state, "BREAK")
  assert.equal(s.view().count, null)
})

test("the quick cut jumps from piece to piece without a count", () => {
  const s = stand()
  s.open(sgp, first(sgp, "quick").second, "quick")
  s.pass(12.25)
  assert.equal(s.last(), "seek 1795")
  assert.equal(s.view().count, null)
})

test("the quick cut stops after its last piece", () => {
  const s = stand()
  s.open(sgp, 12236, "quick")
  s.pass(6)
  assert.equal(s.last(), "pause")
  assert.equal(s.view().place!.state, "AFTER")
})

test("the quick cut ends the match, however little of its end was played", () => {
  const s = stand()
  s.open(sgp, 12238, "quick")
  s.pass(2.25)
  assert.equal(s.last(), "pause")
  assert.equal(s.view().done, true)
})

test("a quick cut that has ended is remembered as seen", () => {
  const s = stand()
  s.open(sgp, 12238, "quick")
  s.pass(2.25)
  assert.equal(s.saved().matches[0][1].done, true)
})

// ---------- staying

test("staying plays the break in full", () => {
  const s = stand()
  s.open(sgp, 4520)
  s.pass(8)
  s.watch.stay()
  assert.equal(s.view().count, null)
  s.pass(60)
  assert.deepEqual(s.seeks(), [])
  assert.equal(s.view().place!.state, "BREAK")
})

test("after a stay the next break is counted again", () => {
  const s = stand()
  s.open(sgp, 4520)
  s.pass(8)
  s.watch.stay()
  s.pass(60)
  s.player.second = 6470
  s.pass(8)
  assert.equal(s.view().count!.until, 6486)
})

test("asking to stay once more changes nothing", () => {
  const s = stand()
  s.open(sgp, 4526)
  s.pass(1)
  s.watch.stay()
  s.watch.stay()
  s.pass(4)
  assert.equal(s.view().count, null)
})

test("a seek ends a stay", () => {
  const s = stand()
  s.open(sgp, 4526)
  s.pass(1)
  s.watch.stay()
  s.watch.seekBy(-5)
  s.pass(4)
  assert.equal(s.view().count!.of, 10)
})

test("a hand on YouTube's bar that goes back ends a stay", () => {
  const s = stand()
  s.open(sgp, 4530)
  s.pass(1)
  s.watch.stay()
  s.read(4528)
  s.pass(1)
  assert.equal(s.view().count!.until, 4535)
})

test("a hand on YouTube's bar that goes on ends a stay", () => {
  const s = stand()
  s.open(sgp, 4526)
  s.pass(1)
  s.watch.stay()
  s.read(4531)
  s.pass(1)
  assert.equal(s.view().count!.until, 4535)
})

test("a video that stood still and falls back by less than a second is still stayed with", () => {
  for (const back of [0.06, 0.2, 0.9]) {
    const s = stand()
    s.open(sgp, 4526)
    s.pass(1)
    s.watch.stay()
    s.pass(2)
    s.read(s.player.second - back)
    s.pass(20)
    assert.deepEqual(s.seeks(), [], `after a step back of ${back} s`)
    assert.equal(s.view().count, null)
  }
})

test("a pause does not end a stay", () => {
  const s = stand()
  s.open(sgp, 4526)
  s.pass(1)
  s.watch.stay()
  s.watch.toggle()
  s.pass(5)
  s.watch.toggle()
  s.pass(4)
  assert.equal(s.view().count, null)
})

test("a stay ends with its player", () => {
  const s = stand()
  s.open(sgp, 4526)
  s.pass(1)
  s.watch.stay()
  s.fails("FAILED")
  s.watch.retry()
  s.reports("PLAYING")
  s.pass(2)
  assert.equal(s.view().count!.until, 4535)
})

// ---------- what has been reached

test("what has been reached grows after 3 s of play", () => {
  const s = stand()
  s.open(sgp, 1600)
  s.pass(2)
  assert.equal(s.view().reached, 0)
  s.pass(2)
  assert.equal(s.view().reached, 391)
})

test("what has been reached does not grow by a press", () => {
  const s = stand()
  s.open(sgp, 1600)
  s.pass(4)
  s.watch.go({ video, second: 12000 })
  s.pass(2)
  assert.equal(s.view().reached, 391)
})

test("what has been reached does not grow by a hand on YouTube's bar", () => {
  const s = stand()
  s.open(sgp, 1600)
  s.pass(4)
  s.read(12000)
  s.pass(2)
  assert.equal(s.view().reached, 391)
})

test("what has been reached stays reached where the viewer goes back", () => {
  const s = stand()
  s.open(sgp, 4228)
  s.pass(4)
  const { reached } = s.view()
  s.watch.go({ video, second: 1700 })
  s.pass(8)
  assert.equal(s.view().reached, reached)
})

test("a video that stood still goes on being reached", () => {
  const s = stand()
  s.open(sgp, 1600)
  s.pass(4)
  s.read(s.player.second - 0.2)
  s.pass(1)
  assert.equal(s.view().reached, 391)
  s.pass(1)
  assert.equal(s.view().reached, 392)
})

test("a video that the story does not know moves nothing of what has been reached", () => {
  const s = stand()
  s.open(unknown, 1600)
  s.pass(4)
  s.watch.choose(1)
  assert.equal(s.last(), `load ${other} 0`)
  s.read(900)
  s.pass(20)
  assert.equal(s.view().place!.state, "UNKNOWN")
  assert.equal(s.view().reached, 391)
})

test("a video without times only tells that it was begun", () => {
  const s = stand()
  s.open(plain, 4000)
  s.pass(40)
  assert.equal(s.view().reached, 30)
})

test("a video without times is not begun in its first half minute", () => {
  const s = stand()
  s.open(plain, 8)
  s.pass(12)
  assert.equal(s.view().reached, 20)
})

test("a stream whose first game is timed later tells nothing of it that has not been seen", () => {
  const s = stand()
  s.open({ ...watchMatch([], 0), story: { ...plain.story, videos: [video] }, live: true, seriesId: "sgp" }, 2000, "all")
  s.pass(10)
  const timed = watchMatch(SGP_BME.slice(0, 1), 7, { seriesId: "sgp", live: true, finished: false })
  s.watch.update(timed)
  assert.equal(s.view().place!.state, "PLAY")
  assert.equal(s.view().reached, 30)
})

// ---------- the end

test("the end of the match is told to have been watched", () => {
  const s = stand()
  s.open(sgp, 12230)
  s.pass(8)
  assert.equal(s.view().place!.state, "AFTER")
  assert.equal(s.view().done, true)
})

test("the end of a match that was gone to is not told to have been watched", () => {
  const s = stand()
  s.open(sgp, 12300)
  s.pass(2)
  assert.equal(s.view().place!.state, "AFTER")
  assert.equal(s.view().done, false)
})

test("the end of the match is written down once, and then as any other place", () => {
  const s = stand()
  s.open(sgp, 12230)
  s.pass(8)
  const before = s.wrote.length
  s.pass(4)
  assert.ok(s.wrote.length - before <= 1, `${s.wrote.length - before} times in 4 s`)
})

test("going back from the end is remembered as a place of the match", () => {
  const s = stand()
  s.open(sgp, 12230)
  s.pass(8)
  s.watch.go({ video, second: 6208 })
  s.pass(6)
  assert.equal(s.watch.remembered("sgp")!.done, false)
})

test("a hand on YouTube's bar that goes back from the end is remembered as a place of the match", () => {
  const s = stand()
  s.open(sgp, 12230)
  s.pass(8)
  s.read(6208)
  s.pass(6)
  assert.equal(s.watch.remembered("sgp")!.done, false)
})

test("a video that stood still at the end is remembered as seen", () => {
  const s = stand()
  s.open(sgp, 12230)
  s.pass(8)
  s.read(s.player.second - 0.06)
  s.watch.close()
  assert.equal(s.watch.remembered("sgp")!.done, true)
})

test("what was told stays told where the viewer goes back from the end", () => {
  const s = stand()
  s.open(sgp, 12230)
  s.pass(8)
  s.watch.go({ video, second: 6208 })
  s.pass(6)
  assert.equal(s.view().done, true)
})

test("an end that is come to once more is remembered again", () => {
  const s = stand()
  s.open(sgp, 12230)
  s.pass(8)
  s.watch.go({ video, second: 6208 })
  s.pass(6)
  s.read(12230)
  s.pass(8)
  assert.equal(s.watch.remembered("sgp")!.done, true)
})

test("the end of the video is told to have been watched", () => {
  const s = stand()
  s.open(plain, 5000)
  s.pass(4)
  s.reports("ENDED")
  assert.equal(s.view().done, true)
  assert.equal(s.watch.remembered("plain")!.done, true)
})

test("a video that ends before its piece does goes on with the next video of the match", () => {
  const s = stand()
  s.open(apart, 2430)
  s.pass(4)
  s.reports("ENDED")
  assert.equal(s.last(), `load ${other} 3149`)
  assert.equal(s.view().done, false)
})

test("a video that ends after its viewer chose to stay is left there", () => {
  const s = stand()
  s.open(apart, 2436)
  s.pass(1)
  s.watch.stay()
  s.pass(20)
  s.reports("ENDED")
  assert.equal(s.log.length, 1)
})

test("the end of a video that is not the last of its match does not end the match", () => {
  const s = stand()
  s.open(apart, 2436)
  s.pass(1)
  s.watch.stay()
  s.pass(20)
  s.reports("ENDED")
  assert.equal(s.view().done, false)
})

test("the end of the last video of a match ends the match", () => {
  const s = stand()
  s.open(apart, 700)
  s.watch.go({ video: other, second: 4400 })
  s.pass(4)
  s.reports("ENDED")
  assert.equal(s.view().done, true)
})

test("a video that ends where an untimed game stands is not gone on from", () => {
  const s = stand()
  s.open(heldVideos, 2436)
  s.pass(20)
  s.reports("ENDED")
  assert.equal(s.log.length, 1)
  assert.equal(s.view().done, false)
})

test("a video that ends in the middle of its games is not gone on from", () => {
  const s = stand()
  s.open(twoVideos, 1600)
  s.pass(4)
  s.reports("ENDED")
  assert.equal(s.log.length, 1)
})

test("a video that ends is never gone on from within itself", () => {
  const s = stand()
  s.open(sgp, 2400)
  s.pass(4)
  s.reports("ENDED")
  assert.equal(s.log.length, 1)
})

test("an address past the end of a video does not count as having seen it", () => {
  const s = stand()
  s.open(sgp, 99999)
  s.player.playing = false
  s.player.second = 13504
  s.reports("ENDED")
  s.pass(1)
  assert.equal(s.view().done, false)
  assert.equal(s.view().second, 13504)
})

test("playing after the end begins the length again", () => {
  const s = stand()
  s.open(sgp, 13400)
  s.pass(1)
  s.reports("ENDED")
  s.watch.toggle()
  assert.equal(s.last(), "seek 662")
  assert.equal(s.player.playing, true)
})
