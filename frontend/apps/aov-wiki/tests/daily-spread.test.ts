import assert from "node:assert/strict"
import { test } from "node:test"
import { dailySpread } from "../src/lib/daily-spread.ts"

test("the wall shows as many different heroes as it asks for", () => {
  const places = dailySpread(129, 20_000, 16)
  assert.equal(places.length, 16)
  assert.equal(new Set(places).size, 16)
  assert.ok(places.every((place) => place >= 0 && place < 129))
})

test("the wall shows other heroes on another day", () => {
  assert.notDeepEqual(dailySpread(129, 20_000, 16), dailySpread(129, 20_001, 16))
})

test("the wall never asks for more heroes than the library has, and none from an empty one", () => {
  assert.equal(dailySpread(5, 3, 16).length, 5)
  assert.equal(new Set(dailySpread(5, 3, 16)).size, 5)
  assert.deepEqual(dailySpread(0, 3, 16), [])
})

test("neighbours in alphabetical order do not stand side by side on the wall", () => {
  const places = dailySpread(129, 7, 16)
  assert.ok(places.slice(1).every((place, index) => Math.abs(place - places[index]!) > 1))
})
