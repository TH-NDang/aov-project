import assert from "node:assert/strict"
import test from "node:test"

import { formatGameNumber } from "../src/lib/game-number.ts"

test("a figure in the thousands has no thousands separator", () => {
  assert.equal(formatGameNumber(98000), "98000")
  assert.equal(formatGameNumber(1200), "1200")
})

test("decimals are written with a dot whatever the locale", () => {
  assert.equal(formatGameNumber(0.35), "0.35")
  assert.equal(formatGameNumber(2.5), "2.5")
})

test("small decimals of the game are kept", () => {
  assert.equal(formatGameNumber(0.075), "0.075")
})

test("a figure is rounded to the decimals asked for", () => {
  assert.equal(formatGameNumber(4.9133, 2), "4.91")
  assert.equal(formatGameNumber(-0.001, 2), "0")
})
