import assert from "node:assert/strict"
import { test } from "node:test"
import { competitionMatches } from "../src/lib/match-model.ts"
import { beside, matchNeighbours } from "../src/lib/neighbours.ts"
import { competition } from "./fixtures/competition.ts"

const entries = competitionMatches([
  competition([
    { key: "third", a: "a", b: "c", scheduledAt: "2026-11-03T10:00:00Z" },
    { key: "first", a: "a", b: "b", scheduledAt: "2026-11-01T10:00:00Z" },
    { key: "second", a: "b", b: "c", scheduledAt: "2026-11-02T10:00:00Z" },
    { key: "undecided", scheduledAt: "2026-11-02T12:00:00Z" },
    { key: "undated", a: "a", b: "d" },
  ]),
])
const keys = (key: string) => {
  const { before, after } = matchNeighbours(entries, key)
  return [before?.match.key ?? null, after?.match.key ?? null]
}

test("the matches around one are those played just before and after it", () => {
  assert.deepEqual(keys("second"), ["first", "third"])
})

test("the first and the last match have one neighbour", () => {
  assert.deepEqual(
    [keys("first"), keys("third")],
    [
      [null, "second"],
      ["second", null],
    ],
  )
})

test("a match without teams is passed over, and still has neighbours of its own", () => {
  assert.deepEqual(keys("undecided"), ["second", "third"])
})

test("a match without a time, and one that is not there, have none", () => {
  assert.deepEqual(
    [keys("undated"), keys("missing")],
    [
      [null, null],
      [null, null],
    ],
  )
})

test("the ends of a list have nothing beside them", () => {
  assert.deepEqual(
    [beside(["a", "b"], 0), beside(["a", "b"], 1), beside(["a"], -1)],
    [
      { before: null, after: "b" },
      { before: "a", after: null },
      { before: null, after: null },
    ],
  )
})
