import assert from "node:assert/strict"
import { test } from "node:test"
import { bracketLayout, bracketRoundName, bracketRoundOf } from "../src/lib/bracket-model.ts"
import { matchRound, matchSides } from "../src/lib/match-schedule.ts"
import { competition, loserOf, matchesOf, on, stage, winnerOf, type TestMatch } from "./fixtures/competition.ts"

const layoutOf = (matches: TestMatch[]) => bracketLayout(matchesOf(competition(matches)))
const placed = (matches: TestMatch[]) =>
  Object.fromEntries(layoutOf(matches).nodes.map((node) => [node.entry.match.key, [node.lane, node.column, node.row]]))

/** Four teams, both semifinals and the final named by their teams only, as an import leaves them. */
const semifinals: TestMatch[] = [
  { key: "s1", a: "a", b: "b", score: [3, 1], scheduledAt: on(1) },
  { key: "s2", a: "c", b: "d", score: [0, 3], scheduledAt: on(2) },
]

/** A double elimination of four teams, named by its teams only. */
const doubleElimination: TestMatch[] = [
  ...semifinals,
  { key: "upper-final", a: "a", b: "d", score: [3, 2], scheduledAt: on(3) },
  { key: "lower-1", a: "b", b: "c", score: [3, 0], scheduledAt: on(3) },
  { key: "lower-final", a: "d", b: "b", score: [1, 3], scheduledAt: on(4) },
  { key: "grand-final", a: "a", b: "b", score: [3, 2], scheduledAt: on(5) },
]

test("a match whose sides have fewer wins than its best of asks for sends nobody on", () => {
  const { links } = layoutOf([
    { key: "s1", a: "a", b: "b", score: [2, 1], scheduledAt: on(1) },
    { key: "s2", a: "c", b: "d", score: [3, 0], scheduledAt: on(2) },
    { key: "final", a: "a", b: "c", scheduledAt: on(3) },
  ])

  assert.deepEqual(
    links.map((link) => link.from.entry.match.key),
    ["s2"],
  )
})

test("a match stands a column after those that feed it, level with their middle", () => {
  assert.deepEqual(placed([...semifinals, { key: "final", a: "a", b: "d", scheduledAt: on(3) }]), {
    s1: ["rounds", 0, 0],
    s2: ["rounds", 0, 1],
    final: ["rounds", 1, 0.5],
  })
})

test("a double elimination recorded without links splits into its lanes and its grand final", () => {
  assert.deepEqual(placed(doubleElimination), {
    s1: ["upper", 0, 0],
    s2: ["upper", 0, 1],
    "upper-final": ["upper", 1, 0.5],
    "lower-1": ["lower", 1, 2],
    "lower-final": ["lower", 2, 2],
    "grand-final": ["final", 3, 1.25],
  })
})

/** Two play-in matches whose losers meet in the lower lane a round before the losers of the next round play there. */
const playIns: TestMatch[] = [
  { key: "p1", a: "a", b: "b", score: [3, 0], scheduledAt: on(1) },
  { key: "p2", a: "f", b: "g", score: [3, 0], scheduledAt: on(1) },
  { key: "u1", a: "c", b: "f", score: [3, 1], scheduledAt: on(2) },
  { key: "u2", a: "a", b: "e", score: [3, 1], scheduledAt: on(2) },
  { key: "lower-early", a: "b", b: "g", score: [3, 1], scheduledAt: on(2) },
  { key: "upper-final", a: "c", b: "a", score: [3, 2], scheduledAt: on(3) },
  { key: "lower-1", a: "f", b: "e", score: [3, 2], scheduledAt: on(3) },
  { key: "lower-2", a: "b", b: "f", score: [3, 2], scheduledAt: on(4) },
  { key: "lower-final", a: "b", b: "a", score: [3, 2], scheduledAt: on(5) },
  { key: "grand-final", a: "c", b: "b", score: [3, 1], scheduledAt: on(6) },
]

test("a lower match the losers of an early round play stands in the column of its round", () => {
  const { nodes } = layoutOf(playIns)
  const read = (key: string) => {
    const node = nodes.find((item) => item.entry.match.key === key)!
    return [node.column, bracketRoundName(node.round)]
  }

  assert.deepEqual(["lower-early", "lower-1", "lower-2", "lower-final"].map(read), [
    [2, "Vòng 1 nhánh thua"],
    [2, "Vòng 1 nhánh thua"],
    [3, "Bán kết nhánh thua"],
    [4, "Chung kết nhánh thua"],
  ])
})

test("a final played once more stands beside the first", () => {
  const { "grand-final": first, "final-again": again } = placed([
    ...doubleElimination,
    { key: "final-again", a: "a", b: "b", score: [1, 3], scheduledAt: on(6) },
  ])

  assert.deepEqual(first, ["final", 3, 1.25])
  assert.deepEqual(again, ["final", 4, 1.25])
})

test("only the way of the winners is drawn", () => {
  const links = layoutOf(doubleElimination).links.map(
    (link) => `${link.from.entry.match.key} → ${link.to.entry.match.key}`,
  )

  assert.deepEqual(links.sort(), [
    "lower-1 → lower-final",
    "lower-final → grand-final",
    "s1 → upper-final",
    "s2 → upper-final",
    "upper-final → grand-final",
  ])
})

test("a match two losers play that leads nowhere stands under the final", () => {
  const layout = placed([
    ...semifinals,
    { key: "third", a: loserOf("s1"), b: loserOf("s2"), scheduledAt: on(3) },
    { key: "final", a: winnerOf("s1"), b: winnerOf("s2"), scheduledAt: on(4) },
  ])

  assert.deepEqual(layout["third"], ["place", 1, 1.5])
})

test("a round reads in English for an English reader", () => {
  const [node] = layoutOf(doubleElimination).nodes

  assert.equal(bracketRoundName(node!.round, "en-US"), "Upper bracket semifinal")
})

test("a match named only by its stage and its teams reads its round in the bracket", () => {
  const entries = matchesOf(
    competition(
      [...semifinals, { key: "final", a: "a", b: "d", label: "KO · A vs D", scheduledAt: on(3) }].map((match) => ({
        label: "KO · X vs Y",
        ...match,
      })),
    ),
  )

  assert.equal(matchRound(entries[2]!), "Chung kết")
})

test("matches nobody links are no bracket and name no round", () => {
  const entries = matchesOf(
    competition([
      { key: "x", a: "a", b: "b" },
      { key: "y", a: "c", b: "d" },
    ]),
  )

  assert.equal(bracketRoundOf(entries[0]!), null)
})

test("a table's matches have no round of a bracket", () => {
  const entries = matchesOf(competition(semifinals, { stages: [stage("KO", { format: "ROUND_ROBIN" })] }))

  assert.equal(bracketRoundOf(entries[0]!), null)
})

test("an open place names the pair that plays for it", () => {
  const entries = matchesOf(
    competition([
      { key: "s1", a: "a", b: "b", scheduledAt: on(1) },
      { key: "final", a: winnerOf("s1"), b: loserOf("s1"), scheduledAt: on(3) },
    ]),
  )

  assert.deepEqual(
    matchSides(entries[1]!).map((side) => side.name),
    ["Thắng A–B", "Thua A–B"],
  )
})

test("an open place too long for a card says only which outcome it waits for", () => {
  const entries = matchesOf(
    competition([
      { key: "upper", label: "Chung kết nhánh thắng", scheduledAt: on(1) },
      { key: "final", a: winnerOf("upper"), b: loserOf("upper"), scheduledAt: on(3) },
    ]),
  )

  assert.deepEqual(
    matchSides(entries[1]!).map((side) => [side.name, side.brief]),
    [
      ["Thắng Chung kết nhánh thắng", "Chờ đội thắng"],
      ["Thua Chung kết nhánh thắng", "Chờ đội thua"],
    ],
  )
})
