import assert from "node:assert/strict"
import { test } from "node:test"
import type { SeriesContent } from "@aov/community-contracts"
import { matchBegun, matchOver, recordedScore, roomNext, scoreBefore } from "../src/lib/watch-match.ts"
import { storyOf } from "../src/lib/watch-story.ts"
import { competition, matchesOf, on, type TestMatch } from "./fixtures/competition.ts"
import { SGP_BME, watchGames, type TestGame } from "./fixtures/watch.ts"

// ---------- the recorded result

const head = (teamId: string | null, score: number | null) => ({ teamId, score })

test("the recorded result is read with the first team of the video first", () => {
  assert.deepEqual(recordedScore([head("a", 4), head("b", 2)], "a"), { A: 4, B: 2 })
  assert.deepEqual(recordedScore([head("a", 4), head("b", 2)], "b"), { A: 2, B: 4 })
})

test("a result whose teams are not known is read as the head has it", () => {
  assert.deepEqual(recordedScore([head(null, 3), head(null, 1)], null), { A: 3, B: 1 })
})

test("a result that lacks a score is none", () => {
  assert.equal(recordedScore([head("a", 4), head("b", null)], "a"), null)
  assert.equal(recordedScore([head("a", null), head("b", 2)], "a"), null)
})

test("a match that nobody has won a game of has a result", () => {
  assert.deepEqual(recordedScore([head("a", 0), head("b", 0)], "a"), { A: 0, B: 0 })
})

// ---------- the score before the first published game

const before = (games: TestGame[], recorded: Parameters<typeof scoreBefore>[1]) =>
  scoreBefore(storyOf(watchGames(games, 7)), recorded)
const NONE = { A: 0, B: 0 }

test("a match whose first game is published begins at 0–0", () => {
  assert.deepEqual(before(SGP_BME, { A: 4, B: 2 }), NONE)
})

test("what the recorded result has more than the published games was won before them", () => {
  assert.deepEqual(before(SGP_BME.slice(1), { A: 4, B: 2 }), { A: 1, B: 0 })
  assert.deepEqual(before(SGP_BME.slice(2), { A: 4, B: 2 }), { A: 1, B: 1 })
})

test("a match that is still on has its score before the first published game too", () => {
  assert.deepEqual(before(SGP_BME.slice(1, 4), { A: 3, B: 1 }), { A: 1, B: 0 })
})

test("without a recorded result the score begins at 0–0", () => {
  assert.deepEqual(before(SGP_BME.slice(1), null), NONE)
})

test("a match without games has no score before them", () => {
  assert.deepEqual(scoreBefore(storyOf([], "https://youtu.be/j8AvYygkzm4"), { A: 1, B: 0 }), NONE)
})

test("where a later game is missing too, nobody can say what was won before the first", () => {
  const holes = [SGP_BME[1]!, SGP_BME[2]!, SGP_BME[4]!, SGP_BME[5]!]
  assert.deepEqual(before(holes, { A: 4, B: 2 }), NONE)
})

test("a result that lags behind the published games says nothing of what came before them", () => {
  assert.deepEqual(before(SGP_BME.slice(1), { A: 2, B: 2 }), NONE)
})

test("a result that contradicts the published games says nothing of what came before them", () => {
  // One game more than the published ones each, and fewer wins of one team than they show.
  assert.deepEqual(before(SGP_BME.slice(1, 4), { A: 4, B: 0 }), NONE)
  assert.deepEqual(before(SGP_BME.slice(1), { A: 2, B: 4 }), NONE)
})

test("a result that has some of the games before the published ones says nothing of them", () => {
  assert.deepEqual(before(SGP_BME.slice(2), { A: 4, B: 1 }), NONE)
})

test("a published game that nobody is known to have won leaves open what came before it", () => {
  const open = [{ ...SGP_BME[1]!, winner: null }, ...SGP_BME.slice(2)]
  assert.deepEqual(before(open, { A: 4, B: 2 }), NONE)
})

// ---------- whether a match has begun, and whether it is over

const entryOf = (match: Partial<TestMatch> = {}) => matchesOf(competition([{ key: "m", a: "a", b: "b", ...match }]))[0]!
const NOON = Date.parse(on(10))

test("a match that is still to come has not begun", () => {
  assert.equal(matchBegun(entryOf({ scheduledAt: on(11) }), [], NOON), false)
})

test("a match without a date has not begun", () => {
  assert.equal(matchBegun(entryOf(), [], NOON), false)
})

test("a match whose time has come has begun", () => {
  assert.equal(matchBegun(entryOf({ scheduledAt: on(9) }), [], NOON), true)
})

test("a match with a score has begun, whatever its date", () => {
  assert.equal(matchBegun(entryOf({ scheduledAt: on(11), score: [1, 0] }), [], NOON), true)
})

test("a match with a published game has begun, whatever its date", () => {
  assert.equal(matchBegun(entryOf({ scheduledAt: on(11) }), watchGames(SGP_BME.slice(0, 1), 7), NOON), true)
})

test("a match that no plan knows has begun", () => {
  assert.equal(matchBegun(undefined, [], NOON), true)
})

const seriesOf = (scoreA: number, scoreB: number, bestOf = 5) =>
  ({ bestOf, result: { scoreA, scoreB } }) as unknown as SeriesContent

test("a match is over once a team has won more than half of its games", () => {
  assert.equal(matchOver(entryOf({ score: [2, 1] }), undefined), false)
  assert.equal(matchOver(entryOf({ score: [3, 1] }), undefined), true)
})

test("a match of two games is over once both were played", () => {
  assert.equal(matchOver(entryOf({ bestOf: 2, score: [1, 0] }), undefined), false)
  assert.equal(matchOver(entryOf({ bestOf: 2, score: [1, 1] }), undefined), true)
})

test("a match without a result is not over", () => {
  assert.equal(matchOver(entryOf(), undefined), false)
})

test("a match that no plan knows is over as its series has it", () => {
  assert.equal(matchOver(undefined, seriesOf(3, 1)), true)
  assert.equal(matchOver(undefined, seriesOf(2, 1)), false)
})

test("the result of the plan counts, and not that of the series", () => {
  assert.equal(matchOver(entryOf({ score: [2, 1] }), seriesOf(3, 1)), false)
})

test("a match of which nobody knows how many games decide it is not over", () => {
  assert.equal(matchOver(undefined, seriesOf(3, 1, 0)), false)
})

test("a match of which nothing is known is not over", () => {
  assert.equal(matchOver(undefined, undefined), false)
})

// ---------- the match after this one

const pair = (first: Partial<TestMatch>, second: Partial<TestMatch>, plan: object = {}) =>
  matchesOf(
    competition(
      [
        { key: "one", a: "sgp", b: "bme", ...first },
        { key: "two", a: "fpl", b: "fl", bestOf: 7, ...second },
      ],
      { id: "aog", plan },
    ),
  ) as [ReturnType<typeof matchesOf>[number], ReturnType<typeof matchesOf>[number]]

test("the match that comes next leads to its page, with its teams and how many games decide it", () => {
  const next = roomNext(...pair({}, {}), true, "vi-VN")
  assert.equal(next.href, "/competitions/aog/matches/two")
  assert.deepEqual([next.a.name, next.b.name, next.bestOf], ["FPL", "FL", 7])
})

test("the match that comes next says whether it can be watched", () => {
  assert.equal(roomNext(...pair({}, {}), true, "vi-VN").watchable, true)
  assert.equal(roomNext(...pair({}, {}), false, "vi-VN").watchable, false)
})

test("a match of the same calendar day of the competition is of the same day", () => {
  // Nine in the morning and nine in the evening of one day in Vietnam, two days in London.
  const next = roomNext(
    ...pair({ scheduledAt: "2026-11-09T20:00:00Z" }, { scheduledAt: "2026-11-10T14:00:00Z" }),
    true,
    "vi-VN",
  )
  assert.equal(next.sameDay, true)
})

test("a match of the next calendar day of the competition is not of the same day", () => {
  const next = roomNext(
    ...pair({ scheduledAt: "2026-11-10T16:00:00Z" }, { scheduledAt: "2026-11-10T18:00:00Z" }),
    true,
    "vi-VN",
  )
  assert.equal(next.sameDay, false)
})

test("two matches without a date are not of the same day", () => {
  assert.equal(roomNext(...pair({}, {}), true, "vi-VN").sameDay, false)
})

test("the match that comes next has its time, and the zone its competition is planned in", () => {
  const next = roomNext(...pair({}, { scheduledAt: on(10) }), true, "vi-VN")
  assert.deepEqual([next.at, next.zone], [on(10), "Asia/Ho_Chi_Minh"])
})

test("a match without a date has no time", () => {
  assert.equal(roomNext(...pair({}, {}), true, "vi-VN").at, null)
})

test("a competition whose zone there is not has none", () => {
  assert.equal(roomNext(...pair({}, {}, { timezone: "Asia/Nowhere" }), true, "vi-VN").zone, undefined)
})
