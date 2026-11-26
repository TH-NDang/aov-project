import assert from "node:assert/strict"
import { test } from "node:test"
import { createPlayhead } from "../src/features/esports/model/playhead"
import { markSeconds, phaseRange, placeAt, type Place } from "../src/features/esports/model/playback-place"
import type { GameChapter } from "../src/features/esports/model/series-vod"
import type { TimelineEvent } from "../src/features/esports/model/timeline"

const VIDEO = 13504

function game(
  number: number,
  start: number,
  locked: number | null,
  zero: number | null,
  length: number | null,
): GameChapter {
  const live = zero !== null
  const from = zero ?? start + 300
  const duration = length ?? 900
  return {
    gameId: `g${number}`,
    number,
    videoId: "j8AvYygkzm4",
    from: start,
    start: from,
    end: from + duration,
    duration,
    synced: true,
    live,
    ended: length !== null,
    draft: { start, locked, turns: [] },
    sync: { url: "", startSecond: from, pauses: [] },
    winner: null,
    events: [],
  }
}

const first = game(1, 667, 975, 1546, 883)
const second = game(2, 3154, 3490, 3718, 802)
const third = game(3, 5363, 5811, 5875, 596)
const match = [first, second, third]
const unplaced: GameChapter = {
  ...game(4, 0, null, null, 600),
  from: 0,
  start: 0,
  end: 0,
  synced: false,
  draft: null,
  sync: { url: "", startSecond: null, pauses: [] },
}

const words = (place: Place) =>
  place.kind === "between"
    ? `between ${place.previous?.number ?? "-"} ${place.next?.number ?? "-"}`
    : `${place.kind} ${place.chapter.number} ${place.clock}`

test("the place of the video is a phase of a game or the time between games", () => {
  const at = (video: number) => words(placeAt(match, video))
  assert.equal(at(100), "between - 1")
  assert.equal(at(3154), "draft 2 0")
  assert.equal(at(3489), "draft 2 0")
  assert.equal(at(3490), "wait 2 0", "locked, not yet 0:00")
  assert.equal(at(3718), "play 2 0")
  assert.equal(at(4158), "play 2 440", "7:20")
  assert.equal(at(4520), "play 2 802", "the last second")
  assert.equal(at(4800), "between 2 3")
  assert.equal(at(7000), "between 3 -")
})

test("a draft without a lock lasts to 0:00, and one without either to the next game", () => {
  assert.equal(words(placeAt([{ ...second, draft: { start: 3154, locked: null, turns: [] } }], 3700)), "draft 2 0")
  const open = game(2, 3154, null, null, null)
  assert.equal(words(placeAt([first, open, third], 5000)), "draft 2 0")
  assert.equal(words(placeAt([first, open, third], 5363)), "draft 3 0")
  assert.equal(words(placeAt([first, game(2, 3154, 3490, null, null), third], 5000)), "wait 2 0")
})

test("a pause of the broadcast holds the game clock", () => {
  const paused = {
    ...second,
    end: 4615,
    sync: { ...second.sync, pauses: [{ atSeconds: 440, durationSeconds: 95 }] },
  }
  const at = (video: number) => words(placeAt([paused], video))
  assert.equal(at(4158), "play 2 440", "the second it begins")
  assert.equal(at(4200), "pause 2 440")
  assert.equal(at(4253), "play 2 440", "and the second it ends")
  assert.equal(at(4260), "play 2 447")
})

test("a later pause of the broadcast begins once the earlier one has ended", () => {
  const pauses = [
    { atSeconds: 100, durationSeconds: 50 },
    { atSeconds: 300, durationSeconds: 60 },
  ]
  const twice = { ...second, end: 4630, sync: { ...second.sync, pauses } }
  const at = (video: number) => words(placeAt([twice], video))
  assert.equal(at(4040), "play 2 272")
  assert.equal(at(4100), "pause 2 300")
})

test("a game without a place in the video never takes the playhead", () => {
  assert.equal(words(placeAt([unplaced], 0)), "between - -")
  assert.equal(words(placeAt([...match, unplaced], 4158)), "play 2 440")
})

test("a phase whose ends are known is its own stretch, whatever the second", () => {
  const range = (video: number) => {
    const found = phaseRange(placeAt(match, video), video, VIDEO)!
    return [found.from, found.to]
  }
  assert.deepEqual(range(3200), [3154, 3490], "the draft")
  assert.deepEqual(range(3600), [3154, 3718], "the draft and the wait")
  assert.deepEqual(range(4158), [3718, 4520], "the game")
  assert.deepEqual(range(3800), range(4500))
  assert.deepEqual(range(4800), [4200, 5400], "ten minutes before and after")
})

test("a phase that goes on grows in steps and keeps its key between them", () => {
  const live = game(2, 3154, 3490, 3718, null)
  const open = (video: number) => phaseRange(placeAt([live], video), video, VIDEO)!
  assert.equal(open(3800).to, 3718 + 900, "fifteen minutes at first")
  assert.equal(open(4500).key, open(4158).key)
  assert.equal(open(4580).to, 3718 + 1200, "then in steps of five minutes, a minute ahead")
  assert.notEqual(open(4580).key, open(4158).key)

  const draft = game(2, 3154, null, null, null)
  const drafting = (video: number) => phaseRange(placeAt([draft], video), video, VIDEO)!
  assert.equal(drafting(3331).to, 3634, "eight minutes of draft at first")
  assert.equal(drafting(3620).to, 3154 + 600, "then in steps of two minutes, half a minute ahead")
  const waiting = game(2, 3154, 3490, null, null)
  assert.deepEqual(
    [phaseRange(placeAt([waiting], 3500), 3500, VIDEO)!.from, phaseRange(placeAt([waiting], 3500), 3500, VIDEO)!.to],
    [3154, 3154 + 480],
  )
  assert.equal(phaseRange(placeAt([live], 4580), 4580, 4700)!.to, 4700, "never past the end of the video")
})

test("the stretch between two games keeps its key until the video enters a game", () => {
  const key = (video: number) => phaseRange(placeAt(match, video), video, VIDEO)!.key
  assert.equal(key(4600), key(5300))
  assert.notEqual(key(4600), key(7000))
  assert.equal(phaseRange(placeAt([unplaced], 700), 700, VIDEO), null, "no game has a place in the video")
})

test("every turn, edge and moment is a stop, in order, and a moment is the stop of its second", () => {
  const turned: GameChapter = {
    ...second,
    draft: {
      start: 3154,
      locked: 3490,
      turns: [
        { order: 1, kind: "BAN", side: "BLUE", hero: { name: "A" }, atSecond: 3166 },
        { order: 2, kind: "BAN", side: "RED", hero: { name: "B" }, atSecond: null },
      ],
    },
  }
  const events: TimelineEvent[] = [
    { id: "g2|b", kind: "OBJECTIVE", at: 4520, side: "RED", objective: "TURRET" },
    { id: "g2|a", kind: "OBJECTIVE", at: 3851, side: "BLUE", objective: "ABYSSAL_DRAGON" },
  ]
  assert.deepEqual(
    markSeconds([turned, unplaced], events).map(({ second: at, eventId }) => [at, eventId]),
    [
      [3154, null],
      [3166, null],
      [3490, null],
      [3718, null],
      [3851, "g2|a"],
      [4520, "g2|b"],
    ],
  )
  const open = game(2, 3154, null, null, null)
  assert.deepEqual(
    markSeconds([open], []).map((mark) => mark.second),
    [3154],
    "an estimated start or end is no stop",
  )
})

test("of two moments at one second the first is the stop", () => {
  const events: TimelineEvent[] = [
    { id: "g2|a", kind: "OBJECTIVE", at: 3851, side: "BLUE", objective: "ABYSSAL_DRAGON" },
    { id: "g2|b", kind: "OBJECTIVE", at: 3851, side: "RED", objective: "TURRET" },
  ]
  const stop = markSeconds([second], events).find((mark) => mark.second === 3851)
  assert.deepEqual(stop, { second: 3851, eventId: "g2|a" })
})

test("a game whose end is not recorded has no end to stop at", () => {
  const running = game(2, 3154, 3490, 3718, null)
  assert.deepEqual(
    markSeconds([running], []).map((mark) => mark.second),
    [3154, 3490, 3718],
  )
})

test("the playhead tells its listeners only when it moves", () => {
  const playhead = createPlayhead(-5)
  const heard: number[] = []
  const stop = playhead.subscribe(() => heard.push(playhead.get()))
  playhead.set(0)
  playhead.set(4158.25)
  playhead.set(4158.25)
  playhead.set(Number.NaN)
  playhead.set(-3)
  stop()
  playhead.set(50)
  assert.deepEqual(heard, [4158.25, 0])
  assert.equal(playhead.get(), 50)
})
