import assert from "node:assert/strict"
import { test } from "node:test"
import { bracketTeams, journeyEnd, teamJourney } from "../src/lib/bracket-journey.ts"
import { stageBracket } from "../src/lib/bracket-model.ts"
import { competition, loserOf, on, winnerOf } from "./fixtures/competition.ts"

const view = competition([
  { key: "u1", a: "a", b: "b", score: [4, 2], scheduledAt: on(1) },
  { key: "u2", a: "c", b: "d", score: [4, 1], scheduledAt: on(1) },
  { key: "uf", a: winnerOf("u1"), b: winnerOf("u2"), score: [3, 4], scheduledAt: on(3) },
  { key: "l1", a: loserOf("u1"), b: loserOf("u2"), score: [4, 3], scheduledAt: on(4) },
  { key: "lf", a: loserOf("uf"), b: winnerOf("l1"), score: [2, 4], scheduledAt: on(5) },
  { key: "gf", a: winnerOf("uf"), b: winnerOf("lf"), scheduledAt: on(7) },
])
const layout = () => stageBracket(view, "KO")
const way = (team: string) =>
  teamJourney(layout(), team).map(({ node, outcome, score }) => [node.entry.match.key, outcome, score?.join("-")])

test("a team's way follows it through a fall to the lower bracket, its own score first", () => {
  assert.deepEqual(way("b"), [
    ["u1", "lost", "2-4"],
    ["l1", "won", "4-3"],
    ["lf", "won", "4-2"],
    ["gf", null, undefined],
  ])
  assert.deepEqual(
    teamJourney(layout(), "b").map((stop) => stop.opponentId),
    ["a", "d", "a", "c"],
  )
})

test("a way ends where its team was beaten last, and stays open while the team still plays", () => {
  const end = (team: string) => journeyEnd(layout(), teamJourney(layout(), team))
  assert.equal(end("d"), "out")
  assert.equal(end("a"), "out")
  assert.equal(end("c"), "open")
})

test("the final names its winner champion and the other finalist runner-up", () => {
  const over = competition([
    { key: "s1", a: "a", b: "b", score: [3, 0], scheduledAt: on(1) },
    { key: "s2", a: "c", b: "d", score: [3, 2], scheduledAt: on(1) },
    { key: "f", a: winnerOf("s1"), b: winnerOf("s2"), score: [1, 3], scheduledAt: on(2) },
  ])
  const bracket = stageBracket(over, "KO")
  const end = (team: string) => journeyEnd(bracket, teamJourney(bracket, team))
  assert.deepEqual([end("c"), end("a"), end("b")], ["champion", "runner-up", "out"])
  assert.deepEqual(bracketTeams(bracket).slice(0, 2), ["c", "a"])
})
