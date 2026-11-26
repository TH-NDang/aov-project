import assert from "node:assert/strict"
import { test } from "node:test"
import type { HeroCount } from "@aov/community-contracts"
import { mostSeen } from "../src/lib/statistics-model.ts"

const hero = (name: string, picks: number, bans: number, extra: Partial<HeroCount> = {}): HeroCount => ({
  id: `id-${name}`,
  code: name,
  name: name.toUpperCase(),
  picks,
  wins: 0,
  bans,
  bluePicks: 0,
  ...extra,
})
const keys = (heroes: HeroCount[], size = 10) => mostSeen({ heroes }, size).map(({ key }) => key)

test("a hero is seen in the games it was picked or banned in", () => {
  assert.equal(mostSeen({ heroes: [hero("star", 2, 95)] }, 10)[0]!.presence, 97)
})

test("the heroes seen most come first, as many as asked", () => {
  assert.deepEqual(keys([hero("rare", 1, 0), hero("banned", 2, 95), hero("picked", 80, 5)], 2), ["banned", "picked"])
})

test("of two heroes seen as often, the one picked more comes first", () => {
  assert.deepEqual(keys([hero("banned", 1, 9), hero("picked", 9, 1)]), ["picked", "banned"])
})

test("heroes can be listed by their picks alone", () => {
  const heroes = [hero("banned", 2, 95), hero("picked", 80, 5), hero("shunned", 0, 9)]
  assert.deepEqual(
    mostSeen({ heroes }, 10, "picks").map(({ key }) => key),
    ["picked", "banned"],
  )
})

test("a hero nobody picked or banned is left out", () => {
  assert.deepEqual(keys([hero("unseen", 0, 0), hero("seen", 1, 0)]), ["seen"])
})

test("a hero without a code goes by its id, and one recorded by its name alone by the name", () => {
  assert.deepEqual(
    keys([hero("a", 3, 0, { code: null }), hero("b", 2, 0, { code: null, id: null }), hero("c", 1, 0)]),
    ["id-a", "B", "c"],
  )
})
