import assert from "node:assert/strict"
import { test } from "node:test"
import type { GameChapter } from "../src/features/esports/model/series-vod"
import {
  layoutLane,
  lineMiddle,
  rowAt,
  trackRows,
  trackShape,
  trackTicks,
  type LaneMark,
} from "../src/features/esports/model/track-layout"

type Seconds = { BLUE: number[]; RED: number[] }
type Game = { start: number; locked: number; zero: number; length: number; turns: Seconds; events: Seconds }

/** A match of six games as it was recorded: turns in video seconds, moments on the game clock. */
const MATCH: Game[] = [
  {
    start: 667,
    locked: 975,
    zero: 1546,
    length: 883,
    turns: {
      BLUE: [685, 701, 713, 775, 775, 821, 838, 899, 899],
      RED: [700, 707, 744, 744, 796, 811, 831, 852, 917],
    },
    events: {
      BLUE: [137, 279, 302, 361, 379, 716],
      RED: [232, 279, 338, 462, 503, 503, 533, 545, 550, 698, 728, 745, 793, 834, 840],
    },
  },
  {
    start: 3154,
    locked: 3490,
    zero: 3718,
    length: 802,
    turns: {
      BLUE: [3166, 3193, 3241, 3309, 3309, 3344, 3363, 3404, 3404],
      RED: [3181, 3216, 3277, 3277, 3323, 3337, 3353, 3374, 3430],
    },
    events: { BLUE: [133, 422, 505, 747], RED: [275, 292, 340, 381, 410, 434, 505, 529, 582, 670, 700, 794] },
  },
  {
    start: 5363,
    locked: 5811,
    zero: 5875,
    length: 596,
    turns: {
      BLUE: [5393, 5413, 5453, 5529, 5529, 5583, 5640, 5727, 5727],
      RED: [5404, 5425, 5501, 5501, 5554, 5565, 5605, 5669, 5753],
    },
    events: { BLUE: [138], RED: [173, 327, 333, 380, 403, 433, 433, 492, 492, 527, 563, 581] },
  },
  {
    start: 7040,
    locked: 7400,
    zero: 7490,
    length: 676,
    turns: {
      BLUE: [7057, 7089, 7114, 7199, 7199, 7244, 7275, 7326, 7326],
      RED: [7075, 7101, 7150, 7150, 7210, 7232, 7256, 7302, 7341],
    },
    events: { BLUE: [129], RED: [276, 323, 323, 341, 400, 412, 418, 430, 465, 489, 507, 548, 648, 660] },
  },
  {
    start: 8782,
    locked: 9207,
    zero: 9275,
    length: 1196,
    turns: {
      BLUE: [8795, 8844, 8891, 8952, 8952, 9006, 9051, 9132, 9132],
      RED: [8827, 8863, 8916, 8916, 8993, 8994, 9021, 9100, 9147],
    },
    events: { BLUE: [127, 316, 322, 434, 499, 546, 558, 617, 652, 664], RED: [133, 316, 322, 729, 753] },
  },
  {
    start: 11239,
    locked: 11546,
    zero: 11617,
    length: 617,
    turns: {
      BLUE: [11273, 11304, 11340, 11402, 11402, 11434, 11451, 11479, 11479],
      RED: [11282, 11321, 11385, 11385, 11414, 11424, 11444, 11460, 11491],
    },
    events: { BLUE: [130, 230, 295, 307, 331, 349, 372, 384, 384, 419, 473, 490, 532, 597], RED: [] },
  },
]

/** The twelve views of the match: the draft and the play of each game. */
const VIEWS = MATCH.flatMap((game) => [
  { from: game.start, to: game.locked, marks: game.turns, at: 0 },
  { from: game.zero, to: game.zero + game.length, marks: game.events, at: game.zero },
])
const named = (seconds: number[], at: number): LaneMark[] =>
  seconds.map((second, index) => ({ key: String(index), second: at + second }))

/** What a track of a width, in pixels, with lanes of a height makes of the twelve views. */
function measure(width: number, lane: number) {
  let drawn = 0
  let merged = 0
  let push = 0
  const sizes = new Set<number>()
  for (const { from, to, marks, at } of VIEWS) {
    const pxPerSecond = width / Math.max(300, (to - from) * 1.08)
    const lanes = { BLUE: named(marks.BLUE, at), RED: named(marks.RED, at) }
    for (const own of [lanes.BLUE, lanes.RED]) {
      const laid = layoutLane(own, pxPerSecond, lane)
      drawn += laid.marks.length
      merged += laid.marks.reduce((total, mark) => total + mark.merged.length, 0)
      push = Math.max(push, ...laid.marks.map((mark) => mark.push))
    }
    sizes.add(trackShape(lanes, pxPerSecond, lane, { from, to }).size)
  }
  return { drawn, merged, push: Math.round(push * 10) / 10, sizes: [...sizes].sort() }
}

test("the marks of a match stand alone at every desktop size and on a tablet", () => {
  assert.deepEqual(measure(596, 88), { drawn: 202, merged: 0, push: 3.5, sizes: [26] }, "1280 × 720, sidebar open")
  assert.deepEqual(measure(682, 87), { drawn: 202, merged: 0, push: 0, sizes: [26] }, "1366 × 768, sidebar open")
  assert.deepEqual(measure(839, 43), { drawn: 202, merged: 0, push: 7.5, sizes: [20, 22] }, "1366 × 768, folded")
  assert.deepEqual(measure(1196, 74), { drawn: 202, merged: 0, push: 6.7, sizes: [26] }, "1920 × 1032, sidebar open")
  assert.deepEqual(measure(1308, 43), { drawn: 202, merged: 0, push: 3.3, sizes: [20, 26] }, "1920 × 1032, folded")
  assert.deepEqual(measure(1348, 43), { drawn: 202, merged: 0, push: 2.6, sizes: [20, 26] }, "2071 × 1054, folded")
  assert.deepEqual(measure(708, 43), { drawn: 202, merged: 0, push: 9.4, sizes: [20] }, "820 × 1180")
})

test("where there is no room a mark carries what would lie on it, and none is lost", () => {
  assert.deepEqual(measure(612, 43), { drawn: 200, merged: 2, push: 6.9, sizes: [20] }, "1366 × 640, sidebar open")
  assert.deepEqual(measure(326, 43), { drawn: 196, merged: 6, push: 8.6, sizes: [20] }, "390 × 844")
})

test("a mark takes the first free line, then is pushed, then is merged into the one before it on its line", () => {
  const marks = [100, 104, 130, 133].map((second) => ({ key: `m${second}`, second }))
  const one = layoutLane(marks, 1, 20, [20])
  assert.deepEqual(
    one.marks.map(({ key, x, push, line, merged }) => [key, x, push, line, merged]),
    [
      ["m100", 100, 0, 0, ["m104"]],
      ["m130", 130, 0, 0, ["m133"]],
    ],
    "one line: what is more than half a mark late is merged",
  )
  const pushed = layoutLane(
    [100, 115].map((second) => ({ key: `m${second}`, second })),
    1,
    20,
    [20],
  )
  assert.deepEqual(
    pushed.marks.map((mark) => [mark.x, mark.push]),
    [
      [100, 0],
      [115, 7],
    ],
    "a push keeps the true place apart from where it is drawn",
  )
  assert.deepEqual(
    layoutLane(marks, 1, 43, [20]).marks.map((mark) => mark.line),
    [0, 1, 0, 1],
    "two lines: nothing is pushed",
  )
})

test("both lanes take the size of the fuller one and stand in the middle of their lane", () => {
  const crowd = [0, 1, 2, 3].map((second) => ({ key: `c${second}`, second }))
  const single = [{ key: "s", second: 2 }]
  const shape = trackShape({ BLUE: crowd, RED: single }, 1, 87, { from: 0, to: 60 })
  assert.equal(shape.size, 20, "four lines fit only in the smallest size")
  assert.deepEqual(shape.used, { BLUE: 4, RED: 1 })
  assert.equal(lineMiddle(0, 1, 20, 87), 43.5, "one line runs through the middle")
  assert.deepEqual(
    [0, 1, 2, 3].map((line) => lineMiddle(line, 4, 20, 87)),
    [10.5, 32.5, 54.5, 76.5],
  )

  const elsewhere = trackShape({ BLUE: crowd, RED: single }, 1, 87, { from: 30, to: 60 })
  assert.deepEqual(elsewhere, { size: 26, used: { BLUE: 1, RED: 1 } }, "only what is in view counts")
})

test("the lanes share what the band, the spine and the ticks leave, at most 96 px each", () => {
  assert.deepEqual(trackRows(140), { lane: 43, top: { BLUE: 20, SPINE: 63, RED: 79 } })
  assert.equal(trackRows(228).lane, 87)
  assert.equal(trackRows(246).lane, 96, "two lanes of 96 px with the band, the spine and the ticks")
  assert.equal(trackRows(460).lane, 96, "a tall place is not stretched")
  assert.deepEqual(
    [10, 62, 63, 78, 79, 139].map((y) => rowAt(y, 140)),
    ["BLUE", "BLUE", "SPINE", "SPINE", "RED", "RED"],
  )
})

const played: GameChapter = {
  gameId: "g2",
  number: 2,
  videoId: "v",
  from: 3154,
  start: 3718,
  end: 4520,
  duration: 802,
  synced: true,
  live: true,
  ended: true,
  draft: { start: 3154, locked: 3490, turns: [] },
  sync: { url: "", startSecond: 3718, pauses: [] },
  winner: null,
  events: [],
}
const texts = (ticks: ReturnType<typeof trackTicks>) =>
  ticks.map((tick) => (tick.clock === "video" ? `▸${tick.text}` : tick.text))

test("ticks name the game clock inside a game and the video time elsewhere", () => {
  const ticks = trackTicks([played], 13504, 1.38, 3600, 4700)
  assert.deepEqual(texts(ticks), [
    "▸1:00:00",
    "▸1:01:00",
    "0:00",
    "1:00",
    "2:00",
    "3:00",
    "4:00",
    "5:00",
    "6:00",
    "7:00",
    "8:00",
    "9:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "▸1:16:00",
    "▸1:17:00",
    "▸1:18:00",
  ])
  assert.equal(ticks.find((tick) => tick.text === "7:00" && tick.clock === "game")?.second, 3718 + 420)
})

test("a video tick near an edge of a game is left out", () => {
  const near = { ...played, start: 3680, end: 4200, duration: 520, sync: { ...played.sync, startSecond: 3680 } }
  const video = trackTicks([near], 13504, 1.38, 3600, 4300).filter((tick) => tick.clock === "video")
  assert.deepEqual(texts(video), ["▸1:00:00", "▸1:11:00"], "1:01:00 stands 20 seconds before 0:00")
})

test("the ticks of a paused game stand where its clock shows them", () => {
  const paused = { ...played, sync: { ...played.sync, pauses: [{ atSeconds: 90, durationSeconds: 100 }] }, end: 4620 }
  const ticks = trackTicks([paused], 13504, 1.38, 3718, 4000)
  assert.deepEqual(
    ticks.map((tick) => [tick.text, tick.second - 3718]),
    [
      ["0:00", 0],
      ["1:00", 60],
      ["2:00", 220],
      ["3:00", 280],
    ],
  )
})

test("a game shorter than a step of the ticks is passed by the video's own", () => {
  const ticks = trackTicks([played], 13504, 600 / 13504, 0, 13504)
  assert.ok(ticks.every((tick) => tick.clock === "video"))
  assert.equal(ticks.at(-1)?.text, "3:45:04")
})

test("the last tick is the length of the video", () => {
  const ticks = trackTicks([], 20144, 772 / 20144, 0, 20144)
  assert.equal(ticks.at(-1)?.text, "5:35:44")
  assert.equal(ticks[0]?.text, "0:00")
  assert.ok(ticks.length <= 10)
})
