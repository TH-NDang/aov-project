import assert from "node:assert/strict"
import { test } from "node:test"
import { roundWeight, stageBracket } from "../src/lib/bracket-model.ts"
import { competition, loserOf, on, winnerOf } from "./fixtures/competition.ts"

const weights = (view: Parameters<typeof stageBracket>[0]) =>
  Object.fromEntries(stageBracket(view, "KO").nodes.map((node) => [node.entry.match.key, roundWeight(node.round)]))

test("a bracket of two lanes closes each lane before its final", () => {
  const view = competition([
    { key: "u1", a: "a", b: "b", score: [4, 2], scheduledAt: on(1) },
    { key: "u2", a: "c", b: "d", score: [4, 1], scheduledAt: on(1) },
    { key: "uf", a: winnerOf("u1"), b: winnerOf("u2"), score: [3, 4], scheduledAt: on(3) },
    { key: "l1", a: loserOf("u1"), b: loserOf("u2"), score: [4, 3], scheduledAt: on(4) },
    { key: "lf", a: loserOf("uf"), b: winnerOf("l1"), score: [2, 4], scheduledAt: on(5) },
    { key: "gf", a: winnerOf("uf"), b: winnerOf("lf"), scheduledAt: on(7) },
  ])
  assert.deepEqual(weights(view), { u1: "semi", u2: "semi", uf: "closing", l1: "semi", lf: "closing", gf: "final" })
})

test("a bracket of one lane ends in its final", () => {
  const view = competition([
    { key: "s1", a: "a", b: "b", score: [3, 0], scheduledAt: on(1) },
    { key: "s2", a: "c", b: "d", score: [3, 2], scheduledAt: on(1) },
    { key: "f", a: winnerOf("s1"), b: winnerOf("s2"), scheduledAt: on(2) },
  ])
  assert.deepEqual(weights(view), { s1: "semi", s2: "semi", f: "final" })
})
