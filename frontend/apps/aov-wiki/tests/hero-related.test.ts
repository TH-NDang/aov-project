import assert from "node:assert/strict"
import { test } from "node:test"
import { relatedHeroes } from "../src/features/hero/model/hero-related.ts"

const hero = (id: string, roles: string[], positions: string[] | null, name = id) => ({ id, name, roles, positions })
const options = { limit: 10, locale: "vi-VN" }

test("heroes of the same lane come first when they also share a role, then by name", () => {
  const current = hero("hayate", ["MARKSMAN"], ["DRAGON"])
  const others = [
    hero("zill", ["ASSASSIN"], ["DRAGON"]),
    hero("yorn", ["MARKSMAN"], ["DRAGON"]),
    hero("elsu", ["MARKSMAN"], ["DRAGON"]),
    hero("krixi", ["MAGE"], ["MID"]),
  ]

  assert.deepEqual(
    relatedHeroes(current, others, options).map((entry) => entry.id),
    ["elsu", "yorn", "zill"],
  )
})

test("the hero itself is never listed", () => {
  const current = hero("hayate", ["MARKSMAN"], ["DRAGON"])

  assert.deepEqual(relatedHeroes(current, [current], options), [])
})

test("a hero without a lane is matched by its roles", () => {
  const current = hero("new", ["MAGE"], null)
  const others = [hero("krixi", ["MAGE"], ["MID"]), hero("yorn", ["MARKSMAN"], ["DRAGON"])]

  assert.deepEqual(
    relatedHeroes(current, others, options).map((entry) => entry.id),
    ["krixi"],
  )
})

test("names are ordered as the reader reads them, so Đ sits with D", () => {
  const current = hero("a", ["TANK"], ["SUPPORT"])
  const others = [hero("e", ["TANK"], ["SUPPORT"], "Eland"), hero("d", ["TANK"], ["SUPPORT"], "Đổng Trác")]

  assert.deepEqual(
    relatedHeroes(current, others, options).map((entry) => entry.name),
    ["Đổng Trác", "Eland"],
  )
})

test("the list stops at the limit", () => {
  const current = hero("a", ["TANK"], ["TOP"])
  const others = Array.from({ length: 12 }, (_, index) => hero(`h${index}`, ["TANK"], ["TOP"]))

  assert.equal(relatedHeroes(current, others, { ...options, limit: 8 }).length, 8)
})
