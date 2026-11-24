import assert from "node:assert/strict"
import { test } from "node:test"
import { competitionChampion, finalTable, mostTitles } from "../src/lib/champion-model.ts"
import { competition, loserOf, on, type TestMatch } from "./fixtures/competition.ts"

const final: TestMatch[] = [
  { key: "s1", a: "a", b: "b", score: [3, 1], scheduledAt: on(1) },
  { key: "s2", a: "c", b: "d", score: [0, 3], scheduledAt: on(2) },
  { key: "final", a: "a", b: "d", score: [2, 3], scheduledAt: on(3) },
]
const finished = { status: "FINISHED" }

test("a finished event without a recorded champion is won by the winner of its final", () => {
  const won = competitionChampion(competition(final, { tournament: finished }))!

  assert.equal(won.winner.name, "Đội D")
  assert.equal(won.winner.id, "d")
  assert.equal(won.runnerUp!.name, "Đội A")
  assert.equal(won.score, "3–2")
})

test("the recorded champion wins over the bracket", () => {
  const result = { winnerName: "Đội B", runnerUpName: "Đội C", winnerScore: 4, runnerUpScore: 0 }
  const won = competitionChampion(competition(final, { tournament: { ...finished, result } }))!

  assert.deepEqual([won.winner.id, won.runnerUp!.id, won.score], ["b", "c", "4–0"])
})

test("an event still on has no champion", () => {
  assert.equal(competitionChampion(competition(final)), null)
})

test("a qualifier names no champion from its bracket", () => {
  assert.equal(
    competitionChampion(competition(final, { tournament: { ...finished, competitionType: "QUALIFIER" } })),
    null,
  )
})

test("a bracket that ends in several matches names no champion", () => {
  assert.equal(competitionChampion(competition(final.slice(0, 2), { tournament: finished })), null)
})

test("a match for third place does not hide the champion", () => {
  const third: TestMatch = { key: "third", a: loserOf("s1"), b: loserOf("s2"), score: [3, 0], scheduledAt: on(4) }

  assert.equal(competitionChampion(competition([...final, third], { tournament: finished }))!.winner.id, "d")
})

test("the final table finds the team of each line and leaves out lines that name nobody", () => {
  const placements = [
    { place: "1", teamId: "a", teamName: "" },
    { place: "2", teamName: "Đội D" },
    { place: "3", teamName: "Đội khách" },
    { place: "4", teamName: " " },
  ]
  const rows = finalTable(competition(final, { tournament: { placements } }))

  assert.deepEqual(
    rows.map((row) => [row.place, row.team.id, row.team.name]),
    [
      ["1", "a", "Đội A"],
      ["2", "d", "Đội D"],
      ["3", null, "Đội khách"],
    ],
  )
})

test("a team leads a circuit's titles only with more of them than any other", () => {
  const won = (team: string) => competition([{ key: "f", a: team, b: "z", score: [3, 0] }], { tournament: finished })

  assert.equal(mostTitles([won("a"), won("b"), won("a")])!.team.id, "a")
  assert.equal(mostTitles([won("a"), won("b"), won("a"), won("b")]), null)
  assert.equal(mostTitles([won("a"), won("b")]), null)
})
