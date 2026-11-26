import assert from "node:assert/strict"
import test from "node:test"
import { coverOf, playsUnseen, videoForm } from "../src/lib/video-form.ts"
import type { WatchPlayerState } from "../src/lib/watch-store.ts"

type Now = Parameters<typeof videoForm>[0]

const wide = (now: Partial<Now> = {}) =>
  videoForm({
    open: true,
    wide: true,
    here: true,
    shape: "side",
    seen: 1,
    takes: 0.9,
    playing: true,
    before: "room",
    ...now,
  })
const compact = (now: Partial<Now> = {}) =>
  videoForm({
    open: true,
    wide: false,
    here: true,
    shape: "stack",
    seen: 1,
    takes: 0.33,
    playing: true,
    before: "pinned",
    ...now,
  })

test("a video that is not open has no form", () => {
  assert.equal(wide({ open: false }), "none")
  assert.equal(compact({ open: false }), "none")
})

test("a video stands in its room while enough of its place is seen", () => {
  assert.equal(wide({ seen: 0.35 }), "room")
})

test("a playing video goes on small once its place is scrolled away", () => {
  assert.equal(wide({ seen: 0.34 }), "mini")
})

test("a paused video scrolls away with its page", () => {
  assert.equal(wide({ seen: 0, playing: false }), "room")
})

test("a paused small player stays", () => {
  assert.equal(wide({ seen: 0.2, playing: false, before: "mini" }), "mini")
})

test("a small player docks where enough of its place is seen again, playing or not", () => {
  assert.equal(wide({ seen: 0.4, before: "mini" }), "room")
  assert.equal(wide({ seen: 0.4, playing: false, before: "mini" }), "room")
})

test("a paused video that plays again out of sight goes on small", () => {
  assert.equal(wide({ seen: 0, playing: true, before: "room" }), "mini")
})

test("the video is small on every other page of a wide window", () => {
  assert.equal(wide({ here: false, shape: null, seen: 0 }), "mini")
  assert.equal(wide({ here: false, shape: null, seen: 0, playing: false }), "mini")
})

test("a video parked in a narrow window stays parked when the window grows, until it plays", () => {
  assert.equal(wide({ here: false, shape: null, seen: 0, playing: false, before: "none" }), "none")
  assert.equal(wide({ here: false, shape: null, seen: 0, playing: true, before: "none" }), "mini")
})

test("a parked video is back in its place on the page of its match", () => {
  assert.equal(wide({ seen: 0, playing: false, before: "none" }), "room")
})

test("the video of a stacked or bare room sticks to the top of a narrow window", () => {
  assert.equal(compact({ shape: "stack" }), "pinned")
  assert.equal(compact({ shape: "bare" }), "pinned")
})

test("no video sticks to the top of a wide window", () => {
  assert.equal(wide({ shape: "stack" }), "room")
  assert.equal(wide({ shape: "bare" }), "room")
})

test("a pinned video stays pinned however far the page is scrolled", () => {
  assert.equal(compact({ seen: 0, playing: false }), "pinned")
})

test("the video of a turned phone scrolls away with its room", () => {
  assert.equal(compact({ shape: "turned", seen: 0 }), "room")
})

test("a video that would take nearly all of a low window scrolls away too", () => {
  assert.equal(compact({ shape: "bare", takes: 284 / 340 }), "room")
  assert.equal(compact({ shape: "stack", takes: 506 / 700 }), "pinned")
})

test("a narrow window has no small player", () => {
  assert.equal(compact({ here: false, shape: null, seen: 0 }), "none")
})

test("a video that sticks to the top of the window covers as much of it", () => {
  assert.equal(coverOf("pinned", false, 461), 461)
})

test("a pinned video that has slid away covers nothing", () => {
  assert.equal(coverOf("pinned", true, 461), 0)
})

test("a video that scrolls with the page, stands in a corner or is parked covers nothing", () => {
  for (const form of ["room", "mini", "none"] as const) assert.equal(coverOf(form, false, 461), 0)
})

const STATES: WatchPlayerState[] = ["CLOSED", "OPENING", "PLAYING", "PAUSED", "WAITING", "ENDED"]
const unseen = (now: { wide: boolean; here: boolean }) => STATES.filter((player) => playsUnseen({ ...now, player }))

test("out of sight in a narrow window nothing plays, also what is only about to", () => {
  assert.deepEqual(unseen({ wide: false, here: false }), ["OPENING", "PLAYING", "WAITING"])
})

test("on the page of its match a video may play", () => {
  assert.deepEqual(unseen({ wide: false, here: true }), [])
})

test("in a wide window a video may play beside every page", () => {
  assert.deepEqual(unseen({ wide: true, here: false }), [])
})
