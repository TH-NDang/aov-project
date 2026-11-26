import assert from "node:assert/strict"
import { test } from "node:test"
import {
  landingPath,
  markEvery,
  raceBorders,
  raceDots,
  raceLines,
  racePath,
  raceScale,
  raceShoulder,
  raceStops,
  stepOutcomes,
} from "../src/lib/race-model.ts"
import { matchesOf, on } from "./fixtures/competition.ts"
import { leagueMatches, leagueSteps, leagueView } from "./fixtures/league.ts"

const view = leagueView()
const { steps, groups } = leagueSteps(view)
const group = groups[0]!
const scale = raceScale(4, 10)

test("places stand in the middle of rows of one height", () => {
  assert.deepEqual([1, 2, 4].map(scale.y), [5, 15, 35])
  assert.equal(scale.height, 40)
})

test("a heading over a zone moves its places and all below them down", () => {
  const headed = raceScale(4, 10, [{ from: 1 }, { from: 3 }], 6)
  assert.deepEqual([1, 2, 3, 4].map(headed.y), [11, 21, 37, 47])
  assert.equal(headed.height, 52)
})

test("a border runs halfway between the places on either side of it", () => {
  const zones = [{ from: 1 }, { from: 3 }]
  assert.deepEqual(raceBorders(zones, scale), [20])
  assert.deepEqual(raceBorders(zones, raceScale(4, 10, zones, 6)), [29])
})

test("a team stands at its place after every step up to the one shown", () => {
  // B is third, fourth and fourth.
  assert.deepEqual(raceStops(group, "b", 2, scale), [
    { step: 0, y: 25 },
    { step: 1, y: 35 },
    { step: 2, y: 35 },
  ])
  assert.equal(raceStops(group, "b", 0, scale).length, 1)
})

test("level teams stand in the middle of the places they share", () => {
  assert.equal(raceStops(group, "c", 2, scale).at(-1)!.y, 10)
  assert.equal(raceStops(group, "d", 2, scale).at(-1)!.y, 10)
})

test("a line starts at the first match of its team", () => {
  const late = leagueView(leagueMatches.filter(({ key }) => key !== "m2"))
  const stops = raceStops(leagueSteps(late).groups[0]!, "d", 2, scale)
  assert.deepEqual(
    stops.map(({ step }) => step),
    [1, 2],
  )
})

test("the team that is lit is drawn last, after the first place", () => {
  const lines = raceLines(group, 0, scale, { lit: "b", gold: true })
  assert.deepEqual(
    lines.slice(-2).map(({ teamId, look }) => [teamId, look]),
    [
      ["d", "gold"],
      ["b", "lit"],
    ],
  )
})

test("no line is golden while the first place is not won", () => {
  const lines = raceLines(group, 0, scale, { lit: null, gold: false })
  assert.ok(lines.every(({ look }) => look === "plain"))
})

test("a first place without a match is not golden", () => {
  const unplayed = { ...group, tables: group.tables.map((rows) => rows.map((row) => ({ ...row, played: 0 }))) }
  assert.ok(raceLines(unplayed, 0, scale, { lit: null, gold: true }).every(({ look }) => look === "plain"))
})

test("every line knows the middle of the row its team stands in", () => {
  const rows = new Map(raceLines(group, 2, scale, { lit: null, gold: false }).map((line) => [line.teamId, line.row]))
  // Level on the line, yet each has a row of its own.
  assert.deepEqual([rows.get("c"), rows.get("d"), rows.get("a"), rows.get("b")], [5, 15, 25, 35])
})

test("a line runs level where a place is kept and turns between two steps where it changes", () => {
  const stops = [
    { step: 0, y: 5 },
    { step: 1, y: 5 },
    { step: 2, y: 15 },
  ]
  assert.equal(racePath(stops), "M0 5H1C1.5 5 1.5 15 2 15")
  assert.equal(racePath([]), "")
})

test("a line is level on its shoulder before it reaches a step", () => {
  const stops = [
    { step: 0, y: 5 },
    { step: 1, y: 15 },
  ]
  assert.equal(racePath(stops, 0.2), "M0 5C0.4 5 0.4 15 0.8 15H1")
})

test("lines have shoulders only where teams play several matches in a step", () => {
  assert.equal(raceShoulder(group), 0)
  const days = leagueView(
    leagueMatches.map(({ label: _, ...match }, index) => ({ ...match, scheduledAt: on(index < 4 ? 1 : 2) })),
  )
  assert.ok(raceShoulder(leagueSteps(days).groups[0]!) > 0)
})

test("a guide runs straight into the row of its team, or bends where level teams part", () => {
  assert.equal(landingPath(15, 15, 38), "M0 15H38")
  assert.equal(landingPath(10, 15, 40), "M0 10C20 10 20 15 40 15")
})

test("the matches of a team are told step by step, won or lost", () => {
  assert.deepEqual(stepOutcomes(steps, matchesOf(view), "c"), [[false], [true], [true]])
})

test("a drawn match is neither won nor lost", () => {
  const drawn = leagueView(leagueMatches.map((match, index) => (index ? match : { ...match, score: [1, 1] })))
  assert.deepEqual(stepOutcomes(leagueSteps(drawn).steps, matchesOf(drawn), "a")[0], [null])
})

test("a team that did not play in a step has no match there", () => {
  const rest = leagueView(leagueMatches.filter(({ key }) => key !== "m4"))
  assert.deepEqual(stepOutcomes(leagueSteps(rest).steps, matchesOf(rest), "b"), [[false], [], [false]])
})

test("the last match of a step stands at its end and the others before it", () => {
  const dots = raceDots(
    [
      { step: 0, y: 5 },
      { step: 1, y: 15 },
    ],
    [[true, false], [true]],
  )
  assert.deepEqual(dots, [
    { step: 0, after: 1, y: 5, won: true },
    { step: 0, after: 0, y: 5, won: false },
    { step: 1, after: 0, y: 15, won: true },
  ])
})

test("marks are left out of an axis that has no room for all of them", () => {
  assert.equal(markEvery(18, 332, 18), 1)
  assert.equal(markEvery(23, 332, 42), 3)
})

test("the marks of an axis stand at both its ends", () => {
  // Eleven marks have ten gaps of 30 pixels between them.
  assert.equal(markEvery(11, 300, 30), 1)
  assert.equal(markEvery(1, 300, 30), 1)
})
