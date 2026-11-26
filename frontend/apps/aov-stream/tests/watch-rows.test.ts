import assert from "node:assert/strict"
import { test } from "node:test"
import type { TimelineEvent } from "@aov/community-contracts"
import { draftAt } from "../src/lib/watch-place.ts"
import { leadOf, momentAt, rowsOf, turnAt, turnStart } from "../src/lib/watch-rows.ts"
import { storyOf, timedGame } from "../src/lib/watch-story.ts"
import { clock } from "../src/lib/tournament-model.ts"
import { SGP_BME, UNTIMED, watchGames, type TestGame } from "./fixtures/watch.ts"

const of = (games: TestGame[]) => storyOf(watchGames(games, 7))
const sgp = of(SGP_BME)
const events = (list: Omit<TimelineEvent, "id">[]) => {
  const [game] = watchGames([SGP_BME[0]!], 7)
  game!.content.timeline!.events = list.map((event, index) => ({ ...event, id: `e${index}` }))
  return rowsOf(storyOf([game!]).chapters[0]!)
}
const tower = (atSeconds: number, side: "BLUE" | "RED") =>
  ({ kind: "OBJECTIVE", objective: "TURRET", atSeconds, side }) as const

test("a row is what one team did in a row, and plays from before it", () => {
  const rows = rowsOf(sgp.chapters[1]!).map(
    ({ from, team, taken, second }) =>
      `${clock(from)} ${team} ${taken.map(({ kind, count }) => `${count} ${kind}`).join(" ")} ${second}`,
  )
  assert.deepEqual(rows, [
    "2:13 A 1 ABYSSAL_DRAGON 3839",
    "4:35 B 1 TURRET 1 DARK_SLAYER 3968",
    "5:40 B 1 TURRET 4033",
    "6:21 B 1 ABYSSAL_DRAGON 4087",
    "6:50 B 1 DARK_SLAYER 4116",
    "7:02 A 1 TURRET 4115",
    "7:14 B 1 TURRET 4127",
    "8:25 A 1 ABYSSAL_DRAGON 4211",
    "8:25 B 1 DARK_SLAYER 1 TURRET 4211",
    "9:42 B 1 TURRET 4275",
    "11:10 B 1 TURRET 4363",
    "11:40 B 1 DARK_SLAYER 4406",
    "12:27 A 1 ABYSSAL_DRAGON 4453",
    "13:14 B 1 TURRET 4487",
  ])
})

test("the games of a match have so many rows", () => {
  assert.deepEqual(
    sgp.chapters.map((chapter) => rowsOf(chapter).length),
    [15, 14, 8, 7, 11, 7],
  )
})

test("what is taken again in a row is counted in it", () => {
  const last = rowsOf(sgp.chapters[0]!).at(-1)!
  assert.deepEqual(last.taken, [{ kind: "TURRET", count: 2 }])
  assert.deepEqual([last.from, last.to], [834, 840])
})

test("what is taken twice at once is counted twice in its row", () => {
  const [row] = events([tower(100, "BLUE"), tower(110, "BLUE"), tower(110, "BLUE")])
  assert.deepEqual(row!.taken, [{ kind: "TURRET", count: 3 }])
})

test("moments of one team up to 25 s apart are one row", () => {
  assert.equal(events([tower(100, "BLUE"), tower(125, "BLUE")]).length, 1)
  assert.equal(events([tower(100, "BLUE"), tower(126, "BLUE")]).length, 2)
  assert.equal(events([tower(100, "BLUE"), tower(125, "BLUE"), tower(150, "BLUE")]).length, 1)
})

test("the other team begins a row of its own", () => {
  assert.deepEqual(
    events([tower(100, "BLUE"), tower(110, "RED"), tower(120, "BLUE")]).map(({ team }) => team),
    ["B", "A", "B"],
  )
})

test("a note stands alone with its words", () => {
  const note = { kind: "NOTE", atSeconds: 105, side: "BLUE", title: "Quét sạch" } as const
  const rows = events([tower(100, "BLUE"), note, tower(110, "BLUE")])
  assert.deepEqual(
    rows.map(({ title }) => title),
    [null, "Quét sạch", null],
  )
})

test("a moment of no team stands alone", () => {
  const nobody = { kind: "OBJECTIVE", atSeconds: 100 } as const
  assert.equal(events([nobody, { ...nobody, atSeconds: 101 }]).length, 2)
})

test("a row never plays from before the game", () => {
  assert.equal(events([tower(10, "BLUE")])[0]!.second, 1546)
})

test("a row without a time of the video cannot be played", () => {
  const [chapter] = of([{ ...UNTIMED[0]!, moments: "100Bt" }]).chapters
  assert.equal(rowsOf(chapter!)[0]!.second, null)
})

test("a tower plays from longer before than a dragon or a kill", () => {
  assert.equal(leadOf("TURRET"), 25)
  assert.equal(leadOf("BASE"), 25)
  assert.equal(leadOf("ABYSSAL_DRAGON"), 12)
  assert.equal(leadOf("DARK_SLAYER"), 12)
  assert.equal(leadOf("KILL"), 8)
  assert.equal(leadOf("NOTE"), 10)
})

test("a turn plays from 5 s before it, the first one no earlier than the draft", () => {
  const { chapters } = sgp
  assert.equal(turnStart(chapters[1]!, chapters[1]!.turns[7]!), 3304)
  assert.equal(turnStart(chapters[0]!, chapters[0]!.turns[0]!), 680)
  const early = of([{ ...SGP_BME[0]!, turns: SGP_BME[0]!.turns!.replace("BB685", "BB663") }]).chapters[0]!
  assert.equal(turnStart(early, early.turns[0]!), 662)
})

test("a turn nobody timed plays from the one before it that is", () => {
  const turns = SGP_BME[1]!.turns!.replace("PB3309 PB3309", "PB PB").replace("BB3166", "BB")
  const [chapter] = of([{ ...SGP_BME[1]!, turns }]).chapters
  assert.equal(turnStart(chapter!, chapter!.turns[7]!), 3277)
  assert.equal(turnStart(chapter!, chapter!.turns[8]!), 3277)
  assert.equal(turnStart(chapter!, chapter!.turns[0]!), 3154)
})

test("a turn of the draft as it is shown plays from the same second", () => {
  const turns = SGP_BME[1]!.turns!.replace("PB3309 PB3309", "PB PB")
  const [chapter] = of([{ ...SGP_BME[1]!, turns }]).chapters
  const shown = draftAt(chapter!, 3400)
  assert.equal(turnStart(chapter!, shown[7]!), 3277)
})

test("a turn of a draft without a start cannot be played", () => {
  const [chapter] = of([{ ...SGP_BME[1]!, draft: null }]).chapters
  assert.equal(turnStart(chapter!, chapter!.turns[0]!), null)
})

test("a moment on the page of a game is watched from before it", () => {
  assert.equal(momentAt({ kind: "OBJECTIVE", objective: "TURRET", atSeconds: 333 }), 308)
  assert.equal(momentAt({ kind: "OBJECTIVE", objective: "ABYSSAL_DRAGON", atSeconds: 333 }), 321)
  assert.equal(momentAt({ kind: "KILL", atSeconds: 333 }), 325)
})

test("a moment on the page of a game is never watched from before the game", () => {
  assert.equal(momentAt({ kind: "OBJECTIVE", objective: "TURRET", atSeconds: 10 }), 0)
})

test("a turn on the page of a game is watched from 5 s before it, counted back from 0:00", () => {
  const chapter = timedGame(watchGames([SGP_BME[1]!], 7)[0]!)!
  assert.equal(turnAt(chapter, 8), 3304 - 3718)
})

test("a turn nobody timed, or timed after 0:00, is not watched from the page of a game", () => {
  const turns = SGP_BME[1]!.turns!.replace("BB3166", "BB").replace("PR3430", "PR3800")
  const chapter = timedGame(watchGames([{ ...SGP_BME[1]!, turns }], 7)[0]!)!
  assert.equal(turnAt(chapter, 1), null)
  assert.equal(turnAt(chapter, 18), null)
  assert.equal(turnAt(chapter, 19), null)
})
