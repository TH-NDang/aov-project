import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionStage } from "@aov/community-contracts"
import { bracketRoundName, roundWeight, stageBracket } from "../src/lib/bracket-model.ts"
import { stageDrawing } from "../src/lib/bracket-rounds.ts"
import { competition, on, stage, winnerOf, type TestMatch } from "./fixtures/competition.ts"

const drawn = (matches: TestMatch[], format: string) => {
  const view = competition(matches, { stages: [stage("S", { format })] })
  return { view, layout: stageDrawing(view, view.content.plan.stages[0] as CompetitionStage) }
}
/** The first two rounds of a Swiss stage of four teams. */
const swiss: TestMatch[] = [
  { key: "s1", a: "a", b: "b", round: 1, score: [3, 0], scheduledAt: on(1) },
  { key: "s2", a: "c", b: "d", round: 1, score: [3, 1], scheduledAt: on(1) },
  { key: "s3", a: "a", b: "c", round: 2, score: [0, 3], scheduledAt: on(2) },
  { key: "s4", a: "b", b: "d", round: 2 },
]

test("the rounds of a stage that is no elimination stand beside each other, each from the top", () => {
  const { layout } = drawn(swiss, "CUSTOM")
  assert.deepEqual(
    layout.nodes.map(({ entry, column, row }) => [entry.match.key, column, row]),
    [
      ["s1", 0, 0],
      ["s2", 0, 1],
      ["s3", 1, 0],
      ["s4", 1, 1],
    ],
  )
  assert.deepEqual([layout.columns, layout.rows, layout.links], [2, 2, []])
})

test("none of those rounds is called or drawn as a final", () => {
  const { layout } = drawn(
    swiss.filter(({ key }) => key !== "s4"),
    "CUSTOM",
  )
  assert.deepEqual(
    layout.nodes.map(({ round }) => [bracketRoundName(round), roundWeight(round)]),
    [
      ["Vòng 1", null],
      ["Vòng 1", null],
      ["Vòng 2", null],
    ],
  )
})

test("a stage whose matches name the ones they come from is a bracket whatever its format", () => {
  const { view, layout } = drawn(
    [
      { key: "k1", a: "a", b: "b", score: [3, 0] },
      { key: "k2", a: "c", b: "d", score: [3, 1] },
      { key: "k3", a: winnerOf("k1"), b: winnerOf("k2"), round: 2 },
    ],
    "CUSTOM",
  )
  assert.equal(layout, stageBracket(view, "S"))
  assert.equal(layout.links.length, 2)
})

test("an elimination whose plan ties no matches is traced from its results", () => {
  const { layout } = drawn(
    [
      { key: "k1", a: "a", b: "b", score: [3, 0], scheduledAt: on(1) },
      { key: "k2", a: "c", b: "d", score: [3, 1], scheduledAt: on(1) },
      { key: "k3", a: "a", b: "c", scheduledAt: on(2) },
    ],
    "SINGLE_ELIMINATION",
  )
  assert.equal(layout.links.length, 2)
})
