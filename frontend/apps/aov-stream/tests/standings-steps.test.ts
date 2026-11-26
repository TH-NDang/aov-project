import assert from "node:assert/strict"
import { test } from "node:test"
import {
  countedMatches,
  headToHead,
  labelStep,
  movement,
  sharedPlaces,
  stepAddress,
  stepAt,
  steppedTable,
  tableAfter,
} from "../src/lib/standings-steps.ts"
import { matchesOf, on } from "./fixtures/competition.ts"
import { leagueMatches, leagueStage, leagueSteps, leagueView, tableRows, teamsIn } from "./fixtures/league.ts"

const stepped = (view = leagueView()) => steppedTable(view, view.content.standings[0]!)
const unnamed = leagueMatches.map(({ label: _, ...match }) => match)

test("a label names a round, a week or a match day, in either language", () => {
  assert.deepEqual(labelStep("Vòng 12 · FPL vs SGP"), { kind: "ROUND", number: 12 })
  assert.deepEqual(labelStep("Matchweek 3"), { kind: "WEEK", number: 3 })
  assert.deepEqual(labelStep("Day 2"), { kind: "MATCHDAY", number: 2 })
  assert.equal(labelStep("Upper Bracket Finals"), null)
  assert.equal(labelStep(null), null)
})

test("teams are ranked by points, then by the rules of the stage", () => {
  assert.deepEqual(
    tableRows(leagueView()).map(({ teamId, rank, points, tied }) => [teamId, rank, points, tied]),
    [
      ["c", 1, 2, true],
      ["d", 1, 2, true],
      ["a", 3, 2, false],
      ["b", 4, 0, false],
    ],
  )
})

test("teams no rule tells apart share a rank", () => {
  const level = [
    { a: "a", b: "b", scoreA: 2, scoreB: 0 },
    { a: "c", b: "d", scoreA: 2, scoreB: 0 },
  ]
  assert.deepEqual(
    tableAfter(leagueStage(), ["a", "b", "c", "d"], level).map(({ teamId, rank, tied }) => [teamId, rank, tied]),
    [
      ["a", 1, true],
      ["c", 1, true],
      ["b", 3, true],
      ["d", 3, true],
    ],
  )
})

test("head to head counts once every match between the level teams was played", () => {
  // A and B are level on two points, C and D on one; A beat B and D beat C.
  const played = [
    { a: "a", b: "b", scoreA: 2, scoreB: 0 },
    { a: "c", b: "a", scoreA: 2, scoreB: 0 },
    { a: "a", b: "d", scoreA: 2, scoreB: 0 },
    { a: "b", b: "c", scoreA: 2, scoreB: 0 },
    { a: "b", b: "d", scoreA: 2, scoreB: 0 },
    { a: "d", b: "c", scoreA: 2, scoreB: 0 },
  ]
  const teams = ["b", "a", "c", "d"]
  const rule = { tieBreakers: ["HEAD_TO_HEAD"] }
  assert.equal(teamsIn(tableAfter(leagueStage(rule), teams, played)), "abdc")
  assert.equal(teamsIn(tableAfter(leagueStage({ ...rule, legs: 2 }), teams, played)), "bacd")
})

test("the points level teams took from each other leave out everybody else", () => {
  const played = [
    { a: "a", b: "b", scoreA: 2, scoreB: 1 },
    { a: "a", b: "c", scoreA: 0, scoreB: 2 },
  ]
  assert.deepEqual(
    headToHead(leagueStage(), ["a", "b"], played),
    new Map([
      ["a", 1],
      ["b", 0],
    ]),
  )
  assert.equal(headToHead(leagueStage(), ["a", "b", "c"], played), null)
})

test("a drawn match is neither won nor lost and gives both teams the points of a loss", () => {
  const drawn = tableAfter(
    leagueStage({ lossPoints: 1, winPoints: 3 }),
    ["a", "b"],
    [{ a: "a", b: "b", scoreA: 1, scoreB: 1 }],
  )
  assert.deepEqual(
    drawn.map(({ teamId, played, won, lost, points, tied }) => [teamId, played, won, lost, points, tied]),
    [
      ["a", 1, 0, 0, 1, true],
      ["b", 1, 0, 0, 1, true],
    ],
  )
})

test("a match whose score contradicts its games does not count", () => {
  const view = leagueView(leagueMatches.slice(0, 2))
  view.content.resolved = view.content.resolved.map((result) =>
    result.key === "m1" ? { ...result, consistent: false } : result,
  )
  assert.deepEqual(countedMatches(matchesOf(view)), [{ a: "c", b: "d", scoreA: 0, scoreB: 2 }])
})

test("a match counts once both its teams and its score are known", () => {
  const view = leagueView([
    ...leagueMatches.slice(0, 1),
    { key: "open", a: "a", b: "c" },
    { key: "unknown", a: "a", score: [2, 0] },
  ])
  assert.deepEqual(countedMatches(matchesOf(view)), [{ a: "a", b: "b", scoreA: 2, scoreB: 1 }])
})

test("a table can be read after every round, and the last one is the published table", () => {
  const view = leagueView()
  const { steps, groups } = stepped(view)!
  assert.deepEqual(
    steps.map(({ key, kind, days }) => [key, kind, days]),
    [
      ["1", "ROUND", ["2026-11-01"]],
      ["2", "ROUND", ["2026-11-02"]],
      ["3", "ROUND", ["2026-11-03"]],
    ],
  )
  assert.deepEqual(groups[0]!.tables.map(teamsIn), ["dabc", "dcab", "cdab"])
  assert.deepEqual(groups[0]!.tables.at(-1), view.content.standings[0]!.rows)
})

test("the last step is the published table with all it says", () => {
  const view = leagueView()
  const [table] = view.content.standings
  table!.rows = table!.rows.map((row, index) => ({ ...row, qualified: index < 2 }))
  assert.deepEqual(
    stepped(view)!
      .groups[0]!.tables.at(-1)!
      .map(({ qualified }) => qualified),
    [true, true, false, false],
  )
})

test("steps go by their number, also where a later one was played first", () => {
  const view = leagueView(
    leagueMatches.map((match, index) => ({ ...match, scheduledAt: on(9 - Math.floor(index / 2)) })),
  )
  assert.deepEqual(
    stepped(view)!.steps.map(({ key }) => key),
    ["1", "2", "3"],
  )
})

test("a step holds its matches in the order they were played, and every day of them once", () => {
  const { steps } = leagueSteps(leagueView([{ ...leagueMatches[0]!, scheduledAt: on(5) }, ...leagueMatches.slice(1)]))
  assert.deepEqual(steps[0]!.matches, ["m2", "m1"])
  assert.deepEqual(steps[0]!.days, ["2026-11-01", "2026-11-05"])
})

test("a step is open while one of its matches has no result", () => {
  const view = leagueView(leagueMatches.map((match, index) => (index < 5 ? match : { ...match, score: undefined })))
  assert.deepEqual(
    leagueSteps(view).steps.map(({ open }) => open),
    [false, false, true],
  )
})

test("a team that went up has moved by the places it passed", () => {
  const [group] = leagueSteps().groups
  assert.equal(movement(group!, 1, "c"), 2)
  assert.equal(movement(group!, 1, "b"), -1)
  assert.equal(movement(group!, 0, "c"), 0)
})

test("level teams hold their places together", () => {
  const last = leagueSteps().groups[0]!.tables.at(-1)!
  assert.deepEqual(sharedPlaces(last, "c"), [1, 2])
  assert.deepEqual(sharedPlaces(last, "d"), [1, 2])
  assert.deepEqual(sharedPlaces(last, "a"), [3, 3])
  assert.equal(sharedPlaces(last, "nobody"), null)
})

test("rows that repeat a rank without being level hold the places they stand at", () => {
  const rows = leagueSteps().groups[0]!.tables[0]!.map((row) => ({ ...row, rank: 1, tied: false }))
  assert.deepEqual(
    rows.map(({ teamId }) => sharedPlaces(rows, teamId)),
    [
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ],
  )
})

test("a team that stays among the places it shared has not moved", () => {
  // D stood first alone and now shares the first two places.
  assert.equal(movement(leagueSteps().groups[0]!, 2, "d"), 0)
})

/** A table of some teams by their ranks; teams of one rank are level. */
const ranked = (...places: [teamId: string, rank: number][]) =>
  places.map(([teamId, rank]) => ({
    ...tableRows(leagueView())[0]!,
    teamId,
    rank,
    tied: places.filter(([, other]) => other === rank).length > 1,
  }))

test("a team that comes to share the place above its own has not moved yet", () => {
  const tables = [ranked(["a", 1], ["b", 2], ["c", 3]), ranked(["a", 1], ["b", 2], ["c", 2])]
  assert.equal(movement({ name: null, tables }, 1, "c"), 0)
})

test("a plan without named rounds is read by the days of its matches", () => {
  assert.deepEqual(
    stepped(leagueView(unnamed))!.steps.map(({ key, kind }) => [key, kind]),
    [
      ["2026-11-01", "DAY"],
      ["2026-11-02", "DAY"],
      ["2026-11-03", "DAY"],
    ],
  )
})

test("rounds of the plan come before days", () => {
  const view = leagueView(unnamed.map((match, index) => ({ ...match, round: Math.floor(index / 2) + 1 })))
  assert.deepEqual(
    stepped(view)!.steps.map(({ key, kind }) => [key, kind]),
    [
      ["1", "ROUND"],
      ["2", "ROUND"],
      ["3", "ROUND"],
    ],
  )
})

test("a stage of one day has nothing to step through", () => {
  assert.equal(stepped(leagueView(unnamed.map((match) => ({ ...match, scheduledAt: on(1) })))), null)
})

test("a published table that is worked out otherwise hides the steps", () => {
  const view = leagueView()
  view.content.standings[0]!.rows = [...view.content.standings[0]!.rows].reverse()
  assert.equal(stepped(view), null)
})

test("a published table with other points or other games hides the steps", () => {
  for (const other of [{ points: 9 }, { gameLosses: 9 }]) {
    const view = leagueView()
    const [table] = view.content.standings
    table!.rows = table!.rows.map((row, index) => (index === 3 ? { ...row, ...other } : row))
    assert.equal(stepped(view), null, Object.keys(other)[0])
  }
})

test("a stage in its first round has nothing to step through", () => {
  const view = leagueView(leagueMatches.map((match, index) => (index < 2 ? match : { ...match, score: undefined })))
  assert.equal(stepped(view), null)
})

test("rounds still to come are no steps", () => {
  const view = leagueView(leagueMatches.map((match, index) => (index < 4 ? match : { ...match, score: undefined })))
  assert.equal(stepped(view)!.steps.length, 2)
})

test("the address names a step by its key, and by its stage where the page shows another first", () => {
  const { steps } = leagueSteps()
  assert.equal(stepAddress(steps[1]!, "RR", true), "2")
  assert.equal(stepAddress(steps[1]!, "RR", false), "RR.2")
})

test("an address finds its step again, and only in the stage it names", () => {
  const { steps } = leagueSteps()
  assert.equal(stepAt(steps, "RR", true, "2"), 1)
  assert.equal(stepAt(steps, "RR", false, "RR.3"), 2)
  assert.equal(stepAt(steps, "RR", true, "RR.1"), 0)
  assert.equal(stepAt(steps, "RR", false, "2"), null)
  assert.equal(stepAt(steps, "RR", true, "OTHER.2"), null)
  assert.equal(stepAt(steps, "RR", true, "9"), null)
  assert.equal(stepAt(steps, "RR", true, null), null)
})
