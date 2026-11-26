import assert from "node:assert/strict"
import { test } from "node:test"
import { SGP_BME, watchMatch } from "./fixtures/watch.ts"
import { apart, first, hka, onNow, other, plain, sgp, stand, video } from "./fixtures/watch-stand.ts"

// ---------- playing and pausing

test("play and pause take turns", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.watch.toggle()
  assert.equal(s.view().player, "PAUSED")
  s.watch.toggle()
  assert.equal(s.player.playing, true)
  assert.deepEqual(s.log, [`open ${video} 2000`, "pause"])
})

test("a video that waits for its data is paused by a press", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.reports("WAITING")
  s.watch.toggle()
  assert.equal(s.last(), "pause")
})

test("the sound is turned off and on", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.watch.mute()
  assert.equal(s.player.quiet, true)
  s.watch.mute()
  assert.equal(s.player.quiet, false)
})

test("the focus goes into the frame", () => {
  const s = stand()
  s.open(sgp, 2000)
  s.watch.focus()
  assert.equal(s.player.focused, 1)
})

test("a page left on a phone pauses", () => {
  const s = stand()
  s.open(sgp, 6208)
  s.watch.pause()
  assert.equal(s.last(), "pause")
  assert.equal(s.view().player, "PAUSED")
})

test("the next match is played by the player that was paused for the one before it", () => {
  const s = stand()
  s.open(sgp, 12236)
  s.watch.pause()
  s.watch.open(hka, first(hka, "whole"), "whole")
  assert.equal(s.player.made, 1)
  assert.equal(s.player.playing, true)
})

test("closing gives the player back", () => {
  const s = stand()
  s.open(sgp, 6150)
  s.watch.close()
  assert.equal(s.last(), "destroy")
})

test("after closing no time is read any more", () => {
  const s = stand()
  s.open(sgp, 6150)
  s.watch.close()
  assert.equal(s.ticking(), false)
})

test("after closing no match is open", () => {
  const s = stand()
  s.open(sgp, 6150)
  s.watch.close()
  assert.equal(s.view().match, null)
  assert.equal(s.view().player, "CLOSED")
})

test("a late word of a player that was closed is not heard", () => {
  const s = stand()
  s.watch.open(sgp, { video, second: 700 }, "whole")
  const { onState, onFailure, onAutoplayBlocked } = s.player.options!
  s.watch.close()
  onState("PLAYING")
  onAutoplayBlocked()
  onFailure("BLOCKED")
  const { player, failure, tapNeeded } = s.view()
  assert.deepEqual([player, failure, tapNeeded], ["CLOSED", null, false])
})

// ---------- a player that does not start

test("a video that does not start within 4 s of being ready asks for a tap", () => {
  const s = stand()
  s.watch.open(sgp, { video, second: 700 }, "whole")
  s.player.begun = false
  s.reports("OPENING")
  s.pass(4)
  assert.equal(s.view().tapNeeded, false)
  s.pass(0.25)
  assert.equal(s.view().tapNeeded, true)
})

test("a script that is slow to bring the player asks for no tap", () => {
  const s = stand()
  s.watch.open(sgp, { video, second: 700 }, "whole")
  s.player.begun = false
  s.pass(10)
  assert.equal(s.view().tapNeeded, false)
})

test("a browser that blocks the start asks for a tap at once", () => {
  const s = stand()
  s.watch.open(sgp, { video, second: 700 }, "whole")
  s.player.options!.onAutoplayBlocked()
  assert.equal(s.view().tapNeeded, true)
})

test("a video that plays asks for no tap any more", () => {
  const s = stand()
  s.watch.open(sgp, { video, second: 700 }, "whole")
  s.player.options!.onAutoplayBlocked()
  s.reports("PLAYING")
  assert.equal(s.view().tapNeeded, false)
})

test("a match that is opened asks for no tap of the one before it", () => {
  const s = stand()
  s.watch.open(sgp, { video, second: 700 }, "whole")
  s.player.options!.onAutoplayBlocked()
  s.watch.open(hka, first(hka, "whole"), "whole")
  assert.equal(s.view().tapNeeded, false)
})

test("a video that is loaded is opening", () => {
  const s = stand()
  s.open(apart, 700)
  s.watch.go({ video: other, second: 3149 })
  assert.equal(s.view().player, "OPENING")
  assert.equal(s.view().video, other)
})

test("a video that is loaded and does not start within 4 s asks for a tap", () => {
  const s = stand()
  s.open(apart, 700)
  s.pass(10)
  s.player.begun = false
  s.watch.go({ video: other, second: 3149 })
  s.pass(4)
  assert.equal(s.view().tapNeeded, false)
  s.pass(0.25)
  assert.equal(s.view().tapNeeded, true)
})

test("a new player has its own 4 s from where it is ready", () => {
  const s = stand()
  s.watch.open(sgp, { video, second: 700 }, "whole")
  s.reports("OPENING")
  s.pass(3)
  s.fails("FAILED")
  s.pass(5)
  s.watch.retry()
  s.player.begun = false
  s.pass(1)
  assert.equal(s.view().tapNeeded, false)
})

// ---------- a video that can not be played

test("a channel that forbids embedding leaves the room open without a player", () => {
  const s = stand()
  s.watch.open(sgp, { video, second: 700 }, "whole")
  s.fails("FORBIDDEN")
  const { failure, player, match } = s.view()
  assert.deepEqual([failure, player, match!.seriesId], ["FORBIDDEN", "CLOSED", "sgp"])
})

test("a player that fails is given back", () => {
  const s = stand()
  s.watch.open(sgp, { video, second: 700 }, "whole")
  s.fails("FAILED")
  assert.equal(s.last(), "destroy")
})

test("after a failure no time is read any more", () => {
  const s = stand()
  s.watch.open(sgp, { video, second: 700 }, "whole")
  s.fails("FAILED")
  assert.equal(s.ticking(), false)
})

test("a player that fails while it is being made is given back", () => {
  const s = stand()
  s.player.fails = "BLOCKED"
  s.watch.open(sgp, { video, second: 700 }, "whole")
  assert.deepEqual(s.log, [`open ${video} 700`, "destroy"])
  assert.equal(s.ticking(), false)
})

test("a player that fails while it is being made leaves the room open without one", () => {
  const s = stand()
  s.player.fails = "BLOCKED"
  s.watch.open(sgp, { video, second: 700 }, "whole")
  assert.deepEqual([s.view().failure, s.view().player], ["BLOCKED", "CLOSED"])
})

test("a failure asks for no tap", () => {
  const s = stand()
  s.watch.open(sgp, { video, second: 700 }, "whole")
  s.player.options!.onAutoplayBlocked()
  s.fails("FAILED")
  assert.equal(s.view().tapNeeded, false)
})

test("a failure ends the count that was running", () => {
  const s = stand()
  s.open(sgp, 4528)
  s.fails("FAILED")
  assert.equal(s.view().count, null)
})

test("nothing is counted while a video has failed, also when its match is updated", () => {
  const s = stand()
  s.open(sgp, 4528)
  s.fails("FAILED")
  s.watch.update(watchMatch(SGP_BME, 7, { seriesId: "sgp" }))
  assert.equal(s.view().count, null)
})

test("a failure in the middle of a match shows the game the video stood in", () => {
  const s = stand()
  s.open(sgp, 662)
  s.watch.go({ video, second: 6208 })
  s.pass(3)
  s.fails("FAILED")
  assert.equal(s.view().chosen, 2)
})

test("a failure in a break shows the game that was to come", () => {
  const s = stand()
  s.open(sgp, 4900)
  s.fails("FAILED")
  assert.equal(s.view().chosen, 2)
})

test("a failure in a break that nothing timed follows shows the game before it", () => {
  const s = stand()
  s.open(apart, 700)
  s.watch.update(watchMatch([SGP_BME[0]!, { ...SGP_BME[1]!, zero: null, draft: null }], 3, { seriesId: "apart" }))
  s.watch.go({ video, second: 2436 })
  assert.equal(s.view().place!.state, "BREAK")
  s.fails("FAILED")
  assert.equal(s.view().chosen, 0)
})

test("a failure before the first game shows that game", () => {
  const s = stand()
  s.open(sgp, 6208)
  s.pass(1)
  s.read(300)
  s.fails("FAILED")
  assert.equal(s.view().chosen, 0)
})

test("a failure before the first game of another video shows that game", () => {
  const s = stand()
  s.open(apart, 700)
  s.watch.go({ video: other, second: 3000 })
  s.fails("FAILED")
  assert.equal(s.view().chosen, 1)
})

test("a failure of a video without times leaves the game that is chosen", () => {
  const s = stand()
  s.open(plain, 600)
  s.watch.choose(3)
  s.fails("FAILED")
  assert.equal(s.view().chosen, 3)
})

test("a match that fails as it is opened shows its own game, and not one of the match before it", () => {
  const s = stand()
  s.open(sgp, 9930)
  s.fails("FAILED")
  s.player.fails = "BLOCKED"
  s.watch.open(apart, { video, second: 700 }, "whole")
  assert.equal(s.view().failure, "BLOCKED")
  assert.equal(s.view().chosen, 0)
})

test("trying again opens a new player at the same place", () => {
  const s = stand()
  s.open(sgp, 700)
  s.pass(5)
  s.fails("FAILED")
  s.watch.retry()
  assert.equal(s.player.made, 2)
  assert.equal(s.last(), `open ${video} 705`)
})

test("trying again takes the failure back", () => {
  const s = stand()
  s.open(sgp, 700)
  s.fails("FAILED")
  s.watch.retry()
  assert.deepEqual([s.view().failure, s.view().player], [null, "OPENING"])
})

test("a match that opens after a failure is played by a new player", () => {
  const s = stand()
  s.watch.open(sgp, { video, second: 700 }, "whole")
  s.fails("GONE")
  s.watch.open(hka, first(hka, "whole"), "whole")
  assert.equal(s.player.made, 2)
  assert.equal(s.view().failure, null)
})

test("after a failure choosing a game of the same video tries nothing", () => {
  const s = stand()
  s.watch.open(apart, { video, second: 700 }, "whole")
  s.fails("GONE")
  s.watch.choose(0)
  assert.equal(s.player.made, 1)
})

test("after a failure choosing a game of another video tries that one", () => {
  const s = stand()
  s.watch.open(apart, { video, second: 700 }, "whole")
  s.fails("GONE")
  s.watch.choose(1)
  assert.equal(s.last(), `open ${other} 3149`)
  assert.equal(s.view().failure, null)
})

// ---------- a match that is on

const [onAir] = onNow("now").story.videos

test("a stream that is on has no places", () => {
  const s = stand()
  s.open({ ...hka, live: true }, 6400, "all")
  s.pass(20)
  assert.equal(s.view().place, null)
})

test("a match that is on whose games are timed has places", () => {
  const s = stand()
  s.open({ ...sgp, live: true }, 6208)
  assert.equal(s.view().place!.state, "PLAY")
})

test("the next match of a stream that is on joins it where it is now", () => {
  const s = stand()
  s.open(onNow("one"), 0, "all")
  s.read(9000)
  s.pass(3)
  s.watch.open(onNow("two"), { video: onAir!, second: 0 }, "all")
  assert.deepEqual(s.log, [`open ${onAir} 0`, `load ${onAir} 0`])
  assert.equal(s.player.made, 1)
})

test("a stream that was left for a while is joined where it is now, and not where it was left", () => {
  const s = stand()
  s.open(onNow("one"), 0, "all")
  s.read(9000)
  s.watch.pause()
  s.watch.open(onNow("two"), { video: onAir!, second: 0 }, "all")
  assert.deepEqual(s.log, [`open ${onAir} 0`, "pause", `load ${onAir} 0`])
  assert.equal(s.player.playing, true)
})

test("a stream that is on is followed from its first reading", () => {
  const s = stand()
  s.watch.open(onNow("one"), { video: onAir!, second: 0 }, "all")
  s.read(9000)
  assert.equal(s.view().second, 9000)
})

test("a stream that is joined again is followed from its first reading", () => {
  const s = stand()
  s.open(onNow("one"), 0, "all")
  s.read(9000)
  s.watch.open(onNow("two"), { video: onAir!, second: 0 }, "all")
  s.read(9400)
  assert.equal(s.view().second, 9400)
})

test("a place of a stream that is on is gone to as any other", () => {
  const s = stand()
  s.open(onNow("one"), 0, "all")
  s.read(9000)
  s.watch.go({ video: onAir!, second: 600 })
  assert.equal(s.last(), "seek 600")
})

test("going back by the keys to the beginning of a stream does not join it again", () => {
  const s = stand()
  s.open(onNow("one"), 0, "all")
  s.read(4)
  s.watch.seekBy(-10)
  assert.equal(s.last(), "seek 0")
})

test("the beginning of a match that is on whose games are timed is gone to", () => {
  const s = stand()
  s.open({ ...sgp, live: true }, 900)
  s.watch.go({ video, second: 0 })
  assert.equal(s.last(), "seek 0")
})

test("the beginning of a video that is not on is gone to", () => {
  const s = stand()
  s.open(plain, 900)
  s.watch.go({ video: plain.story.videos[0]!, second: 0 })
  assert.equal(s.last(), "seek 0")
})
