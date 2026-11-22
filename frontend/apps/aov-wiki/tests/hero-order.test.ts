import assert from "node:assert/strict"
import { test } from "node:test"
import { heroRuns, heroSortOf, type HeroStanding } from "../src/features/hero/model/hero-order.ts"

const hero = (code: string, difficulty?: number, name = code) => ({ id: code, code, name, difficulty })
const options = (standings: Record<string, Partial<HeroStanding>> = {}) => ({
  standings: new Map(
    Object.entries(standings).map(([id, standing]) => [
      id,
      { tier: null, winRate: null, pickRate: null, banRate: null, ...standing },
    ]),
  ),
  difficultyMaximum: 10,
  bandLabel: (band: string) => band,
  unplaced: "none",
  locale: "vi-VN",
})

test("by name, a hero files under the first letter of the name the reader sees, not of its code", () => {
  const runs = heroRuns(
    [
      hero("zanis", undefined, "Triệu Vân"),
      hero("diaochan", undefined, "Điêu Thuyền"),
      hero("tel", undefined, "Tel'Annas"),
    ],
    "name",
    options(),
  )
  assert.deepEqual(shape(runs), [
    ["D", ["diaochan"]],
    ["T", ["tel", "zanis"]],
  ])
})
const shape = (runs: ReturnType<typeof heroRuns>) => runs.map((run) => [run.label, run.heroes.map((h) => h.code)])

test("an unknown order in the address reads as the alphabetical one", () => {
  assert.equal(heroSortOf("winRate"), "winRate")
  assert.equal(heroSortOf("popularity"), "name")
  assert.equal(heroSortOf(null), "name")
})

test("by name, heroes run under the first letter of their code", () => {
  const runs = heroRuns([hero("butterfly"), hero("airi"), hero("aleister")], "name", options())
  assert.deepEqual(shape(runs), [
    ["A", ["airi", "aleister"]],
    ["B", ["butterfly"]],
  ])
})

test("by difficulty, heroes run from easy to hard and the unrated ones close the list", () => {
  const runs = heroRuns([hero("raz", 9), hero("thane", 2), hero("airi", 5), hero("zill")], "difficulty", options())
  assert.deepEqual(shape(runs), [
    ["easy", ["thane"]],
    ["medium", ["airi"]],
    ["hard", ["raz"]],
    ["none", ["zill"]],
  ])
})

test("by tier, the strongest tier comes first and a tier's heroes follow their win rate", () => {
  const runs = heroRuns(
    [hero("a"), hero("b"), hero("c"), hero("d")],
    "tier",
    options({
      a: { tier: "A", winRate: 51 },
      b: { tier: "S", winRate: 49 },
      c: { tier: "A", winRate: 53 },
    }),
  )
  assert.deepEqual(shape(runs), [
    ["S", ["b"]],
    ["A", ["c", "a"]],
    ["none", ["d"]],
  ])
})

test("by win rate, the ranked heroes need no index card and the others close the list", () => {
  const runs = heroRuns(
    [hero("a"), hero("b"), hero("c")],
    "winRate",
    options({ a: { winRate: 48 }, b: { winRate: 52 } }),
  )
  assert.deepEqual(shape(runs), [
    [null, ["b", "a"]],
    ["none", ["c"]],
  ])
})
