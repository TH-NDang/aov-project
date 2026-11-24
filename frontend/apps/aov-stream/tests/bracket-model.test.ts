import assert from "node:assert/strict"
import { test } from "node:test"
import { bracketLayout, bracketRoundName, bracketRoundOf, tracedMatches } from "../src/lib/bracket-model.ts"
import { matchRound, matchSides } from "../src/lib/match-schedule.ts"
import { competition, loserOf, matchesOf, on, stage, winnerOf, type TestMatch } from "./fixtures/competition.ts"

const layoutOf = (matches: TestMatch[]) => bracketLayout(matchesOf(competition(matches)))
const placed = (matches: TestMatch[]) =>
  Object.fromEntries(layoutOf(matches).nodes.map((node) => [node.entry.match.key, [node.lane, node.column, node.row]]))
const roundsOf = (matches: TestMatch[]) =>
  Object.fromEntries(layoutOf(matches).nodes.map((node) => [node.entry.match.key, bracketRoundName(node.round)]))

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

test("a side without a link is traced to its team's previous match in the stage", () => {
  const matches = tracedMatches(
    matchesOf(competition([...semifinals, { key: "final", a: "a", b: "c", scheduledAt: on(3) }])),
  )
  const final = matches.find((match) => match.key === "final")!

  assert.deepEqual([final.a.type, final.a.matchKey], ["WINNER", "s1"])
  assert.deepEqual([final.b.type, final.b.matchKey], ["LOSER", "s2"])
})

test("a link the plan gives is kept as it is", () => {
  const matches = tracedMatches(
    matchesOf(competition([...semifinals, { key: "final", a: winnerOf("s2"), b: winnerOf("s1"), scheduledAt: on(3) }])),
  )

  assert.deepEqual(matches.at(-1)!.a, winnerOf("s2"))
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

  assert.deepEqual(layout["third"], ["third", 1, 1.5])
})

test("a match of a late entry stands next to the one it leads to", () => {
  const layout = placed([
    { key: "q1", a: "a", b: "b", score: [3, 0], scheduledAt: on(1) },
    { key: "s1", a: winnerOf("q1"), b: "c", score: [3, 0], scheduledAt: on(2) },
    { key: "s2", a: "d", b: "e", score: [3, 0], scheduledAt: on(2) },
    { key: "final", a: winnerOf("s1"), b: winnerOf("s2"), scheduledAt: on(3) },
  ])

  assert.deepEqual([layout["q1"]![1], layout["s1"]![1], layout["s2"]![1], layout["final"]![1]], [0, 1, 1, 2])
})

test("rounds are named by how far they are from the end of their lane", () => {
  assert.deepEqual(roundsOf(doubleElimination), {
    s1: "Bán kết nhánh thắng",
    s2: "Bán kết nhánh thắng",
    "upper-final": "Chung kết nhánh thắng",
    "lower-1": "Bán kết nhánh thua",
    "lower-final": "Chung kết nhánh thua",
    "grand-final": "Chung kết tổng",
  })
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
